# HearTalk Backend模块MVP依赖需求

> 本文档记录AI服务MVP替换项目中需要HearTalk Backend模块支持的功能需求

## 概述

为了支持新的AI服务MVP模块实现基础的对话上下文管理，HearTalk Backend模块需要开发**2个核心内部API接口**。MVP版本大幅简化了需求，专注于核心功能的快速实现。

## MVP简化范围

### 相比完整版本的简化
- **接口数量**: 从5个减少到2个
- **功能复杂度**: 去除跨会话搜索和复杂元数据管理
- **开发工作量**: 从13人天减少到6人天
- **开发时间**: 从2.5周减少到1.5周

## 内部API接口需求

> 所有内部API都需要支持统一的错误处理和认证机制

### 通用错误响应格式
```javascript
// 所有API的错误响应格式
{
  "error": {
    "code": "ERROR_CODE", 
    "message": "错误描述"
  },
  "timestamp": "2024-03-15T10:30:00Z",
  "requestId": "uuid"
}

// MVP常见错误码
- CONVERSATION_NOT_FOUND: 对话不存在
- ACCESS_DENIED: 用户无权限访问  
- INVALID_PARAMETERS: 请求参数错误
- INTERNAL_SERVER_ERROR: 内部服务器错误
```

### 通用请求头
```javascript
// 所有内部API请求都需要包含以下认证头
Headers: {
  "X-Internal-Service": "ai-service",
  "X-Service-Token": "jwt-service-token",
  "X-User-Context": "base64-encoded-user-info",
  "Content-Type": "application/json"
}
```

### 1. 对话历史获取接口 (简化版)

**接口描述**: 获取指定对话的最近历史记录  
**优先级**: P0 (Phase 2需要)

```javascript
GET /internal/api/v1/conversations/:id/history

// 查询参数 (简化版)
?limit=10              // 固定获取最近10条消息
&include_system=false  // 不包含系统消息

// 响应格式 (简化版)
{
  conversationId: "uuid",
  messages: [
    {
      messageId: "uuid", 
      role: "user|assistant",
      content: "消息内容",
      timestamp: "2024-03-15T10:30:00Z"
    }
  ],
  totalMessages: 10,
  conversationCreatedAt: "2024-03-15T09:00:00Z"
}

// 错误响应
// 404 - 对话不存在
{
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "指定的对话不存在或用户无权限访问"
  }
}
```

### 2. 用户基础信息接口 (简化版)

**接口描述**: 获取用户的基础上下文信息，用于权限控制  
**优先级**: P0 (Phase 2需要)

```javascript
GET /internal/api/v1/users/:id/context

// 响应格式 (简化版)
{
  userId: "uuid",
  username: "张三",
  userRole: "user|manager|admin", 
  companyId: "uuid",
  permissions: ["read_conversations"]
}

// 错误响应  
// 404 - 用户不存在
{
  "error": {
    "code": "USER_NOT_FOUND", 
    "message": "指定的用户不存在"
  }
}
```

## MVP去除的接口 (留待后续版本)

### 完整版本中不在MVP实现的接口
- ❌ **跨会话搜索接口** - 复杂的语义搜索留待v2.0
- ❌ **对话元数据更新接口** - 详细监控留待v2.0  
- ❌ **批量对话查询接口** - 批量操作留待v2.0

## 认证和权限要求

### 内部服务认证 (简化版)
**认证机制实现:**
```javascript
// MVP版本的简化认证
const headers = {
  'X-Internal-Service': 'ai-service',
  'X-Service-Token': generateSimpleJWT({
    service: 'ai-service',
    expiresIn: '2h'
  }),
  'X-User-Context': base64Encode({
    userId: 'uuid',
    userRole: 'user'
  })
};
```

**安全控制 (基础版):**
- 所有 `/internal/api/*` 接口仅允许AI服务调用
- 使用简化的JWT认证token
- 配置IP白名单：127.0.0.1, localhost
- 基础API调用频率限制：500 req/min

### 用户权限验证 (简化版)
```javascript
// Backend中的简化权限验证
function validateUserAccess(userId, conversationId) {
  // 基础验证：用户是否有权访问该对话
  return {
    hasAccess: boolean,
    userId: 'uuid'
  };
}
```

## 性能要求 (放宽版)

| 接口 | 响应时间要求 | 并发支持 | 缓存策略 |
|------|-------------|---------|----------|
| 对话历史获取 | < 500ms | 30 req/s | Redis缓存15分钟 |
| 用户上下文 | < 200ms | 50 req/s | 缓存30分钟 |

## 数据库影响评估 (MVP简化版)

### 基础索引需求 (简化版)
```sql
-- MVP版本只需要基础索引
-- 支持对话历史查询
CREATE INDEX idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC)
LIMIT 10; -- 只查询最近10条

-- 支持用户查询
CREATE INDEX idx_users_id ON users(id);
```

### 无需表结构变更
- MVP版本不需要修改现有数据库表结构
- 使用现有字段即可满足需求

## 部署和监控要求 (基础版)

### 部署配置 (简化版)
- 内部API接口使用基础路由配置
- 简化的错误处理和日志记录
- 支持基础降级，AI服务不可用时返回友好错误

### 监控指标 (基础版)
- 内部API调用频率和响应时间
- 基础错误率统计
- 简单的健康检查

## 开发优先级和时间规划 (MVP版本)

### 重新评估的MVP工作量

| Phase | Backend开发任务 | 预估工作量 | 时间线 |
|-------|-----------------|------------|--------|
| Phase 2 | 对话历史获取接口 + 用户上下文接口 | 4人天 | 与AI服务并行开发 |
| Phase 4 | 性能优化和缓存配置 | 1人天 | 优化阶段 |
| Phase 5 | 生产环境部署和监控 | 1人天 | 部署阶段 |
| **总计** | **MVP Backend内部API开发** | **6人天** | **需要1.5周** |

**时间节省:**
- 相比完整版本节省7人天（54%）
- 开发时间从2.5周缩短到1.5周

## 测试策略 (简化版)

### MVP测试重点
- 为2个内部API接口编写基础单元测试
- 模拟AI服务调用场景进行集成测试
- 验证基础权限控制机制
- 确保API响应格式兼容

### 测试覆盖范围
- API接口功能正确性 ✅
- 基础权限验证 ✅
- 错误处理机制 ✅
- 简化性能测试 ✅

---

**MVP重要提醒**: 
- 这些接口仅为AI服务MVP内部使用，不应暴露给前端或外部系统
- 专注于核心功能实现，避免过度设计
- 重点确保API兼容性和基础稳定性
- 为后续完整版本的扩展预留架构空间

**MVP成功标准**: 6人天内完成2个核心接口，确保AI服务MVP能够正常获取对话历史和用户信息。