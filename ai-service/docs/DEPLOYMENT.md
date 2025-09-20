# HearTalk AI MVP 生产部署指南

## 🚀 Phase 5.2 生产部署完整指南

### 预备检查清单

在部署到生产环境之前，请确认以下项目已完成：

#### ✅ 开发阶段完成项
- [x] **Phase 4.3**: 基础缓存机制 - LRU缓存，TTL支持，性能优化
- [x] **Phase 5.1**: 综合测试 - 核心模块测试，功能验证，性能测试
- [x] **推理系统**: Chain-of-Thought和Self-Consistency推理完整实现
- [x] **生产模式**: SHOW_REASONING_PROCESS=false，用户友好输出
- [x] **智能路由**: BasicRouter关键词匹配，上下文感知
- [x] **缓存优化**: 路由缓存，响应时间优化

#### ⚠️ 部署前必要配置
- [ ] 更新生产环境API密钥
- [ ] 配置安全的JWT_SECRET
- [ ] 设置正确的HEARTALK_BACKEND_URL
- [ ] 验证VikingDB生产配置
- [ ] 检查Byteplus端点配置

## 🔧 部署选项

### 选项1: Docker Compose 部署 (推荐)

**优点**: 简单、一键部署、包含健康检查
**适用**: 单服务器部署、开发/测试环境

```bash
# 1. 准备生产配置
cp .env.production .env

# 2. 更新生产密钥（重要！）
nano .env  # 编辑所有CHANGE_THIS_*配置项

# 3. 构建并启动服务
docker-compose up -d

# 4. 验证部署
docker-compose ps
docker-compose logs ai-service
```

### 选项2: Docker 单容器部署

**优点**: 更细粒度控制、适合容器编排
**适用**: Kubernetes、生产容器环境

```bash
# 1. 构建生产镜像
docker build -t ai-service:production .

# 2. 运行生产容器
docker run -d \
  --name ai-service \
  --env-file .env.production \
  -p 8001:8001 \
  --restart unless-stopped \
  ai-service:production

# 3. 验证健康状态
docker exec ai-service curl -f http://localhost:8001/api/v1/health
```

### 选项3: 直接Node.js部署

**优点**: 最小资源占用、直接控制
**适用**: 传统服务器、云虚拟机

```bash
# 1. 安装依赖
npm ci --only=production

# 2. 配置生产环境
export NODE_ENV=production
source .env.production

# 3. 启动服务 (推荐使用PM2)
npm install -g pm2
pm2 start src/index.js --name ai-service

# 4. 设置开机启动
pm2 startup
pm2 save
```

## 🔒 安全配置检查

### 必要的生产安全设置

```bash
# 检查环境变量安全性
grep -E "(SECRET|KEY|PASSWORD)" .env

# 确保以下配置已更改：
JWT_SECRET=你的超级安全密钥（至少32字符）
BYTEPLUS_API_KEY=生产环境API密钥
VIKINGDB_ACCESS_KEY=生产环境访问密钥
VIKINGDB_SECRET_KEY=生产环境秘密密钥
HEARTALK_API_KEY=生产环境HearTalk密钥
```

### 安全加固建议

1. **网络安全**:
   ```bash
   # 配置防火墙，只开放必要端口
   ufw allow 8001/tcp
   ufw enable
   ```

2. **日志安全**:
   ```bash
   # 确保日志目录权限正确
   mkdir -p logs
   chmod 750 logs
   ```

3. **容器安全**:
   - 使用非root用户运行（已配置）
   - 定期更新基础镜像
   - 扫描安全漏洞

## 📊 监控和维护

### 健康检查端点

- **健康检查**: `GET /api/v1/health`
  ```json
  {
    "status": "healthy",
    "uptime": "2h 30m 45s",
    "memory": { "used": "123MB", "free": "877MB" }
  }
  ```

- **性能指标**: `GET /api/v1/metrics` (需要认证)
  ```json
  {
    "requests": { "total": 1000, "success": 995, "error": 5 },
    "cache": { "hits": 250, "misses": 750, "hitRate": "25%" },
    "routes": { "chat": 500, "complex_reasoning": 300, "work_assistant": 200 }
  }
  ```

