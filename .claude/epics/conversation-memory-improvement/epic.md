---
name: conversation-memory-improvement
status: backlog
created: 2025-09-18T04:36:34Z
updated: 2025-09-18T05:26:52Z
progress: 0%
prd: .claude/prds/conversation-memory-improvement.md
github_url: https://github.com/hedwig-44/HEARTALK-AI/issues/15
source_branch: feature/conversation-memory-improvement
---

# Epic: conversation-memory-improvement

## Overview
实现HearTalk AI对话记忆功能的中期改进方案，通过构建Internal API解决AI无法记住对话历史的问题。该方案通过后端Internal API提供对话历史和用户上下文数据，AI服务调用这些API获取必要的上下文信息，实现连贯的对话体验。

## Architecture Decisions
- **API架构**: 使用Express.js实现RESTful Internal API，避免直接数据库访问
- **认证机制**: 采用API Key + JWT双重认证确保内部服务安全
- **缓存策略**: AI服务层实现LRU缓存减少重复API调用
- **数据格式**: 使用标准JSON响应格式确保跨服务兼容性
- **错误处理**: 实现降级策略，API失败时AI服务仍可正常工作
- **现有架构保持**: 利用现有conversations和messages表，无需数据库结构变更

## Technical Approach

### Frontend Components
- **无需修改**: 前端保持现有对话界面和交互逻辑
- **兼容性保证**: 对话API响应格式保持不变
- **用户体验**: 用户无感知升级，AI记忆功能自动生效

### Backend Services

#### Internal API模块
- **路由文件**: `backend/src/routes/internal.js` - 实现所有Internal API端点
- **中间件**: API Key验证中间件确保服务间调用安全
- **端点设计**:
  - `GET /internal/api/v1/conversations/{id}/history` - 获取对话历史
  - `GET /internal/api/v1/users/{id}/context` - 获取用户上下文
  - `GET /internal/api/v1/health` - 健康检查

#### 数据服务层
- **利用现有服务**: 复用conversationService和messageService
- **查询优化**: 添加limit/offset分页支持
- **性能要求**: API响应时间 < 200ms

#### 认证系统
- **API Key验证**: 环境变量HEARTALK_API_KEY管理
- **JWT Token**: 内部服务间使用短期token (5分钟)
- **错误码标准化**: 统一的错误响应格式

### Infrastructure
- **部署方式**: Docker Compose热重启，无需停机
- **环境配置**: 通过.env文件管理API密钥
- **监控要求**: 现有日志系统记录API调用情况
- **扩展性**: 支持水平扩展，无状态API设计

## Implementation Strategy

### 开发阶段 (3-5天)
1. **后端API开发** (2天): 实现Internal API路由和认证中间件
2. **AI服务集成** (2天): 修改ContextManager调用Internal API
3. **测试部署** (1天): 功能测试和性能验证

### 风险缓解
- **API性能**: 实现缓存机制和查询优化
- **安全风险**: API Key定期轮换，访问日志监控
- **兼容性**: 渐进式部署，保留回滚选项

### 测试方法
- **单元测试**: 每个API端点的功能验证
- **集成测试**: AI服务与Backend的端到端测试
- **性能测试**: 并发API调用和响应时间测试
- **用户测试**: 5阶段对话记忆测试框架验证

## Task Breakdown Preview
基于现有代码基础和架构设计，实施任务已简化为核心功能：

- [ ] **Backend Internal API**: 创建internal.js路由，实现3个核心端点
- [ ] **API认证中间件**: 实现API Key + JWT验证逻辑
- [ ] **AI服务集成**: 修改BackendApiClient响应处理格式
- [ ] **系统集成测试**: 端到端功能验证和性能测试
- [ ] **部署配置**: 环境配置更新和服务重启

## Dependencies
- **现有服务**: conversationService, messageService, userService (已存在)
- **AI服务架构**: ContextManager和BackendApiClient (已实现)
- **数据库表**: conversations, messages (已存在且有数据)
- **认证基础**: JWT secret和API key环境变量管理

## Success Criteria (Technical)
- **API性能**: 所有Internal API端点响应时间 < 200ms
- **记忆功能**: AI通过5阶段测试框架，通过率达到80%以上
- **系统稳定性**: 99%可用性，无现有功能影响
- **安全性**: API Key认证100%生效，无越权访问
- **兼容性**: 现有前端和用户接口无任何变化

## Estimated Effort
- **总体时间**: 3-5天开发 + 2天测试 = 1周完成
- **资源需求**: 1个后端开发人员，部分AI服务调试
- **关键路径**: Backend API开发 → AI服务集成 → 系统测试
- **部署时间**: 30分钟热重启，无停机时间

## Tasks Created
- [ ] CMI001 → #16 - 实现Backend Internal API路由和端点 (parallel: true)
- [ ] CMI002 → #17 - 实现Internal API认证中间件 (parallel: false)
- [ ] CMI003 → #18 - 修改AI服务Backend API客户端集成 (parallel: false)
- [ ] CMI004 → #19 - 执行系统集成测试和AI记忆功能验证 (parallel: false)
- [ ] CMI005 → #20 - 配置部署环境和服务重启 (parallel: true)

Total tasks: 5
Parallel tasks: 2 (CMI001, CMI005)
Sequential tasks: 3 (CMI002, CMI003, CMI004)
Estimated total effort: 48 hours