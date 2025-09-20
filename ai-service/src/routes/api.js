/**
 * API Routes Configuration
 * 配置所有API路由和中间件
 */
import express from 'express';
import { ChatController } from '../controllers/ChatController.js';
import { TranslateController } from '../controllers/TranslateController.js';
import { getLogger } from '../utils/Logger.js';

const router = express.Router();
const logger = getLogger('api-routes');

// 创建控制器实例
const chatController = new ChatController();
const translateController = new TranslateController();

/**
 * API认证中间件（可选实现）
 * 验证JWT token
 */
const authMiddleware = (req, res, next) => {
  // 开发阶段可以跳过认证
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Authentication failed - missing or invalid token', {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTHENTICATION_ERROR',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }

  // 这里可以添加JWT验证逻辑
  // const token = authHeader.substring(7);
  // 验证token...

  next();
};

/**
 * 请求验证中间件
 * 验证请求格式和内容类型
 */
const validateRequest = (req, res, next) => {
  // 验证Content-Type
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(400).json({
      success: false,
      error: 'Content-Type must be application/json',
      code: 'VALIDATION_ERROR',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// ======================
// 聊天相关路由
// ======================

/**
 * 对话生成
 * POST /api/v1/chat/generate
 */
router.post('/chat/generate', 
  validateRequest,
  authMiddleware,
  async (req, res) => {
    await chatController.generateChat(req, res);
  }
);

/**
 * 流式对话
 * POST /api/v1/chat/stream
 */
router.post('/chat/stream',
  validateRequest,
  authMiddleware,
  async (req, res) => {
    await chatController.streamChat(req, res);
  }
);

// ======================
// 系统监控路由
// ======================

/**
 * 健康检查
 * GET /api/v1/health
 */
router.get('/health', async (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'ai-service',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  logger.info('Health check requested', {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // 返回后端期望的格式：{data: {status: 'healthy', ...}}
  res.json({
    data: healthData
  });
});

/**
 * 性能指标
 * GET /api/v1/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    // 这里需要访问 globalMetrics，但它不在路由作用域内
    // 暂时返回基本信息
    res.json({
      timestamp: new Date().toISOString(),
      service: 'ai-service',
      version: '1.0.0',
      message: 'Metrics endpoint available'
    });
  } catch (error) {
    logger.error('Error retrieving metrics', {
      error: error.message,
      requestId: req.requestId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      code: 'INTERNAL_ERROR',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// ======================
// 翻译相关路由
// ======================

/**
 * 文本翻译
 * POST /api/v1/translate
 */
router.post('/translate',
  validateRequest,
  authMiddleware,
  async (req, res) => {
    await translateController.translateText(req, res);
  }
);

/**
 * 获取支持的语言列表
 * GET /api/v1/translate/languages
 */
router.get('/translate/languages',
  authMiddleware,
  async (req, res) => {
    await translateController.getSupportedLanguages(req, res);
  }
);

/**
 * 语言检测
 * POST /api/v1/translate/detect
 */
router.post('/translate/detect',
  validateRequest,
  authMiddleware,
  async (req, res) => {
    await translateController.detectLanguage(req, res);
  }
);

// ======================
// 管理相关路由
// ======================

/**
 * 获取可用Provider列表
 * GET /api/v1/providers
 */
router.get('/providers', authMiddleware, async (req, res) => {
  try {
    logger.info('Providers list requested', {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const providers = [
      {
        id: 'byteplus',
        name: 'Byteplus AI',
        description: 'Byteplus AI service with dual endpoints',
        endpoints: [
          {
            id: 'chat',
            name: '通用对话',
            model: 'skylark-pro-250415',
            capabilities: ['chat', 'completion']
          },
          {
            id: 'work_assistant', 
            name: '工作助理',
            model: 'skylark-pro-250415-work',
            capabilities: ['work_tasks', 'analysis']
          }
        ],
        status: 'active',
        version: '1.0.0'
      }
    ];

    res.json({
      success: true,
      data: {
        providers,
        total: providers.length
      }
    });

  } catch (error) {
    logger.error('Get providers failed', {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve providers',
      code: 'INTERNAL_ERROR',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取可用模型列表  
 * GET /api/v1/models
 */
router.get('/models', authMiddleware, async (req, res) => {
  try {
    logger.info('Models list requested', {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const models = [
      {
        id: 'skylark-pro-250415',
        name: 'Skylark Pro Chat',
        provider: 'byteplus',
        type: 'chat',
        capabilities: [
          'text_generation',
          'conversation',
          'content_creation',
          'question_answering'
        ],
        context_length: 32768,
        max_tokens: 4096,
        pricing: {
          input: '0.001/1k tokens',
          output: '0.002/1k tokens'
        },
        status: 'active'
      },
      {
        id: 'skylark-pro-250415-work',
        name: 'Skylark Pro Work Assistant',
        provider: 'byteplus',
        type: 'work_assistant',
        capabilities: [
          'work_analysis',
          'task_planning',
          'document_processing',
          'professional_writing'
        ],
        context_length: 32768,
        max_tokens: 4096,
        pricing: {
          input: '0.001/1k tokens',
          output: '0.002/1k tokens'
        },
        status: 'active'
      }
    ];

    res.json({
      success: true,
      data: {
        models,
        total: models.length
      }
    });

  } catch (error) {
    logger.error('Get models failed', {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve models',
      code: 'INTERNAL_ERROR', 
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// ======================
// 路由错误处理
// ======================

/**
 * 404处理器（针对API路由）
 */
router.use('*', (req, res) => {
  logger.warn('API endpoint not found', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'ENDPOINT_NOT_FOUND',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

/**
 * API路由错误处理器
 */
router.use((error, req, res, next) => {
  logger.error('Unhandled API error', {
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  // 防止头部已发送的错误
  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// 记录路由初始化
logger.info('API routes initialized', {
  totalRoutes: router.stack.length,
  chatRoutes: 2,
  translateRoutes: 3
});

export default router;