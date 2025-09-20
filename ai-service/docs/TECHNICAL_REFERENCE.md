# HearTalk AI MVP 技术参考文档

## 🏗️ 架构设计

### 项目结构

```
ai-service/
├── src/
│   ├── controllers/        # API控制器
│   │   ├── ChatController.js        # 聊天API控制器
│   │   └── TranslateController.js   # 翻译API控制器
│   ├── middleware/         # Express中间件
│   │   ├── AuthMiddleware.js        # JWT认证中间件
│   │   ├── LoggingMiddleware.js     # HTTP请求日志
│   │   └── MetricsMiddleware.js     # 性能监控
│   ├── models/            # 数据模型
│   │   └── AIProvider.js           # AI提供商抽象基类
│   ├── routes/            # 路由配置
│   │   └── api.js                  # API路由定义
│   ├── services/          # 业务逻辑服务
│   │   ├── BackendApiClient.js     # HearTalk Backend集成
│   │   ├── ByteplusProvider.js     # Byteplus AI服务
│   │   ├── ProviderFactory.js      # 服务工厂
│   │   └── VikingDBService.js      # VikingDB向量数据库
│   ├── utils/             # 工具函数
│   │   ├── ConfigManager.js        # 配置管理
│   │   ├── ContextManager.js       # 上下文管理
│   │   └── Logger.js               # 日志系统
│   └── index.js           # 应用入口点
├── tests/                 # 测试文件
├── scripts/               # 实用脚本
├── logs/                  # 日志文件
└── docs/                  # 项目文档
```

### 核心设计模式

1. **工厂模式** (ProviderFactory): 统一管理AI服务提供商
2. **抽象工厂** (AIProvider): 定义AI服务标准接口
3. **单例模式** (ConfigManager, LoggerManager): 全局配置和日志管理
4. **中间件模式** (Express Middleware): 请求日志和性能监控

## 🔧 核心组件详解

### 1. AIProvider 抽象基类

**位置**: `src/models/AIProvider.js`

定义了所有AI服务提供商的标准接口：

```javascript
export class AIProvider {
  // 必须实现的抽象方法
  async generateResponse(params) { throw new Error('Must implement generateResponse') }
  async generateStreamResponse(params, onChunk) { throw new Error('Must implement generateStreamResponse') }
  async translateText(params) { throw new Error('Must implement translateText') }
  
  // 可选的辅助方法
  getName() { return this.name }
  isHealthy() { return true }
}
```

### 2. ByteplusProvider 实现

**位置**: `src/services/ByteplusProvider.js`

Byteplus AI服务的具体实现，支持：
- 双端点智能路由（通用对话 + 工作助理）
- 流式响应处理
- 自动重试和错误处理
- 性能监控集成

**核心方法**:
- `generateResponse()`: 标准对话生成
- `generateStreamResponse()`: 流式对话生成  
- `translateText()`: 文本翻译
- `_selectEndpoint()`: 智能端点选择

### 3. ProviderFactory 服务工厂

**位置**: `src/services/ProviderFactory.js`

统一管理所有AI服务提供商：

```javascript
class ProviderFactory {
  static getProvider(type = 'byteplus') {
    switch (type) {
      case 'byteplus':
        return ByteplusProvider.getInstance()
      default:
        throw new Error(`Unsupported provider: ${type}`)
    }
  }
}
```

### 4. VikingDB向量数据库服务

**位置**: `src/services/VikingDBService.js`

提供RAG功能支持：
- 向量相似度搜索
- 沟通模板检索
- 自动相关性评分

### 5. HearTalk Backend集成

**位置**: `src/services/BackendApiClient.js`

与现有HearTalk Backend系统的集成层：
- 对话历史获取：`getConversationHistory()`
- 用户上下文检索：`getUserContext()`
- 内部服务认证（API Key + JWT）
- 健康检查和重试机制

### 6. JWT认证中间件

**位置**: `src/middleware/AuthMiddleware.js`

实现多层认证：
- 用户JWT认证（支持多种token格式）
- 内部服务认证（API Key + JWT）
- 角色权限验证
- 白名单路径管理

## 📡 API接口文档

### 聊天API

#### POST /api/v1/chat/generate
标准对话生成接口

**请求格式**:
```json
{
  "message": "用户消息",
  "context": [...], // 可选，对话上下文
  "options": {
    "modelParams": {...}, // 可选，模型参数
    "useWorkAssistant": false // 可选，是否使用工作助理端点
  }
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "response": "AI响应内容",
    "provider": "byteplus",
    "endpoint": "chat",
    "usage": {...}
  },
  "requestId": "req_123456",
  "timestamp": "2025-09-12T..."
}
```

#### POST /api/v1/chat/stream
流式对话接口（SSE）

相同的请求格式，但响应为Server-Sent Events流：
```
data: {"content": "部分", "done": false}
data: {"content": "响应", "done": false}  
data: {"done": true}
```

### 翻译API

#### POST /api/v1/translate
文本翻译接口

#### GET /api/v1/translate/languages
获取支持的语言列表

#### POST /api/v1/translate/detect
语言检测接口

### 系统监控API

#### GET /api/v1/health
健康检查接口

#### GET /api/v1/metrics
性能指标接口

#### GET /api/v1/providers
获取可用AI服务提供商

