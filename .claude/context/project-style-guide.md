---
created: 2025-09-13T04:21:42Z
last_updated: 2025-09-13T04:21:42Z
version: 1.0
author: Claude Code PM System
---

# 项目风格指南

## 代码风格规范

### JavaScript/Node.js 编码规范

#### 基本语法规范
```javascript
// ✅ 使用 ES Modules 语法
import express from 'express';
import { ConfigManager } from './utils/ConfigManager.js';

// ✅ 使用 const/let，避免 var
const app = express();
let currentConfig = null;

// ✅ 使用箭头函数
const processRequest = (req, res) => {
  // 实现逻辑
};

// ✅ 使用模板字符串
const message = `User ${userId} generated response at ${timestamp}`;
```

#### 命名约定
```javascript
// ✅ 类名使用 PascalCase
class ReasoningEnhancer {
  constructor() {
    // ✅ 私有属性使用前缀下划线
    this._config = null;
    // ✅ 公共属性使用 camelCase
    this.isInitialized = false;
  }
  
  // ✅ 方法名使用 camelCase
  async enhanceReasoning(prompt) {
    return await this._processPrompt(prompt);
  }
  
  // ✅ 私有方法使用前缀下划线
  _processPrompt(prompt) {
    // 实现逻辑
  }
}

// ✅ 常量使用 SCREAMING_SNAKE_CASE
const MAX_CACHE_SIZE = 1000;
const DEFAULT_TIMEOUT = 30000;

// ✅ 变量和函数使用 camelCase
const userMessage = req.body.message;
const generateResponse = async (prompt) => {};
```

#### 文件和目录命名
```
src/
├── controllers/
│   └── ChatController.js      // PascalCase for classes
├── services/
│   ├── ProviderFactory.js     // PascalCase for classes
│   └── ReasoningEnhancer.js   
├── middleware/
│   ├── AuthMiddleware.js      // PascalCase for middleware classes
│   └── RateLimiter.js
├── utils/
│   ├── ConfigManager.js       // PascalCase for utility classes
│   └── Logger.js
└── routes/
    └── ChatRoutes.js          // PascalCase for route definitions
```

### 代码组织结构

#### 类设计模式
```javascript
// ✅ 标准类结构
class ServiceClass {
  // 1. 构造函数
  constructor(config) {
    this.config = config;
    this._initialize();
  }
  
  // 2. 公共方法 (按重要性排序)
  async primaryMethod() {
    return await this._helperMethod();
  }
  
  async secondaryMethod() {
    // 实现逻辑
  }
  
  // 3. 私有方法 (按调用顺序)
  _initialize() {
    // 初始化逻辑
  }
  
  _helperMethod() {
    // 辅助逻辑
  }
  
  // 4. Getter/Setter (如果需要)
  get isReady() {
    return this._isInitialized;
  }
}
```

#### 模块导出模式
```javascript
// ✅ 默认导出类
class ConfigManager {
  // 类实现
}

export default ConfigManager;

// ✅ 命名导出工具函数
export const formatResponse = (data) => {
  // 格式化逻辑
};

export const validateInput = (input) => {
  // 验证逻辑
};

// ✅ 导出常量
export const ROUTE_TYPES = {
  CHAT: 'chat',
  COMPLEX_REASONING: 'complex_reasoning',
  WORK_ASSISTANT: 'work_assistant'
};
```

### 错误处理规范

#### 错误处理模式
```javascript
// ✅ 使用 try-catch 包装异步操作
async function processRequest(req, res) {
  try {
    const result = await serviceCall();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Request processing failed:', {
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });
    res.status(500).json({
      error: 'Internal server error',
      requestId: req.id
    });
  }
}

// ✅ 自定义错误类
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// ✅ 错误传播
async function validateAndProcess(data) {
  if (!data.userId) {
    throw new ValidationError('User ID is required', 'userId');
  }
  
  try {
    return await externalAPICall(data);
  } catch (error) {
    // 包装并重新抛出
    throw new Error(`Processing failed: ${error.message}`);
  }
}
```

## 文档规范

