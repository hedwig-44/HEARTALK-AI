# 方案二部署说明

## 概览
本次部署实现了HearTalk AI记忆功能改进方案二，通过添加Internal API解决AI对话上下文缺失问题。

## 文件清单

### 1. 新增文件
```
backend-patches/
├── src/routes/internal.js          # Internal API路由实现
├── app.js.patch                    # app.js修改说明
└── DEPLOYMENT.md                   # 本部署说明文档
```

### 2. 修改文件
```
ai-service/src/services/BackendApiClient.js  # 更新API响应处理
```

## 部署步骤

### Phase 1: 同步到HEARTALK-BE项目

1. **复制Internal API路由**
   ```bash
   cp backend-patches/src/routes/internal.js \
      /Users/lulu/Documents/Work/ai_chat_v2/HEARTALK-BE/backend/src/routes/internal.js
   ```

2. **修改app.js文件**
   
   在 `/Users/lulu/Documents/Work/ai_chat_v2/HEARTALK-BE/backend/src/app.js` 中添加：
   
   ```javascript
   // 在路由导入部分添加（约第20行）
   const internalRoutes = require('./routes/internal');
   
   // 在API路由配置部分添加（约第83行）
   app.use('/internal/api/v1', internalRoutes);
   ```

3. **同步AI服务修改**
   ```bash
   cp ai-service/src/services/BackendApiClient.js \
      /Users/lulu/Documents/Work/ai_chat_v2/HEARTALK-BE/ai-service/src/services/BackendApiClient.js
   ```

### Phase 2: 环境配置

4. **确保环境变量配置**
   
   在 `/Users/lulu/Documents/Work/ai_chat_v2/HEARTALK-BE/.env` 中确保：
   ```env
   HEARTALK_API_KEY=your_internal_api_key_here
   JWT_SECRET=your_jwt_secret_here
   ```

### Phase 3: 服务重启

5. **重启Backend服务**
   ```bash
   cd /Users/lulu/Documents/Work/ai_chat_v2/HEARTALK-BE
   docker-compose restart backend
   ```

6. **重启AI服务**
   ```bash
   docker-compose restart ai-service
   ```

### Phase 4: 功能验证

7. **验证Internal API**
   ```bash
   # 测试健康检查
   curl -H "x-api-key: your_api_key" \
        http://localhost:8000/internal/api/v1/health
   
   # 测试对话历史接口（需要有效的conversation_id）
   curl -H "x-api-key: your_api_key" \
        http://localhost:8000/internal/api/v1/conversations/1/history
   ```

8. **测试AI记忆功能**
   - 登录前端应用
   - 创建新对话，发送包含个人信息的消息
   - 在后续消息中测试AI是否能记住之前的信息

## 回滚方案

如果部署出现问题，按以下步骤回滚：

1. **移除新增路由**
   ```bash
   rm /Users/lulu/Documents/Work/ai_chat_v2/HEARTALK-BE/backend/src/routes/internal.js
   ```

2. **还原app.js**
   从git历史恢复app.js到修改前的版本

3. **还原AI服务文件**
   ```bash
   git checkout HEAD -- ai-service/src/services/BackendApiClient.js
   ```

4. **重启服务**
   ```bash
   docker-compose restart backend ai-service
   ```

## 故障排查

### 常见问题

#### 1. API Key认证失败
**症状**: 401错误，"Invalid API key"
**解决**: 
- 检查.env中HEARTALK_API_KEY配置
- 确保AI服务和Backend使用相同的API Key

#### 2. JWT认证失败
**症状**: 401错误，"Invalid token"
**解决**:
- 检查.env中JWT_SECRET配置
- 确保AI服务和Backend使用相同的JWT Secret

#### 3. 对话历史为空
**症状**: API返回空数组
**解决**:
- 检查数据库中conversations和messages表是否有数据
- 验证conversationId是否正确

#### 4. 服务无法启动
**症状**: Docker容器启动失败
**解决**:
- 检查代码语法错误
- 查看docker-compose logs
- 验证依赖项安装

### 日志位置

- **Backend日志**: `docker-compose logs backend`
- **AI服务日志**: `docker-compose logs ai-service`
- **应用日志**: 查看各服务的console输出

## 性能监控

### 关键指标
- Internal API响应时间 < 200ms
- AI对话响应时间整体无明显增加
- 系统内存使用无显著上升

### 监控命令
```bash
# 查看API性能
docker-compose logs ai-service | grep "Conversation history fetched successfully"

# 监控系统资源
docker stats
```

## 验收标准

### 功能验收
- [ ] AI能记住对话中提到的用户姓名
- [ ] AI能基于历史对话进行连贯回复
- [ ] AI能记住用户的偏好和习惯
- [ ] 新建对话后AI记忆重置正常
- [ ] 多用户之间记忆隔离正常

### 性能验收
- [ ] API响应时间 < 200ms
- [ ] 对话生成时间无明显增加
- [ ] 系统稳定性无影响

### 安全验收
- [ ] Internal API需要正确的API Key才能访问
- [ ] 无API Key或错误API Key返回401错误
- [ ] 用户数据隔离正常，无越权访问

## 后续优化

1. **缓存优化**: 实现更智能的缓存策略
2. **性能调优**: 优化数据库查询和API响应时间
3. **监控完善**: 添加更详细的业务指标监控
4. **错误处理**: 完善异常情况的降级处理

---

**部署完成后请更新此文档的验收状态，并记录任何遇到的问题和解决方案。**