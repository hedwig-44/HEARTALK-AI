# HearTalk Backend模块依赖需求

> 本文档记录AI服务替换项目中需要HearTalk Backend模块支持的功能需求

## 概述

为了支持新的AI服务模块实现三层上下文引用架构，HearTalk Backend模块需要开发以下内部API接口。这些接口**仅供AI服务内部调用**，不对前端或外部系统开放。

## 内部API接口需求

### 1. 对话历史获取接口

**接口描述**: 获取指定对话的完整历史记录  
**优先级**: P0 (Phase 2需要)

```javascript
GET /internal/api/v1/conversations/:id/history

// 可选查询参数
?limit=50              // 限制消息数量，默认50
&offset=0              // 分页偏移量
&include_system=false  // 是否包含系统消息

// 响应格式
{
  conversationId: "uuid",
  messages: [
    {
      messageId: "uuid",
      role: "user|assistant|system",
      content: "消息内容",
      timestamp: "2024-03-15T10:30:00Z",
      tokenCount: 150,
      metadata: { // 可选元数据
        aiModel: "byteplus-work-assistant",
        processingTime: 800
      }
    }
  ],
  totalMessages: 120,
  totalTokens: 15000,
  conversationCreatedAt: "2024-03-15T09:00:00Z"
}
```

### 2. 跨会话语义搜索接口

**接口描述**: 搜索用户的相关历史对话，支持项目上下文关联  
**优先级**: P1 (Phase 3需要)

```javascript
POST /internal/api/v1/conversations/search

// 请求体
{
  userId: "uuid",
  excludeConversationId: "uuid",  // 排除当前对话
  keywords: ["项目A", "进度", "团队"], // 关键词数组
  timeRange: "7d",  // 时间范围：1d, 7d, 30d, all
  limit: 5,         // 返回结果数量限制
  includeContent: true  // 是否返回消息内容摘要
}

// 响应格式
{
  totalFound: 12,
  conversations: [
    {
      conversationId: "uuid",
      title: "项目A进度讨论",
      lastMessageAt: "2024-03-14T15:30:00Z",
      relevanceScore: 0.85,
      matchingKeywords: ["项目A", "进度"],
      messageCount: 25,
      summary: "讨论了项目A的当前进度和下个阶段安排", // 可选
      keyMessages: [ // 最相关的消息片段
        {
          messageId: "uuid",
          content: "项目A目前完成度60%，预计下周完成测试阶段",
          timestamp: "2024-03-14T14:00:00Z",
          score: 0.92
        }
      ]
    }
  ]
}
```

### 3. 用户上下文信息接口

**接口描述**: 获取用户的基础上下文信息，用于权限控制和个性化  
**优先级**: P1 (Phase 3需要)

```javascript
GET /internal/api/v1/users/:id/context

// 响应格式
{
  userId: "uuid",
  username: "张三",
  userRole: "manager|employee|admin",
  companyId: "uuid",
  companyName: "科技公司A",
  department: "产品研发部",
  recentProjects: [
    {
      projectId: "uuid",
      projectName: "项目A",
      role: "负责人",
      lastActivity: "2024-03-15T10:00:00Z"
    }
  ],
  preferences: {
    language: "zh-CN",
    timezone: "Asia/Shanghai",
    workHours: "09:00-18:00"
  },
  permissions: ["read_conversations", "create_projects"]
}
```

### 4. 对话元数据更新接口

**接口描述**: 更新对话的AI处理元数据，用于监控和优化  
**优先级**: P2 (Phase 4需要)

```javascript
PATCH /internal/api/v1/conversations/:id/metadata

// 请求体
{
  aiModel: "byteplus-work-assistant",
  endpointUsed: "BYTEPLUS_AMI_OFFICE_COLLABORATION_EP",
  tokenUsed: 1500,
  processingTime: 800,        // 毫秒
  contextLayers: ["conversation", "project", "global"],
  vectorQueries: 3,           // Vector搜索次数
  searchResults: 5,           // 检索到的相关结果数
  cacheHit: false,           // 是否命中缓存
  confidence: 0.85           // AI回答置信度
}

// 响应格式
{
  success: true,
  conversationId: "uuid",
  updatedAt: "2024-03-15T10:30:00Z"
}
```

### 5. 批量对话查询接口

**接口描述**: 批量获取多个对话的基础信息，用于项目关联分析  
**优先级**: P2 (Phase 4需要)

