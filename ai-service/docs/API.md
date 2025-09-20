# HearTalk AI MVP API 文档

## 概述

HearTalk AI MVP提供RESTful API接口，支持AI对话生成、系统监控、健康检查等功能。所有API均遵循OpenAPI 3.0规范。

**基础URL**: `http://localhost:8001` (开发环境)

## 认证

目前版本使用JWT认证机制，生产环境需要配置有效的JWT密钥。

```http
Authorization: Bearer <jwt_token>
```

## 系统监控端点

### 1. 健康检查

获取系统健康状态和基础信息。

```http
GET /api/v1/health
```

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-11T10:03:53.614Z",
  "version": "1.0.0",
  "service": "ai-service",
  "uptime": 2.989,
  "memory": {
    "rss": 71581696,
    "heapTotal": 20185088,
    "heapUsed": 10331064,
    "external": 2286673,
    "arrayBuffers": 18639
  },
  "environment": "development"
}
```

### 2. 性能监控指标

获取详细的系统性能指标和使用统计。

```http
GET /api/v1/metrics
```

**响应示例**:
```json
{
  "timestamp": "2025-09-11T10:03:53.623Z",
  "service": "ai-service",
  "version": "1.0.0",
  "metrics": {
    "uptime": 120,
    "requests": {
      "total": 45,
      "success": 42,
      "errors": 3,
      "rate": 22
    },
    "responseTime": {
      "total": 2340,
      "count": 45,
      "min": 12,
      "max": 156,
      "avg": 52
    },
    "statusCodes": {
      "2xx": 42,
      "4xx": 2,
      "5xx": 1
    },
    "endpoints": {
      "GET /api/v1/health": {
        "count": 25,
        "totalTime": 485,
        "avgTime": 19,
        "minTime": 12,
        "maxTime": 32,
        "errors": 0
      }
    },
    "system": {
      "memory": {
        "rss": 71581696,
        "heapTotal": 20185088,
        "heapUsed": 10331064
      },
      "cpu": {
        "user": 123456,
        "system": 78901
      },
      "version": "v18.17.0",
      "platform": "darwin",
      "arch": "arm64"
    }
  }
}
```

### 3. 重置监控数据

重置性能监控数据（开发/测试环境使用）。

```http
POST /api/v1/metrics/reset
```

**响应示例**:
```json
{
  "message": "Metrics reset successfully",
  "timestamp": "2025-09-11T10:05:23.145Z"
}
```

## AI服务端点 (Phase 2实现)

### 1. 对话生成

生成AI对话响应，支持智能端点路由。

```http
POST /api/v1/chat/generate
Content-Type: application/json
```

**请求体**:
```json
{
  "conversation_id": "conv_12345",
  "message": "帮我制定一个工作计划",
  "user_id": "user_67890",
  "options": {
    "endpointType": "work_assistant",
    "modelParams": {
      "temperature": 0.7,
      "max_tokens": 2000
    }
  }
}
```

**参数说明**:
- `conversation_id`: 对话会话ID
- `message`: 用户消息内容
- `user_id`: 用户唯一标识
- `options.endpointType`: 指定端点类型 (`chat` | `work_assistant`)
- `options.modelParams`: 模型参数配置

**响应示例**:
```json
{
  "success": true,
  "data": {
    "content": "我来帮你制定一个详细的工作计划...",
    "conversation_id": "conv_12345",
    "finish_reason": "stop",
    "usage": {
      "completion_tokens": 150,
      "prompt_tokens": 25,
      "total_tokens": 175
    }
  },
  "provider": "byteplus",
  "endpoint": "ep-20250826180754-nwjhn"
}
```

### 2. 流式对话

支持流式响应的对话生成。

```http
POST /api/v1/chat/stream
Content-Type: application/json
```

**请求体**:
```json
{
  "conversation_id": "conv_12345",
  "message": "什么是人工智能？",
  "user_id": "user_67890"
}
```

**响应**: Server-Sent Events (SSE)格式

```
data: {"content": "人工智能", "done": false}

data: {"content": "（Artificial Intelligence，AI）", "done": false}

data: {"content": "是一门计算机科学技术...", "done": false}

data: {"done": true}
```

### 3. 文本翻译

使用AI进行文本翻译。

```http
POST /api/v1/translate
Content-Type: application/json
```

**请求体**:
```json
{
  "text": "Hello, how are you today?",
  "target_language": "中文"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "original_text": "Hello, how are you today?",
    "translated_text": "你好，你今天过得怎么样？",
    "target_language": "中文"
  },
  "provider": "byteplus"
}
```

## 智能端点路由

系统会根据消息内容自动选择合适的AI端点：

### 通用对话端点 (`ep-20250819170822-q2vnf`)
**用途**: 日常对话、知识问答、创意写作、编程帮助等

**示例查询**:
- "你好世界"
- "什么是人工智能？"
- "帮我写一首诗"
- "解释一下JavaScript闭包"

### 工作助理端点 (`ep-20250826180754-nwjhn`)
**用途**: 工作计划、任务管理、项目分析、商务文档等

**触发关键词**: 工作、任务、项目、计划、安排、会议、报告、分析

**示例查询**:
- "帮我制定工作计划"
- "如何管理项目任务？"
- "写一份会议报告"
- "分析这个方案的可行性"

**特殊配置**:
- 超时时间: 60秒（响应时间较长）
- 推荐用于复杂的工作规划和详细分析

## 错误处理

所有API使用统一的错误响应格式：

```json
{
  "success": false,
  "error": "错误描述",
  "code": "ERROR_CODE",
  "requestId": "req_1234567890_abcdefghi",
  "timestamp": "2025-09-11T10:15:30.123Z"
}
```

**常见错误码**:
- `VALIDATION_ERROR`: 请求参数验证失败
- `AUTHENTICATION_ERROR`: 认证失败
- `RATE_LIMIT_EXCEEDED`: 超出速率限制
- `AI_PROVIDER_ERROR`: AI服务提供商错误
- `TIMEOUT_ERROR`: 请求超时
- `INTERNAL_ERROR`: 内部服务器错误

## 速率限制

为了保证服务稳定性，API实施速率限制：

- **默认限制**: 每IP每15分钟100个请求
- **限制头部**:
  - `X-RateLimit-Limit`: 速率限制
  - `X-RateLimit-Remaining`: 剩余请求数
  - `X-RateLimit-Reset`: 重置时间

**超出限制时的响应**:
```json
{
  "error": "Too many requests from this IP, please try again later.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

## 日志和调试

系统提供完整的请求日志记录：

### 请求追踪
每个请求都分配唯一的`requestId`，用于日志追踪和问题排查。

### 日志级别
- `error`: 错误日志
- `warn`: 警告日志（4xx状态码）
- `info`: 信息日志（正常请求）
- `debug`: 调试日志（详细信息）

### 敏感数据处理
系统自动脱敏以下敏感信息：
- API密钥
- 用户密码
- JWT令牌
- 其他包含关键词的敏感字段

## 版本信息

**当前版本**: v1.0.0  
**API版本**: v1  
**兼容性**: 向后兼容HearTalk原始API

## 联系和支持

如有API使用问题，请：
1. 检查请求格式和参数
2. 查看系统日志(`logs/app.log`)
3. 使用健康检查端点验证服务状态
4. 提交GitHub Issue