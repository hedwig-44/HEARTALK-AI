---
created: 2025-09-13T04:21:42Z
last_updated: 2025-09-19T10:26:34Z
version: 1.3
author: Claude Code PM System
---

# 项目结构

## 平台架构概览

HearTalk AI平台现采用**微服务架构**，包含两个核心服务：

- **AI Service** (Port: 8001) - AI推理和对话处理服务
- **Backend Service** (Port: 8000) - 用户管理和数据存储服务

## 目录结构

### AI Service 核心代码 (src/)
```
src/                         # AI服务核心代码
├── index.js                 # 应用入口点，Express服务器启动
├── app.js                   # Express应用配置和中间件设置
├── controllers/             # API控制器层
│   └── ChatController.js    # 聊天API控制器，处理请求响应
├── services/                # 核心业务逻辑服务层
│   ├── ProviderFactory.js   # AI提供商工厂，管理Byteplus集成
│   ├── BasicRouter.js       # 智能路由服务，关键词匹配和缓存
│   └── ReasoningEnhancer.js # 推理增强服务，CoT和Self-Consistency
├── middleware/              # Express中间件
│   ├── AuthMiddleware.js    # JWT认证中间件
│   ├── RateLimiter.js       # 速率限制中间件
│   └── ValidationMiddleware.js # 请求验证中间件
├── utils/                   # 工具类和配置
│   ├── ConfigManager.js     # 配置管理器，环境变量处理
│   ├── Logger.js            # Winston日志工具
│   └── ContextManager.js    # 对话上下文管理，集成Backend API
└── routes/                  # 路由定义
    └── ChatRoutes.js        # 聊天相关路由定义
```

### Backend Service 架构 (backend/)
```
backend/                     # Backend服务 (新增)
├── .env                     # 环境配置文件
├── .env.example            # 环境配置模板
├── package.json            # Node.js项目配置 (新增依赖)
├── DEPLOYMENT.md           # 部署指南
├── scripts/                # 部署和维护脚本
│   ├── health-check.js     # 健康检查脚本
│   ├── validate-env.js     # 环境变量验证
│   ├── verify-deployment.js # 部署验证脚本
│   └── verify-deployment.sh # Shell部署验证
└── src/                    # Backend源代码
    ├── app.js              # Backend应用主入口
    ├── config/             # 配置管理目录 (新增)
    ├── middleware/         # 中间件层
    │   └── errorHandler.js # 错误处理中间件
    ├── routes/             # API路由层
    │   ├── internal.js     # Internal API路由 (AI Service专用)
    │   └── conversations.js # 对话管理路由
    ├── services/           # 业务逻辑层
    │   ├── conversationService.js # 对话管理服务
    │   ├── messageService.js      # 消息管理服务
    │   └── userService.js         # 用户管理服务
    └── utils/              # 工具类
        └── logger.js       # Winston日志工具
```

### 测试文件
```
test-chat.js                # 开发模式AI聊天测试脚本
test-chat-production.js     # 生产模式AI聊天测试脚本
test-custom-cache.js        # 自定义缓存性能测试脚本
```

### 项目管理和文档 (.claude/)
```
.claude/
├── CLAUDE.md               # 项目开发规则和指南
├── commands/               # Claude Code 命令定义
│   └── pm/                 # 项目管理命令
│       ├── epic-sync.md    # Epic GitHub 同步命令
│       ├── epic-decompose.md # Epic 任务分解命令
│       └── status.md       # 项目状态检查命令
├── context/                # 项目上下文文档系统
│   ├── README.md           # 上下文系统说明
│   ├── progress.md         # 项目进度跟踪
│   ├── project-structure.md # 项目架构文档 (本文件)
│   ├── tech-context.md     # 技术栈和实现细节
│   ├── system-patterns.md  # 系统设计模式
│   ├── product-context.md  # 产品功能和业务上下文
│   ├── project-brief.md    # 项目简介和交付摘要
│   ├── project-overview.md # 项目全面概览
│   ├── project-vision.md   # 项目愿景和发展规划
│   └── project-style-guide.md # 代码风格和开发规范
├── epics/                  # Epic 和任务管理
│   └── ai-service-completed/ # 已完成的 AI 服务 Epic
│       ├── epic.md         # Epic 主文件 (已同步到 GitHub #8)
│       ├── 001.md          # 架构设计任务 (GitHub #9)
│       ├── 002.md          # 认证中间件任务 (GitHub #10)
│       ├── 003.md          # CoT推理引擎任务 (GitHub #11)
│       ├── 004.md          # Self-Consistency任务 (GitHub #12)
│       ├── 005.md          # 智能路由缓存任务 (GitHub #13)
│       └── 006.md          # 生产部署任务 (GitHub #14)
├── prds/                   # 产品需求文档
│   ├── ai-service-completed.md # AI服务完成版PRD
│   └── heartalk-ai-replacement.md # HearTalk替换方案PRD
├── rules/                  # 开发规则和约定
│   └── datetime.md         # 日期时间处理规则
└── scripts/                # 项目管理脚本
    └── pm/                 # PM工具脚本
        ├── status.sh       # 项目状态检查
        ├── epic-list.sh    # Epic列表查看
        └── standup.sh      # 日常站会工具
```