#### GET /api/v1/models
获取可用AI模型列表

## ⚙️ 配置管理

### 环境变量配置

**Byteplus配置**:
```env
BYTEPLUS_AMI_CHAT_EP=ep-xxx          # 通用对话端点
BYTEPLUS_AMI_WORK_ASSISTANT_EP=ep-xxx # 工作助理端点
BYTEPLUS_API_KEY=your_api_key        # API密钥
BYTEPLUS_TIMEOUT=30000               # 请求超时
```

**VikingDB配置**:
```env
VIKINGDB_HOST=api-vikingdb.mlp.ap-mya.byteplus.com
VIKINGDB_REGION=ap-southeast-1
VIKINGDB_ACCESS_KEY=your_access_key
VIKINGDB_SECRET_KEY=your_secret_key
COMMUNICATION_TEMPLATES_COLLECTION=communication_templates_base
```

**HearTalk Backend集成**:
```env
HEARTALK_BACKEND_URL=http://localhost:8000
HEARTALK_API_KEY=your_heartalk_api_key
BACKEND_API_PREFIX=/internal/api/v1
BACKEND_CONVERSATION_PATH=/conversations
BACKEND_USER_PATH=/users
```

**JWT认证配置**:
```env
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
```

**Chain-of-Thought & Self-Consistency配置**:
```env
ENABLE_CHAIN_OF_THOUGHT=true
ENABLE_SELF_CONSISTENCY=true
SELF_CONSISTENCY_SAMPLES=3
```

### 配置验证

使用ConfigManager进行配置验证：

```javascript
const config = ConfigManager.getInstance()
const byteplusConfig = config.getByteplus()
const vikingDBConfig = config.getVikingDB()
const hearTalkConfig = config.getHearTalk()
```

## 📈 性能监控

### 日志系统

使用Winston进行结构化日志：

```javascript
import { getLogger } from '../utils/Logger.js'
const logger = getLogger('component-name')

logger.info('操作成功', { userId, requestId })
logger.error('操作失败', { error: error.message, stack: error.stack })
```

### 性能指标

MetricsMiddleware自动收集：
- 请求响应时间
- API调用统计
- 错误率统计
- 内存使用情况

### 健康检查

多层健康检查：
- 应用服务状态
- Byteplus API连通性
- VikingDB连通性
- HearTalk Backend连通性

## 🧪 测试策略

### 单元测试

使用Jest框架：
```bash
npm test                    # 运行所有测试
npm run test:watch         # 监视模式
npm test -- --coverage    # 生成覆盖率报告
```

### 集成测试

测试外部服务集成：
- Byteplus API调用
- VikingDB数据检索
- HearTalk Backend通信

### API测试

使用Supertest进行API端点测试：
```javascript
request(app)
  .post('/api/v1/chat/generate')
  .send({ message: 'test' })
  .expect(200)
```

## 🔧 开发最佳实践

### 代码规范

- **ESLint**: 使用项目ESLint配置
- **模块化**: ES6+模块系统
- **注释**: JSDoc格式文档注释
- **错误处理**: 统一错误处理模式

### 安全实践

- **环境变量**: 敏感信息使用环境变量
- **JWT验证**: 多层JWT认证
- **输入验证**: 严格的请求参数验证
- **日志脱敏**: 敏感数据不记录日志

### 性能优化

- **连接池**: 复用HTTP连接
- **缓存机制**: 合理使用缓存
- **流式处理**: 支持流式响应
- **超时控制**: 合理的超时设置

## 🔄 部署运维

### Docker部署

```bash
# 构建镜像
docker build -t ai-service .

# 运行容器
docker run -p 8001:8001 ai-service

# 使用Docker Compose
docker-compose up -d
```

### 环境管理

- **开发环境**: 使用nodemon热重载
- **测试环境**: 完整的集成测试
- **生产环境**: PM2进程管理

### 监控告警

- **日志监控**: 结构化日志分析
- **性能监控**: API响应时间
- **错误告警**: 异常情况自动告警
- **健康检查**: 定期健康状态检查

## 🐛 故障排查

### 常见问题

1. **API调用超时**
   - 检查网络连接
   - 验证API密钥和端点配置
   - 查看请求日志确定超时原因

2. **认证失败**  
   - 验证JWT Secret配置
   - 检查Token格式和有效期
   - 确认API Key配置正确

3. **VikingDB连接异常**
   - 验证访问密钥和区域配置
   - 检查集合名称是否正确
   - 查看网络防火墙设置

4. **内存使用过高**
   - 使用`GET /api/v1/metrics`检查内存使用
   - 检查是否有内存泄漏
   - 重启服务释放内存

5. **响应速度慢**
   - 检查Byteplus API调用延迟
   - 优化上下文管理逻辑
   - 使用流式响应改善用户体验

### 调试模式

```bash
# 启用详细日志
LOG_LEVEL=debug npm run dev

# Node.js调试
node --inspect src/index.js
```

### 日志分析

查看结构化日志：
```bash
# 查看实时日志
tail -f logs/app.log

# 过滤错误日志
grep "ERROR" logs/app.log

# 分析特定请求
grep "requestId" logs/app.log | grep "req_123456"
```

---

**注意**: 本文档专注于技术实现细节，项目进度和任务管理请参考Epic文档。