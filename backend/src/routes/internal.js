/**
 * Internal API Routes
 * 提供AI服务专用的内部接口，用于获取对话历史和用户上下文
 * 
 * @fileoverview HearTalk Backend Internal API - 为AI服务提供数据查询接口
 * @version 1.0.0
 * @author Claude Code AI Assistant
 * 
 * API端点：
 * - GET /internal/api/v1/conversations/{id}/history - 获取对话历史记录
 * - GET /internal/api/v1/users/{id}/context - 获取用户上下文信息
 * - GET /internal/api/v1/health - 健康检查和系统状态
 * 
 * 认证：
 * - 需要有效的API密钥 (X-API-Key header)
 * - API密钥通过环境变量 HEARTALK_API_KEY 配置
 * 
 * 响应格式：
 * {
 *   "success": boolean,
 *   "data": object,
 *   "meta"?: object    // 可选的元数据字段
 * }
 * 
 * 错误响应：
 * {
 *   "success": false,
 *   "error": string,
 *   "code": string
 * }
 * 
 * 性能要求：
 * - API响应时间目标 < 200ms
 * - 健康检查响应时间 < 1000ms
 * - 支持分页查询以优化大数据集性能
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');

// Import services
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const userService = require('../services/userService');

/**
 * Internal API Key验证中间件
 * 确保只有授权的内部服务可以访问这些接口
 */
const validateInternalApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.HEARTALK_API_KEY;

    if (!expectedApiKey) {
      logger.error('HEARTALK_API_KEY not configured in environment');
      return res.status(500).json({ 
        success: false, 
        error: 'Internal API not configured',
        code: 'CONFIG_ERROR'
      });
    }

    if (!apiKey) {
      logger.warn('Missing API key in internal API request', {
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({ 
        success: false, 
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    if (apiKey !== expectedApiKey) {
      logger.warn('Invalid API key in internal API request', {
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        providedKey: apiKey.substring(0, 8) + '...' // 只记录前8位用于调试
      });
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    logger.debug('Internal API key validation successful', {
      path: req.path,
      ip: req.ip
    });

    next();
  } catch (error) {
    logger.error('Error in internal API key validation', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * 获取对话历史记录
 * GET /internal/api/v1/conversations/:id/history
 */
router.get('/conversations/:id/history', 
  validateInternalApiKey,
  async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      // 验证conversationId
      if (isNaN(conversationId) || conversationId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid conversation ID',
          code: 'INVALID_CONVERSATION_ID'
        });
      }

      // 验证limit范围
      if (limit <= 0 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be between 1 and 100',
          code: 'INVALID_LIMIT'
        });
      }

      logger.debug('Fetching conversation history', {
        conversationId,
        limit,
        offset
      });

      // 先检查对话是否存在
      const conversation = await conversationService.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        });
      }

      // 获取消息历史
      const messages = await messageService.getByConversationId(conversationId, {
        limit,
        offset,
        orderBy: 'created_at',
        order: 'ASC' // 按时间正序，确保上下文顺序正确
      });

      // 转换为AI服务需要的格式
      const formattedMessages = messages.map(msg => ({
        role: msg.role, // 'user' 或 'assistant'
        content: msg.content,
        timestamp: msg.created_at,
        messageId: msg.id
      }));

      logger.info('Successfully fetched conversation history', {
        conversationId,
        messageCount: formattedMessages.length,
        requestLimit: limit
      });

      res.json({
        success: true,
        data: formattedMessages,
        meta: {
          conversationId,
          totalCount: formattedMessages.length,
          limit,
          offset,
          hasMore: formattedMessages.length === limit // 简单判断是否还有更多数据
        }
      });

    } catch (error) {
      logger.error('Failed to fetch conversation history', {
        conversationId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversation history',
        code: 'FETCH_HISTORY_ERROR'
      });
    }
  }
);

/**
 * 获取用户上下文信息
 * GET /internal/api/v1/users/:id/context
 */
