---
created: 2025-09-13T04:21:42Z
last_updated: 2025-09-13T12:35:44Z
version: 1.1
author: Claude Code PM System
---

# 系统模式

## 架构模式

### 微服务架构模式
HearTalk AI MVP采用微服务架构，作为独立的AI推理服务运行，与现有HearTalk后端系统解耦。

```
前端客户端 → HearTalk AI MVP → Byteplus Model Ark
                             → VikingDB
                             → HearTalk Backend (可选集成)
```

**优势**:
- 独立部署和扩展
- 故障隔离和容错
- 技术栈灵活性
- API向后兼容

### 分层架构模式
采用经典的四层架构模式：

```
表现层 (Presentation) → 控制器层 (Controller)
业务层 (Business)     → 服务层 (Service)  
数据层 (Data)         → 集成层 (Integration)
基础层 (Infrastructure) → 工具层 (Utilities)
```

**实现**:
- **表现层**: Express路由和中间件
- **业务层**: ReasoningEnhancer, BasicRouter
- **数据层**: ProviderFactory, 外部API集成
- **基础层**: ConfigManager, Logger, ContextManager

### 事件驱动模式
系统内部采用事件驱动的处理流程：

```javascript
// 请求处理链
Request → Auth Event → Validation Event → Routing Event 
→ Reasoning Event → API Call Event → Response Event
```

## 设计模式应用

### 1. 工厂模式 (Factory Pattern)
**应用**: ProviderFactory创建不同的AI提供商实例

```javascript
// src/services/ProviderFactory.js
class ProviderFactory {
  static createProvider(type) {
    switch(type) {
      case 'byteplus':
        return new ByteplusProvider();
      case 'openai':
        return new OpenAIProvider();
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
  }
}
```

**优势**: 
- 解耦对象创建和使用
- 支持多种AI提供商
- 便于扩展新的提供商

### 2. 策略模式 (Strategy Pattern)
**应用**: ReasoningEnhancer支持多种推理策略

```javascript
// src/services/ReasoningEnhancer.js
class ReasoningEnhancer {
  async applyReasoning(message, routeType) {
    const strategy = this.getReasoningStrategy(routeType);
    return await strategy.process(message);
  }
  
  getReasoningStrategy(routeType) {
    switch(routeType) {
      case 'complex_reasoning':
        return new ChainOfThoughtStrategy();
      case 'work_assistant':
        return new SelfConsistencyStrategy();
      default:
        return new BasicReasoningStrategy();
    }
  }
}
```

**优势**:
- 算法可替换
- 遵循开闭原则
- 支持运行时策略选择

### 3. 装饰器模式 (Decorator Pattern)
**应用**: Express中间件链

```javascript
// 中间件链式装饰
app.use(corsMiddleware);
app.use(helmetMiddleware);
app.use(compressionMiddleware);
app.use(authMiddleware);
app.use(rateLimitMiddleware);
app.use(validationMiddleware);
```

**优势**:
- 职责分离
- 功能组合灵活
- 中间件可插拔

### 4. 观察者模式 (Observer Pattern)
**应用**: 日志和监控系统

```javascript
// 事件监听和日志记录
class SystemMonitor {
  constructor() {
    this.observers = [];
  }
  
  addObserver(observer) {
    this.observers.push(observer);
  }
  
  notify(event) {
    this.observers.forEach(observer => observer.update(event));
  }
}
```

### 5. 单例模式 (Singleton Pattern)
**应用**: ConfigManager配置管理

```javascript
// src/utils/ConfigManager.js
class ConfigManager {
  constructor() {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }
    ConfigManager.instance = this;
    this.configCache = new Map();
  }
  
  static getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
}
```

## 缓存模式

### LRU缓存模式
**实现**: BasicRouter中的路由决策缓存

```javascript
class LRUCache {
  constructor(maxSize, ttl) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item || this.isExpired(item)) {
      this.cache.delete(key);
      return null;
    }
    
    // LRU: 移动到最新位置
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的项
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      expiry: Date.now() + this.ttl
    });
  }
}
```

**应用场景**:
- 路由决策缓存
- 上下文缓存
- 配置缓存

### 写回缓存模式 (Write-Back Cache)
**实现**: 配置变更的延迟写回

```javascript
// 配置变更批量写回
class ConfigCache {
  constructor() {
    this.dirty = new Set();
    this.cache = new Map();
    this.writeBackTimer = null;
  }
  
  set(key, value) {
    this.cache.set(key, value);
    this.dirty.add(key);
    this.scheduleWriteBack();
  }
  
  scheduleWriteBack() {
    if (this.writeBackTimer) return;
    
    this.writeBackTimer = setTimeout(() => {
      this.flushDirtyConfigs();
      this.writeBackTimer = null;
    }, 5000); // 5秒后批量写回
  }
}
```

## 错误处理模式