```javascript
POST /internal/api/v1/conversations/batch

// 请求体
{
  conversationIds: ["uuid1", "uuid2", "uuid3"],
  fields: ["title", "lastMessageAt", "messageCount", "participants"]
}

// 响应格式
{
  conversations: [
    {
      conversationId: "uuid1",
      title: "项目讨论",
      lastMessageAt: "2024-03-15T10:00:00Z",
      messageCount: 45,
      participants: ["user1", "user2"]
    }
  ],
  notFound: ["uuid3"]
}
```

## 认证和权限要求

### 内部服务认证
- 所有 `/internal/api/*` 接口仅允许AI服务调用
- 使用专用的服务间认证token或API Key
- 配置IP白名单限制访问来源

### 用户权限验证
- 确保AI服务只能访问用户有权限的对话数据
- 支持基于用户角色的数据过滤
- 记录所有内部API调用日志用于审计

## 性能要求

| 接口 | 响应时间要求 | 并发支持 | 缓存策略 |
|------|-------------|---------|----------|
| 对话历史获取 | < 200ms | 50 req/s | Redis缓存30分钟 |
| 跨会话搜索 | < 500ms | 20 req/s | 查询结果缓存5分钟 |
| 用户上下文 | < 100ms | 100 req/s | 缓存1小时 |
| 元数据更新 | < 100ms | 100 req/s | 无需缓存 |

## 数据库影响评估

### 新增索引需求
```sql
-- 支持跨会话搜索的复合索引
CREATE INDEX idx_messages_user_content_search 
ON messages(user_id, created_at DESC, content);

-- 支持对话元数据查询
CREATE INDEX idx_conversations_user_updated 
ON conversations(user_id, updated_at DESC);

-- 支持关键词搜索（如果使用全文搜索）
CREATE INDEX idx_messages_content_fulltext 
ON messages USING GIN(to_tsvector('english', content));
```

### 表结构扩展建议
```sql
-- 在conversations表添加元数据字段
ALTER TABLE conversations 
ADD COLUMN ai_metadata JSONB DEFAULT '{}';

-- 在messages表添加向量相关字段
ALTER TABLE messages 
ADD COLUMN processing_metadata JSONB DEFAULT '{}';
```

## 部署和监控要求

### 部署配置
- 内部API接口需要独立的路由配置
- 配置专用的错误处理和日志记录
- 支持优雅降级，当AI服务不可用时不影响主要功能

### 监控指标
- 内部API调用频率和响应时间
- 数据库查询性能监控
- 缓存命中率统计
- 错误率和失败重试统计

## 开发和测试建议

### VikingDB Collection访问需求

**新增专用Collection:**
```javascript
// AI服务需要在VikingDB中创建新的Collection
const conversationContextsCollection = {
  name: 'conversation_contexts',
  description: '对话上下文专用存储库',
  dimensions: 1536, // 向量维度
  indexType: 'IVF_FLAT',
  fields: [
    { name: 'conversationId', type: 'STRING' },
    { name: 'userId', type: 'STRING' },
    { name: 'layer', type: 'STRING' }, // conversation, project, global
    { name: 'summary', type: 'TEXT' },
    { name: 'keyPoints', type: 'ARRAY' },
    { name: 'entities', type: 'JSON' },
    { name: 'timestamp', type: 'TIMESTAMP' },
    { name: 'vector', type: 'VECTOR' }
  ]
};
```

### 开发优先级和时间规划

**重新评估的工作量和时间线**

| Phase | Backend开发任务 | 预估工作量 | 时间线 |
|-------|-----------------|------------|--------|
| Phase 2 | 对话历史获取接口 + 用户上下文接口 | 3人天 | 与 AI服务并行开发 |
| Phase 3 | 跨会话搜索 + 元数据更新接口 | 5人天 | 需要数据库索引优化 |
| Phase 4 | 批量查询 + 性能优化 | 3人天 | 与 AI服务并行开发 |
| Phase 6 | 生产环境部署 + 监控 | 2人天 | 部署阶段 |
| **总计** | **所有Backend内部API开发** | **13人天** | **需要至少 2.5周** |

**关键风险:**
- 跨会话搜索的数据库性能优化工作量被低估
- VikingDB新Collection的创建和配置需要额外时间
- 内部API的安全和权限控制实施需要仔细设计

### 测试策略
- 为每个内部API接口编写单元测试和集成测试
- 模拟AI服务的调用场景进行端到端测试
- 进行性能压力测试确保满足并发要求
- 验证权限控制和数据安全机制
- 测试VikingDB Collection的向量存储和检索功能

---

**重要提醒**: 这些接口仅为AI服务内部使用，绝不应暴露给前端或外部系统。开发时必须确保适当的访问控制、安全措施和审计日志。建议在开发初期就进行安全审查和渗透测试。