router.get('/users/:id/context',
  validateInternalApiKey, 
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // 验证userId
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          code: 'INVALID_USER_ID'
        });
      }

      logger.debug('Fetching user context', { userId });

      // 获取用户基本信息
      const user = await userService.getById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // 获取用户统计信息
      const userStats = await userService.getStats(userId);
      const conversationStats = await conversationService.getStats(userId);

      // 获取用户最近的对话（限制5条）
      const recentConversations = await conversationService.getByUserId(userId, {
        limit: 5,
        offset: 0
      });

      // 构建用户上下文数据
      const contextData = {
        user: {
          id: user.id,
          name: user.name || user.username,
          email: user.email,
          preferences: user.preferences || {},
          createdAt: user.created_at,
          accountAge: userStats?.accountAge || 0
        },
        recentConversations: recentConversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          status: conv.status,
          lastUpdated: conv.updated_at
        })),
        statistics: {
          totalConversations: conversationStats?.totalConversations || 0,
          activeConversations: conversationStats?.activeConversations || 0,
          lastConversationDate: conversationStats?.lastConversationDate || null
        },
        // 用户活动元数据
        metadata: {
          lastActive: user.last_login || user.updated_at,
          lastConversationDate: conversationStats?.lastConversationDate,
          isActiveUser: conversationStats?.totalConversations > 0
        }
      };

      logger.info('Successfully fetched user context', {
        userId,
        userName: user.name || user.username
      });

      res.json({
        success: true,
        data: contextData
      });

    } catch (error) {
      logger.error('Failed to fetch user context', {
        userId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch user context',
        code: 'FETCH_CONTEXT_ERROR'
      });
    }
  }
);

/**
 * 健康检查接口
 * GET /internal/api/v1/health
 * 提供系统健康状态、性能指标和服务信息
 */
router.get('/health',
  validateInternalApiKey,
  async (req, res) => {
    try {
      const startTime = Date.now();

      // 获取系统信息
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      // 测试数据库连接（通过快速查询）
      let dbStatus = 'healthy';
      let dbResponseTime = 0;
      try {
        const dbStartTime = Date.now();
        await userService.getById(1); // 快速测试查询
        dbResponseTime = Date.now() - dbStartTime;
      } catch (error) {
        dbStatus = 'unhealthy';
        logger.warn('Database health check failed', {
          error: error.message
        });
      }

      const responseTime = Date.now() - startTime;

      // 判断整体健康状态
      const isHealthy = dbStatus === 'healthy' && responseTime < 1000;

      const healthData = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        service: 'heartalk-backend-internal-api',
        version: '1.0.0',
        uptime: {
          seconds: Math.floor(uptime),
          human: formatUptime(uptime)
        },
        performance: {
          responseTime: `${responseTime}ms`,
          dbResponseTime: `${dbResponseTime}ms`,
          memoryUsage: {
            used: formatBytes(memoryUsage.heapUsed),
            total: formatBytes(memoryUsage.heapTotal),
            external: formatBytes(memoryUsage.external)
          }
        },
        components: {
          database: {
            status: dbStatus,
            responseTime: `${dbResponseTime}ms`
          },
          api: {
            status: 'healthy',
            responseTime: `${responseTime}ms`
          }
        },
        environment: process.env.NODE_ENV || 'development'
      };

      // 记录健康检查日志
      logger.info('Health check completed', {
        status: healthData.status,
        responseTime,
        dbResponseTime,
        memoryUsed: memoryUsage.heapUsed
      });

      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: healthData
      });

    } catch (error) {
      logger.error('Health check failed', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'heartalk-backend-internal-api',
          error: 'Health check failed'
        }
      });
    }
  }
);

/**
 * 格式化运行时间
 * @param {number} uptimeSeconds - 运行时间（秒）
 * @returns {string} 格式化的运行时间
 */
function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * 格式化字节数
 * @param {number} bytes - 字节数
 * @returns {string} 格式化的字节数
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;