### 断路器模式 (Circuit Breaker)
**应用**: 外部API调用保护

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureThreshold = threshold;
    this.resetTimeout = timeout;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async call(apiFunction) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await apiFunction();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
}
```

### 重试模式 (Retry Pattern)
**应用**: API调用失败重试

```javascript
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // 指数退避
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      logger.warn(`Retry attempt ${attempt} failed:`, error.message);
    }
  }
}
```

### 优雅降级模式 (Graceful Degradation)
**应用**: AI服务不可用时的降级处理

```javascript
class GracefulDegradation {
  async processRequest(request) {
    try {
      // 尝试完整AI推理
      return await this.fullAIReasoning(request);
    } catch (error) {
      logger.warn('Full AI reasoning failed, degrading:', error.message);
      
      try {
        // 降级到简单AI响应
        return await this.simpleAIResponse(request);
      } catch (error) {
        logger.error('Simple AI failed, using fallback:', error.message);
        
        // 最终降级到预定义响应
        return this.fallbackResponse(request);
      }
    }
  }
}
```

## 安全模式

### 认证装饰器模式
**实现**: JWT认证中间件

```javascript
// src/middleware/AuthMiddleware.js
const authDecorator = (requiredRole = null) => {
  return (req, res, next) => {
    try {
      const token = extractToken(req);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

// 使用装饰器
router.post('/admin', authDecorator('admin'), adminHandler);
router.post('/chat', authDecorator(), chatHandler);
```

### 速率限制模式
**实现**: 滑动窗口算法

```javascript
class SlidingWindowRateLimiter {
  constructor(windowSize, maxRequests) {
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }
  
  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const timestamps = this.requests.get(key);
    
    // 移除过期请求
    while (timestamps.length > 0 && timestamps[0] < windowStart) {
      timestamps.shift();
    }
    
    if (timestamps.length >= this.maxRequests) {
      return false;
    }
    
    timestamps.push(now);
    return true;
  }
}
```

## 数据访问模式

### 仓储模式 (Repository Pattern)
**实现**: 外部API抽象层

```javascript
// 抽象仓储接口
class AIProviderRepository {
  async generateResponse(prompt, options) {
    throw new Error('Must implement generateResponse method');
  }
}

// Byteplus具体实现
class ByteplusRepository extends AIProviderRepository {
  async generateResponse(prompt, options) {
    const response = await axios.post(this.endpoint, {
      model: options.model,
      messages: prompt,
      temperature: options.temperature
    });
    
    return this.transformResponse(response.data);
  }
}
```

### 适配器模式 (Adapter Pattern)
**应用**: 不同AI提供商API适配

```javascript
class OpenAIAdapter {
  constructor(openaiClient) {
    this.client = openaiClient;
  }
  
  async generateResponse(prompt, options) {
    // 适配OpenAI API格式
    const openaiRequest = this.adaptRequest(prompt, options);
    const response = await this.client.chat.completions.create(openaiRequest);
    return this.adaptResponse(response);
  }
  
  adaptRequest(prompt, options) {
    return {
      model: this.mapModel(options.model),
      messages: this.formatMessages(prompt),
      temperature: options.temperature
    };
  }
}
```

## 监控和观测模式

### 指标收集器模式
**实现**: 性能指标统计

```javascript
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
  }
  
  increment(metric, tags = {}) {
    const key = this.buildKey(metric, tags);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + 1);
  }
  
  timer(metric, tags = {}) {
    const key = this.buildKey(metric, tags);
    const start = Date.now();
    
    return {
      stop: () => {
        const duration = Date.now() - start;
        this.recordTiming(key, duration);
      }
    };
  }
  
  snapshot() {
    return {
      counters: Object.fromEntries(this.metrics),
      timestamp: new Date().toISOString()
    };
  }
}
```

### 健康检查模式
**实现**: 系统健康状态监控

```javascript
class HealthChecker {
  constructor() {
    this.checks = new Map();
  }
  
  addCheck(name, checkFunction, timeout = 5000) {
    this.checks.set(name, { checkFunction, timeout });
  }
  
  async runChecks() {
    const results = {};
    
    for (const [name, check] of this.checks) {
      try {
        const result = await Promise.race([
          check.checkFunction(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), check.timeout)
          )
        ]);
        
        results[name] = { status: 'healthy', result };
      } catch (error) {
        results[name] = { status: 'unhealthy', error: error.message };
      }
    }
    
    return results;
  }
}
```

## 配置模式

### 配置工厂模式
**实现**: 环境特定配置创建

```javascript
class ConfigFactory {
  static createConfig(environment) {
    switch (environment) {
      case 'development':
        return new DevelopmentConfig();
      case 'production':
        return new ProductionConfig();
      case 'test':
        return new TestConfig();
      default:
        throw new Error(`Unknown environment: ${environment}`);
    }
  }
}

class ProductionConfig extends BaseConfig {
  constructor() {
    super();
    this.logLevel = 'info';
    this.showReasoningProcess = false;
    this.enableDebugMode = false;
    this.rateLimitStrict = true;
  }
}
```

这些系统模式确保了HearTalk AI MVP的架构清晰、可维护、可扩展，并且具有良好的容错性和安全性。