### 日志管理

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# Docker日志
docker-compose logs -f ai-service
```

### 性能监控

建议监控指标：
- **响应时间**: 平均<5秒，P95<10秒
- **缓存命中率**: >20%
- **成功率**: >99%
- **内存使用**: <1GB
- **CPU使用**: <80%

## 🚨 故障排除

### 常见问题及解决方案

#### 1. 服务启动失败

```bash
# 检查端口占用
netstat -tulpn | grep 8001

# 检查环境配置
env | grep -E "(BYTEPLUS|VIKINGDB|JWT)"

# 查看详细错误
docker-compose logs ai-service
```

#### 2. API调用失败

```bash
# 测试健康检查
curl http://localhost:8001/api/v1/health

# 测试带认证的API
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8001/api/v1/chat/generate
```

#### 3. 性能问题

```bash
# 检查系统资源
docker stats ai-service

# 检查缓存状态
# 通过/api/v1/metrics端点查看缓存命中率
```

#### 4. 外部服务连接失败

```bash
# 测试Byteplus连接
curl -H "Authorization: Bearer $BYTEPLUS_API_KEY" \
     https://ark.cn-beijing.volces.com/api/v3/chat/completions

# 检查VikingDB连接
# 查看应用日志中的连接错误
```

## 📋 部署后验证清单

### 功能验证

```bash
# 1. 健康检查
curl http://localhost:8001/api/v1/health
# 期望: HTTP 200, {"status": "healthy"}

# 2. 生成JWT token进行API测试
# (使用你的JWT_SECRET)

# 3. 测试AI对话功能
curl -X POST http://localhost:8001/api/v1/chat/generate \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "test-deployment",
    "message": "你好，你是谁？",
    "user_id": "deployment-test"
  }'
# 期望: HTTP 200, 包含AI回复的响应

# 4. 测试复杂推理
curl -X POST http://localhost:8001/api/v1/chat/generate \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "test-reasoning",
    "message": "分析一下React和Vue的优缺点",
    "user_id": "deployment-test"
  }'
# 期望: HTTP 200, 详细的比较分析，无推理过程显示

# 5. 验证缓存机制
# 重复发送相同请求，观察响应时间是否减少
```

### 性能验证

```bash
# 并发测试（需要安装ab工具）
ab -n 100 -c 10 http://localhost:8001/api/v1/health

# 负载测试（简单版本）
for i in {1..10}; do
  curl -s http://localhost:8001/api/v1/health &
done
wait
```

## 🔄 更新和回滚

### 更新流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker-compose build

# 3. 滚动更新（保持服务可用）
docker-compose up -d --no-deps ai-service

# 4. 验证更新
docker-compose ps
curl http://localhost:8001/api/v1/health
```

### 回滚流程

```bash
# 1. 使用之前的稳定版本
git checkout [稳定版本标签]

# 2. 重新构建并部署
docker-compose build
docker-compose up -d --no-deps ai-service

# 3. 验证回滚成功
curl http://localhost:8001/api/v1/health
```

## 📞 支持联系

- **文档**: 查看README.md和技术参考文档
- **日志**: 检查logs/目录下的日志文件
- **监控**: 使用/api/v1/metrics端点获取实时状态
- **健康检查**: /api/v1/health端点提供服务状态

---

## 📈 部署完成确认

部署完成后，请确认以下指标正常：

- [ ] **服务状态**: 健康检查返回200状态
- [ ] **AI功能**: 能够正常生成AI回复
- [ ] **推理模式**: 生产模式正确隐藏推理过程
- [ ] **缓存机制**: 相同请求响应时间明显减少
- [ ] **安全认证**: JWT认证正常工作
- [ ] **日志记录**: 日志正常写入，没有严重错误
- [ ] **性能指标**: 响应时间、内存使用在合理范围

**部署状态**: 🎉 **Phase 5.2生产部署准备完成！**

该部署指南提供了完整的生产部署流程，包含安全配置、监控方案、故障排除等关键信息，确保HearTalk AI MVP能够稳定运行在生产环境中。