### 代码注释规范
```javascript
/**
 * 推理增强服务类
 * 集成Chain-of-Thought和Self-Consistency推理算法
 * 
 * @class ReasoningEnhancer
 * @author Claude Code AI Assistant
 * @since 1.0.0
 */
class ReasoningEnhancer {
  /**
   * 创建推理增强器实例
   * 
   * @param {Object} config - 配置对象
   * @param {boolean} config.enableCoT - 是否启用Chain-of-Thought
   * @param {boolean} config.enableSelfConsistency - 是否启用Self-Consistency
   * @param {number} config.samples - Self-Consistency采样数量
   */
  constructor(config) {
    this.config = config;
  }
  
  /**
   * 增强用户提示词的推理能力
   * 
   * @param {string} prompt - 原始提示词
   * @param {string} routeType - 路由类型 (chat|complex_reasoning|work_assistant)
   * @returns {Promise<string>} 增强后的提示词
   * @throws {Error} 当路由类型无效时抛出错误
   * 
   * @example
   * const enhancer = new ReasoningEnhancer(config);
   * const enhanced = await enhancer.enhancePrompt('分析React和Vue的优缺点', 'complex_reasoning');
   */
  async enhancePrompt(prompt, routeType) {
    // 实现逻辑
  }
}
```

### README 文档结构
```markdown
# 项目名称

## 项目简介
简洁描述项目目的和核心功能

## 特性
- 列出主要功能特性
- 突出技术亮点

## 快速开始
### 安装依赖
```bash
npm install
```

### 环境配置
```bash
cp .env.example .env
# 编辑 .env 文件配置
```

### 启动服务
```bash
npm start
```

## API 文档
详细的API接口说明

## 部署指南
生产环境部署步骤

## 贡献指南
代码贡献和开发规范

## 许可证
项目许可证信息
```

### API 文档规范
```javascript
/**
 * @api {post} /api/v1/chat/generate 生成AI回复
 * @apiVersion 1.0.0
 * @apiName GenerateChat
 * @apiGroup Chat
 * 
 * @apiDescription 基于用户消息生成AI回复，支持Chain-of-Thought和Self-Consistency推理
 * 
 * @apiHeader {String} Authorization JWT认证令牌 (Bearer token)
 * @apiHeader {String} Content-Type 请求内容类型 (application/json)
 * 
 * @apiParam {String} conversation_id 对话ID
 * @apiParam {String} message 用户消息内容
 * @apiParam {String} user_id 用户ID
 * 
 * @apiSuccess {String} response AI回复内容
 * @apiSuccess {String} conversation_id 对话ID
 * @apiSuccess {String} timestamp 响应时间戳
 * @apiSuccess {String} route_type 使用的路由类型
 * 
 * @apiSuccessExample {json} 成功响应:
 * HTTP/1.1 200 OK
 * {
 *   "response": "基于您的问题，我来分析React和Vue的优缺点...",
 *   "conversation_id": "conv-12345",
 *   "timestamp": "2025-09-13T04:21:42Z",
 *   "route_type": "complex_reasoning"
 * }
 * 
 * @apiError (401) Unauthorized 认证失败
 * @apiError (400) BadRequest 请求参数无效
 * @apiError (500) InternalServerError 服务器内部错误
 */
```

## Git 工作流规范

### 分支命名规范
```bash
# 功能分支
feature/add-reasoning-enhancement
feature/implement-smart-routing

# 修复分支
fix/cache-memory-leak
fix/authentication-issue

# 热修复分支
hotfix/critical-security-patch

# 发布分支
release/v1.0.0
release/v1.1.0
```

### 提交消息规范
```bash
# 格式: <type>(<scope>): <subject>

# 功能
feat(reasoning): add Chain-of-Thought algorithm implementation
feat(router): implement smart keyword routing system

# 修复
fix(cache): resolve memory leak in LRU cache
fix(auth): correct JWT token validation logic

# 文档
docs(readme): update installation instructions
docs(api): add authentication examples

# 重构
refactor(config): extract configuration management to separate class
refactor(middleware): simplify error handling middleware

# 测试
test(reasoning): add unit tests for ReasoningEnhancer
test(integration): add end-to-end API tests

# 构建
build(docker): optimize production Dockerfile
build(deps): update dependencies to latest versions
```

### 代码审查清单
```markdown
## Code Review Checklist

### 功能性
- [ ] 代码实现了需求规格说明的功能
- [ ] 边界条件和错误情况得到适当处理
- [ ] 性能考虑得当，没有明显的性能瓶颈

### 代码质量
- [ ] 代码遵循项目编码规范
- [ ] 变量和函数命名清晰且有意义
- [ ] 代码结构清晰，逻辑易于理解
- [ ] 没有重复代码，遵循DRY原则

### 安全性
- [ ] 输入验证充分，防止注入攻击
- [ ] 敏感信息得到适当保护
- [ ] 认证和授权逻辑正确实现

### 测试
- [ ] 包含适当的单元测试
- [ ] 测试覆盖主要功能路径
- [ ] 测试案例包含边界条件

### 文档
- [ ] 代码注释充分且准确
- [ ] API文档更新完整
- [ ] README文件反映最新变更
```

