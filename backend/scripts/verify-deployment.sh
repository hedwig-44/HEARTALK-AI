#!/bin/bash

# HearTalk Backend部署验证脚本 (Shell版本)
# 
# 用于快速验证Backend服务和Internal API的基本功能
# 
# 使用方法:
# ./scripts/verify-deployment.sh [HOST] [PORT] [API_KEY]
# 
# 参数:
# HOST     - Backend服务主机 (默认: localhost)
# PORT     - Backend服务端口 (默认: 8000)
# API_KEY  - Internal API密钥 (可选，从.env文件读取)

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_debug() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${GRAY}[DEBUG]${NC} $1"
    fi
}

# 解析命令行参数
HOST=${1:-localhost}
PORT=${2:-8000}
API_KEY=$3
VERBOSE=${VERBOSE:-false}

# 如果没有提供API_KEY，尝试从.env文件读取
if [ -z "$API_KEY" ] && [ -f ".env" ]; then
    API_KEY=$(grep "HEARTALK_API_KEY=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
fi

# 如果仍然没有，尝试从环境变量读取
if [ -z "$API_KEY" ]; then
    API_KEY=${HEARTALK_API_KEY:-}
fi

BASE_URL="http://${HOST}:${PORT}"

# 验证结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试计数器
test_count() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

test_pass() {
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_success "✓ $1"
}

test_fail() {
    FAILED_TESTS=$((FAILED_TESTS + 1))
    log_error "✗ $1"
}

# 通用HTTP测试函数
http_test() {
    local url="$1"
    local expected_status="$2"
    local headers="$3"
    local description="$4"
    
    log_info "正在测试: $description"
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "%{http_code}" -H "$headers" "$url" 2>/dev/null || echo "000")
    else
        response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    fi
    
    # 提取状态码（最后3位）
    status_code="${response: -3}"
    # 提取响应体（除了最后3位）
    response_body="${response%???}"
    
    log_debug "状态码: $status_code"
    log_debug "响应体: ${response_body:0:100}..."
    
    if [ "$status_code" = "$expected_status" ]; then
        test_pass "$description"
        return 0
    else
        test_fail "$description (期望: $expected_status, 实际: $status_code)"
        return 1
    fi
}

# 显示帮助信息
show_help() {
    echo "HearTalk Backend部署验证脚本"
    echo ""
    echo "使用方法: $0 [HOST] [PORT] [API_KEY]"
    echo ""
    echo "参数:"
    echo "  HOST     Backend服务主机 (默认: localhost)"
    echo "  PORT     Backend服务端口 (默认: 8000)"
    echo "  API_KEY  Internal API密钥 (可选，从.env文件读取)"
    echo ""
    echo "环境变量:"
    echo "  VERBOSE=true  显示详细输出"
    echo ""
    echo "示例:"
    echo "  $0"
    echo "  $0 production.heartalk.com 443"
    echo "  VERBOSE=true $0 localhost 8000 your_api_key"
    exit 0
}

# 检查curl是否可用
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        log_error "curl命令未找到，请安装curl"
        exit 1
    fi
}

# 主验证流程
main() {
    # 检查帮助参数
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_help
    fi
    
    check_dependencies
    
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}               HearTalk Backend部署验证${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
    
    log_info "目标服务: $BASE_URL"
    log_info "API密钥: $([ -n "$API_KEY" ] && echo "已配置" || echo "未配置")"
    echo ""
    
    # 测试1: 基本连通性
    test_count
    http_test "$BASE_URL/" "200" "" "基本连通性测试"
    
    # 测试2: 健康检查
    test_count
    http_test "$BASE_URL/health" "200" "" "健康检查端点"
    
    # 测试3: API文档
    test_count
    http_test "$BASE_URL/docs" "200" "" "API文档端点"
    
    # 测试4: 404处理
    test_count
    http_test "$BASE_URL/nonexistent-endpoint" "404" "" "404错误处理"
    
    # 测试5: Internal API健康检查（如果有API密钥）
    if [ -n "$API_KEY" ]; then
        test_count
        http_test "$BASE_URL/internal/api/v1/health" "200" "X-API-Key: $API_KEY" "Internal API健康检查"
        
        # 测试6: Internal API认证（无密钥应该返回401）
        test_count
        http_test "$BASE_URL/internal/api/v1/health" "401" "" "Internal API认证验证"
    else
        log_warn "跳过Internal API测试（未提供API密钥）"
    fi
    
    # 测试CORS预检请求
    test_count
    log_info "正在测试: CORS预检请求"
    cors_response=$(curl -s -w "%{http_code}" -X OPTIONS \
        -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        "$BASE_URL/api/v1/auth/login" 2>/dev/null || echo "000")
    
    cors_status="${cors_response: -3}"
    if [ "$cors_status" = "200" ] || [ "$cors_status" = "204" ]; then
        test_pass "CORS预检请求"
    else
        test_fail "CORS预检请求 (状态码: $cors_status)"
    fi
    
    # 性能测试
    test_count
    log_info "正在测试: 响应性能"
    start_time=$(date +%s%N)
    http_test "$BASE_URL/health" "200" "" > /dev/null 2>&1
    end_time=$(date +%s%N)
    response_time=$(( (end_time - start_time) / 1000000 ))  # 转换为毫秒
    
    if [ $response_time -lt 1000 ]; then
        test_pass "响应性能 (${response_time}ms)"
    else
        test_fail "响应性能过慢 (${response_time}ms，目标: <1000ms)"
    fi
    
    # 结果汇总
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}                    验证结果汇总${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
    
    echo "总测试数: $TOTAL_TESTS"
    echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
    echo -e "${RED}失败: $FAILED_TESTS${NC}"
    echo ""
    
    success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    echo "成功率: ${success_rate}%"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "所有测试通过！部署验证成功。"
        exit 0
    else
        log_error "$FAILED_TESTS 个测试失败。请检查问题后重试。"
        exit 1
    fi
}

# 信号处理
trap 'log_error "验证过程被中断"; exit 1' INT TERM

# 运行主程序
main "$@"