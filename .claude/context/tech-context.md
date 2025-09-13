---
created: 2025-09-13T04:21:42Z
last_updated: 2025-09-13T04:21:42Z
version: 1.0
author: Claude Code PM System
---

# 技术上下文

## 技术栈概览

### 运行时环境
- **Node.js**: >= 18.0.0 (ES Modules支持)
- **npm**: >= 8.0.0 (依赖管理)
- **Docker**: 容器化部署支持

### 核心框架
- **Express.js 4.18.2**: Web应用框架
- **ES Modules**: 现代JavaScript模块系统
- **JWT (jsonwebtoken 9.0.2)**: 认证和授权

### AI和数据服务
- **Byteplus Model Ark**: 主要AI推理服务
  - 通用对话端点: `ep-20250819170822-q2vnf`
  - 工作助理端点: `ep-20250826180754-nwjhn`
- **VikingDB**: 向量数据库，RAG功能支持
- **@volcengine/openapi 1.32.0**: Byteplus官方SDK

### 安全和性能
- **Helmet 7.2.0**: 安全头部中间件
- **CORS 2.8.5**: 跨域资源共享
- **Express Rate Limit 6.11.2**: API速率限制
- **Compression 1.7.4**: 响应压缩
- **Winston 3.10.0**: 结构化日志系统

### 开发工具
- **Jest 29.7.0**: 测试框架
- **ESLint 8.50.0**: 代码质量检查
- **Nodemon 3.0.1**: 开发环境热重载
- **Supertest 6.3.3**: HTTP API测试

## 架构模式

### 微服务架构
```
HearTalk Frontend → HearTalk AI MVP → Byteplus Model Ark
                                   → VikingDB Vector Database
                                   → HearTalk Backend (可选)
```

### 分层架构设计
1. **API层**: Express路由和控制器
2. **业务逻辑层**: 服务类和推理增强
3. **数据访问层**: 外部API集成和缓存
4. **基础设施层**: 配置、日志、监控

### 设计模式应用
- **工厂模式**: ProviderFactory管理AI提供商
- **策略模式**: ReasoningEnhancer支持多种推理策略
- **装饰器模式**: 中间件链式处理请求
- **单例模式**: ConfigManager配置管理

## AI推理技术

### Chain-of-Thought (CoT) 推理
```javascript
// ReasoningEnhancer实现
const cotPrompt = `
请按照以下步骤思考：
1. 理解问题的核心要点
2. 分析所需的知识领域
3. 逐步推理得出结论
4. 验证答案的合理性

问题：${userMessage}
`;
```

### Self-Consistency 推理
```javascript
// 多样本一致性检查
const samples = await Promise.all(
  Array(this.config.selfConsistencySamples).fill().map(() => 
    this.generateResponse(enhancedPrompt)
  )
);
const finalAnswer = this.selectMostConsistentAnswer(samples);
```

### 生产模式控制
```javascript
// 推理过程显示控制
if (this.showReasoningProcess) {
  return fullReasoningResponse; // 开发模式：显示完整推理
} else {
  return extractFinalAnswer(response); // 生产模式：仅显示结果
}
```

## 缓存和性能优化

### LRU缓存实现
```javascript
// BasicRouter中的路由缓存
class LRUCache {
  constructor(maxSize = 1000, ttl = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    // LRU: 移动到最后
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }
}
```

### 性能优化策略
1. **路由缓存**: 关键词分析结果缓存1小时
2. **上下文缓存**: 会话上下文内存缓存
3. **配置缓存**: 环境配置解析缓存
4. **响应压缩**: Gzip压缩减少网络传输

## 外部服务集成