## 配置管理规范

### 环境变量规范
```bash
# 服务配置
NODE_ENV=production
PORT=8001
HOST=0.0.0.0

# 安全配置 (生产环境必须更改)
JWT_SECRET=CHANGE_THIS_IN_PRODUCTION_TO_SECURE_SECRET
JWT_EXPIRES_IN=24h

# 外部服务配置
BYTEPLUS_API_KEY=your_api_key_here
BYTEPLUS_AMI_CHAT_EP=ep-20250819170822-q2vnf
BYTEPLUS_AMI_WORK_ASSISTANT_EP=ep-20250826180754-nwjhn

# 数据库配置
VIKINGDB_HOST=api-vikingdb.mlp.ap-mya.byteplus.com
VIKINGDB_REGION=ap-southeast-1
VIKINGDB_ACCESS_KEY=your_access_key
VIKINGDB_SECRET_KEY=your_secret_key

# 功能开关
ENABLE_CHAIN_OF_THOUGHT=true
ENABLE_SELF_CONSISTENCY=true
SHOW_REASONING_PROCESS=false

# 性能配置
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
MAX_CONTEXT_TOKENS=2000
```

### 配置验证规范
```javascript
// ✅ 配置验证函数
function validateConfig() {
  const required = [
    'BYTEPLUS_API_KEY',
    'JWT_SECRET',
    'VIKINGDB_ACCESS_KEY',
    'VIKINGDB_SECRET_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // 验证 JWT_SECRET 强度
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
}

// ✅ 配置类型转换
function getBoolean(key, defaultValue = false) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getInt(key, defaultValue = 0) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
```

## 日志记录规范

### 日志级别和格式
```javascript
// ✅ 结构化日志记录
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'ai-service',
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/app.log' 
    })
  ]
});

// ✅ 日志记录示例
logger.info('Request processed successfully', {
  requestId: req.id,
  userId: req.user.id,
  routeType: 'complex_reasoning',
  responseTime: Date.now() - startTime
});

logger.error('External API call failed', {
  error: error.message,
  endpoint: 'byteplus-api',
  retryCount: 3,
  requestId: req.id
});

logger.warn('Cache miss for frequent query', {
  query: hashQuery(userMessage),
  cacheHitRate: cache.getHitRate()
});
```

### 敏感信息保护
```javascript
// ✅ 敏感信息过滤
function sanitizeLogData(data) {
  const sensitiveFields = ['password', 'apiKey', 'token', 'secret'];
  const sanitized = { ...data };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

// ✅ 安全日志记录
logger.info('User authentication', sanitizeLogData({
  userId: user.id,
  email: user.email,
  token: user.jwt_token  // 将被替换为 [REDACTED]
}));
```

## 测试规范

### 测试文件结构
```
tests/
├── unit/                    # 单元测试
│   ├── services/
│   │   ├── ReasoningEnhancer.test.js
│   │   └── BasicRouter.test.js
│   └── utils/
│       └── ConfigManager.test.js
├── integration/             # 集成测试
│   ├── api/
│   │   └── chat.test.js
│   └── services/
│       └── provider-integration.test.js
└── e2e/                    # 端到端测试
    └── chat-workflow.test.js
```

### 测试编写规范
```javascript
// ✅ 测试结构模板
describe('ReasoningEnhancer', () => {
  let enhancer;
  let mockConfig;
  
  beforeEach(() => {
    mockConfig = {
      enableChainOfThought: true,
      enableSelfConsistency: true,
      selfConsistencySamples: 3
    };
    enhancer = new ReasoningEnhancer(mockConfig);
  });
  
  describe('enhancePrompt', () => {
    it('should enhance prompt with Chain-of-Thought for complex reasoning', async () => {
      // Arrange
      const originalPrompt = '分析React和Vue的优缺点';
      const routeType = 'complex_reasoning';
      
      // Act
      const enhanced = await enhancer.enhancePrompt(originalPrompt, routeType);
      
      // Assert
      expect(enhanced).toContain('请按照以下步骤思考');
      expect(enhanced).toContain(originalPrompt);
      expect(enhanced).toMatch(/步骤.*分析.*推理/);
    });
    
    it('should throw error for invalid route type', async () => {
      // Arrange
      const prompt = 'test prompt';
      const invalidRoute = 'invalid_route';
      
      // Act & Assert
      await expect(enhancer.enhancePrompt(prompt, invalidRoute))
        .rejects
        .toThrow('Invalid route type: invalid_route');
    });
  });
});
```

这些风格指南确保了HearTalk AI MVP项目的代码质量、可维护性和团队协作效率，为项目的长期发展奠定了坚实基础。