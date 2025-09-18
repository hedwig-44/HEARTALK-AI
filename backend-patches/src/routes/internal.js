/**
 * Internal API Routes
 * 提供AI服务专用的内部接口，用于获取对话历史和用户上下文
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

      // 获取用户最近的对话主题（可扩展功能）
      // 这里先返回基础信息，后续可以添加更多上下文数据
      const recentTopics = []; // TODO: 实现主题提取逻辑
      const userProfile = {}; // TODO: 实现用户画像逻辑

      const contextData = {
        user: {
          id: user.id,
          name: user.name || user.username,
          email: user.email,
          preferences: user.preferences || {},
          createdAt: user.created_at
        },
        recentTopics,
        userProfile,
        // 可扩展字段
        metadata: {
          lastActive: user.last_login || user.updated_at,
          totalConversations: 0 // TODO: 添加统计查询
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
 */
router.get('/health',
  validateInternalApiKey,
  (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'internal-api'
      }
    });
  }
);

module.exports = router;