### 配置文件
```
.env                        # 开发环境配置
.env.production             # 生产环境配置模板
package.json                # Node.js项目配置和依赖
```

### 部署和容器化
```
Dockerfile                  # 生产Docker镜像定义
docker-compose.yml          # Docker Compose配置
docs/
└── DEPLOYMENT.md           # 生产部署指南
```

### 项目文档
```
README.md                   # 项目说明文档
CLAUDE.md                   # 开发规范和项目规则
.claude/
├── context/               # 项目上下文文档 (9个文档)
├── prds/                  # 产品需求文档
└── epics/                 # Epic任务管理 (CCPM系统)
    └── ai-service-completed/  # AI服务实施Epic (已完成)
        ├── epic.md        # Epic主文件 (completed, 100%)
        ├── 001.md         # 项目架构和Express微服务设置
        ├── 002.md         # JWT认证和安全中间件集成
        ├── 003.md         # Chain-of-Thought推理引擎实现
        ├── 004.md         # Self-Consistency验证系统开发
        ├── 005.md         # 智能路由系统和LRU缓存实现
        └── 006.md         # 生产部署和Docker容器化配置
```

## 架构模式

### 分层架构
1. **路由层** (routes/) - 定义API端点和路径
2. **控制器层** (controllers/) - 处理HTTP请求响应
3. **中间件层** (middleware/) - 处理认证、验证、限流
4. **服务层** (services/) - 核心业务逻辑实现
5. **工具层** (utils/) - 配置管理、日志、上下文

### 关键组件交互

#### 请求流程
```
客户端请求 → AuthMiddleware → RateLimiter → ValidationMiddleware 
→ ChatController → BasicRouter → ReasoningEnhancer → ProviderFactory
→ Byteplus API → 响应处理 → 客户端
```

#### 缓存机制
- **BasicRouter**: LRU缓存路由决策，TTL支持
- **ContextManager**: 会话上下文缓存
- **ConfigManager**: 配置缓存优化

#### 配置管理
- **环境驱动**: 所有配置通过环境变量控制
- **分层配置**: 开发/生产环境分离
- **缓存机制**: ConfigManager实现配置缓存

## 依赖关系

### 核心依赖
```javascript
express: "^4.18.2"          // Web框架
@volcengine/openapi: "^1.32.0" // Byteplus SDK
axios: "^1.5.0"             // HTTP客户端
jsonwebtoken: "^9.0.2"      // JWT认证
winston: "^3.10.0"          // 日志系统
```

### 安全和性能
```javascript
helmet: "^7.2.0"            // 安全头部中间件
cors: "^2.8.5"              // CORS配置
compression: "^1.7.4"       // 响应压缩
express-rate-limit: "^6.11.2" // 速率限制
```

### 开发工具
```javascript
nodemon: "^3.0.1"           // 开发热重载
jest: "^29.7.0"             // 测试框架
eslint: "^8.50.0"           // 代码检查
supertest: "^6.3.3"         // API测试
```

## 数据流

### 输入处理
1. HTTP请求 → 中间件验证 → 控制器解析
2. 用户消息 → 路由分析 → 上下文关联
3. 关键词提取 → 缓存查询 → 路由决策

### AI推理流程
1. BasicRouter确定路由类型 (chat/complex_reasoning/work_assistant)
2. ReasoningEnhancer根据路由应用推理模式
3. ProviderFactory调用对应Byteplus端点
4. Chain-of-Thought或Self-Consistency推理处理
5. 生产模式过滤推理过程，返回最终答案

### 输出处理
1. AI响应 → 推理过程控制 → 格式化
2. 缓存更新 → 性能统计 → 响应返回
3. 日志记录 → 监控指标 → 持久化

## 扩展点

### 新增AI提供商
- 在ProviderFactory中添加新的提供商实现
- 实现统一接口适配不同API格式

### 新增路由类型
- 在BasicRouter中扩展关键词映射
- 添加对应的Byteplus端点配置

### 新增推理模式
- 在ReasoningEnhancer中实现新的推理算法
- 支持可配置的推理参数

### 新增缓存策略
- 扩展LRU缓存支持更多缓存算法
- 添加分布式缓存支持

## 部署架构

### 容器化部署
- 单容器部署：适合开发和小规模生产
- Docker Compose：包含健康检查和日志管理
- Kubernetes：支持集群部署和自动伸缩

### 环境配置
- 开发环境：详细日志，推理过程可见
- 生产环境：清洁输出，性能优化，安全加固
- 测试环境：完整功能验证，性能基准测试

### 监控和维护
- 健康检查端点：/api/v1/health
- 性能指标端点：/api/v1/metrics
- Winston日志系统：结构化日志和错误追踪