### Byteplus Model Ark集成
```javascript
// ProviderFactory中的API调用
const response = await axios.post(
  `https://ark.cn-beijing.volces.com/api/v3/chat/completions`,
  {
    model: endpoint,
    messages: formattedMessages,
    temperature: 0.7,
    max_tokens: 2000
  },
  {
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: this.timeout
  }
);
```

### VikingDB向量数据库
```javascript
// 向量检索配置
const vikingConfig = {
  host: 'api-vikingdb.mlp.ap-mya.byteplus.com',
  region: 'ap-southeast-1',
  accessKey: process.env.VIKINGDB_ACCESS_KEY,
  secretKey: process.env.VIKINGDB_SECRET_KEY
};
```

### 错误处理和重试机制
```javascript
// 自动重试逻辑
async function callWithRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## 安全实现

### JWT认证机制
```javascript
// AuthMiddleware中的token验证
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded;
```

### 速率限制配置
```javascript
// RateLimiter配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  message: '请求过于频繁，请稍后再试'
});
```

### 安全头部设置
```javascript
// Helmet安全配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## 配置管理

### 环境变量驱动配置
```javascript
// ConfigManager实现
class ConfigManager {
  constructor() {
    this.configCache = new Map();
    this.loadConfig();
  }
  
  loadConfig() {
    // AI服务配置
    this.configCache.set('ai', {
      byteplusApiKey: process.env.BYTEPLUS_API_KEY,
      chatEndpoint: process.env.BYTEPLUS_AMI_CHAT_EP,
      workAssistantEndpoint: process.env.BYTEPLUS_AMI_WORK_ASSISTANT_EP
    });
    
    // 推理配置
    this.configCache.set('reasoning', {
      enableChainOfThought: this.getBoolean('ENABLE_CHAIN_OF_THOUGHT', true),
      enableSelfConsistency: this.getBoolean('ENABLE_SELF_CONSISTENCY', true),
      showReasoningProcess: this.getBoolean('SHOW_REASONING_PROCESS', false)
    });
  }
}
```

### 开发/生产环境分离
- **开发环境**: 详细日志，推理过程可见，调试功能开启
- **生产环境**: 清洁输出，性能优化，安全加固

## 日志和监控

### Winston日志系统
```javascript
// Logger配置
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});
```

### 健康检查端点
```javascript
// 系统健康状态监控
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: formatUptime(process.uptime()),
    memory: {
      used: formatBytes(process.memoryUsage().heapUsed),
      free: formatBytes(process.memoryUsage().heapTotal - process.memoryUsage().heapUsed)
    },
    timestamp: new Date().toISOString()
  });
});
```

## 测试策略

### 单元测试框架
```javascript
// Jest配置 (package.json)
{
  "scripts": {
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
    "test:watch": "NODE_OPTIONS='--experimental-vm-modules' jest --watch"
  }
}
```

### API集成测试
```javascript
// Supertest HTTP测试
const request = require('supertest');
const app = require('../src/app');

describe('Chat API', () => {
  test('should generate AI response', async () => {
    const response = await request(app)
      .post('/api/v1/chat/generate')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        conversation_id: 'test-123',
        message: '你好',
        user_id: 'test-user'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('response');
  });
});
```

### 性能测试
- **响应时间**: 目标 < 5秒平均响应
- **缓存命中率**: 目标 > 20%
- **并发处理**: 支持100个并发请求
- **内存使用**: 维持 < 1GB内存占用

## 部署技术

### Docker容器化
```dockerfile
# 生产环境Dockerfile
FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 8001
CMD ["node", "src/index.js"]
```

### Docker Compose编排
```yaml
# 生产部署配置
services:
  ai-service:
    build: .
    ports: ["8001:8001"]
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 技术债务管理

### 代码质量保证
- **ESLint**: 自动代码风格检查
- **Git Hooks**: 提交前代码检查
- **测试覆盖**: 核心模块100%测试覆盖
- **文档同步**: 代码变更时同步更新文档

### 性能监控
- **响应时间监控**: 实时API性能追踪
- **内存泄漏检查**: 定期内存使用分析
- **依赖安全扫描**: 自动检查第三方库漏洞
- **日志分析**: 错误模式识别和告警