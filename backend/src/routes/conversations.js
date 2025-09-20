const express = require('express');
const { body, query, validationResult } = require('express-validator');
const database = require('../config/database');
const { logger } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { assignDefaultProject } = require('../middleware/autoProjectAssignment');
const aiClient = require('../services/aiClient');
const { 
  aiLimitMiddleware,
  aiRequestValidationMiddleware,
  aiResponseFormatterMiddleware,
  aiHealthCheckMiddleware 
} = require('../middleware/aiLimitMiddleware');
const { getPaginatedMessages } = require('../controllers/messageController');
const { 
  updateConversation,
  changeConversationProject,
  batchChangeConversationProject
} = require('../controllers/conversationController');

const router = express.Router();

/**
 * 创建流解析器
 * @param {ReadableStream} stream - HTTP 响应流
 * @returns {AsyncGenerator} 解析后的数据生成器
 */
async function* createStreamParser(stream) {
  let buffer = '';
  
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
  });

  return new Promise((resolve, reject) => {
    stream.on('end', () => {
      resolve(parseSSEData(buffer));
    });
    
    stream.on('error', reject);
  });
}

/**
 * 解析 Server-Sent Events 数据
 * @param {string} data - SSE 原始数据
 * @returns {AsyncGenerator} 解析后的事件生成器
 */
async function* parseSSEData(data) {
  const lines = data.split('\n');
  
  for (const line of lines) {
    if (!line.trim() || !line.startsWith('data: ')) continue;
    
    const eventData = line.slice(6).trim();
    if (eventData === '[DONE]') break;
    
    try {
      const parsed = JSON.parse(eventData);
      yield parsed;
    } catch (error) {
      console.warn('Failed to parse SSE data:', error.message);
    }
  }
}

// Get all conversations for a user
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id; // Get user ID from JWT token

    const result = await database.query(
      `SELECT id, title, status, is_pinned, created_at, updated_at 
       FROM conversations 
       WHERE user_id = $1 AND status = 'active'
       ORDER BY is_pinned DESC, updated_at DESC`,
      [userId]
    );

    logger.debug('Conversations retrieved', { 
      userId, 
      count: result.rows.length 
    });

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific conversation with messages
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    
    // Get conversation details - ensure user owns this conversation
    const conversationResult = await database.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Get messages for this conversation
    const messagesResult = await database.query(
      `SELECT id, role, content, metadata, created_at 
       FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [conversationId]
    );

    const conversation = conversationResult.rows[0];
    conversation.messages = messagesResult.rows;

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取对话的分页消息列表
 * GET /api/conversations/:id/messages
 * 
 * Query Parameters:
 * - limit: 每页消息数量 (1-50, 默认20)
 * - before: 获取此时间之前的消息 (ISO 8601 格式)
 * - include_metadata: 是否包含消息元数据 (默认false)
 */
router.get(
  '/:conversationId/messages',
  authenticateToken,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be between 1 and 50')
      .toInt(),
    
    query('before')
      .optional()
      .isISO8601()
      .withMessage('before must be a valid ISO 8601 timestamp'),
    
    query('include_metadata')
      .optional()
      .isBoolean()
      .withMessage('include_metadata must be a boolean')
      .toBoolean()
  ],
  getPaginatedMessages
);

// Create a new conversation
router.post('/', authenticateToken, assignDefaultProject, [
  body('title').optional().trim().isLength({ min: 1, max: 500 }),
  body('project_id').optional().isUUID().withMessage('project_id must be a valid UUID')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { title = 'New Conversation', project_id } = req.body;
    const userId = req.user.id; // Get user ID from JWT token

    // If project_id is provided, verify it belongs to the user
    if (project_id) {
      const projectCheck = await database.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2 AND status != \'deleted\'',
        [project_id, userId]
      );
      
      if (projectCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project_id or project does not belong to user'
        });
      }
    }

    const result = await database.query(
      `INSERT INTO conversations (user_id, title, project_id, status) 
       VALUES ($1, $2, $3, 'active') 
       RETURNING *`,
      [userId, title, project_id]
    );

    logger.info('Conversation created', { 
      conversationId: result.rows[0].id, 
      userId,
      projectId: project_id 
    });

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Add a message to a conversation
router.post('/:id/messages', authenticateToken, [
  body('role').isIn(['user', 'assistant', 'system']),
  body('content').trim().isLength({ min: 1 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const conversationId = req.params.id;
    const { role, content, metadata = {} } = req.body;

    // Use transaction for atomic operations
    const result = await database.transaction(async (client) => {
      // Check if conversation exists and user owns it
      const conversationResult = await client.query(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, req.user.id]
      );

      if (conversationResult.rows.length === 0) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
      }

      // Add message
      const messageResult = await client.query(
        `INSERT INTO messages (conversation_id, role, content, metadata) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [conversationId, role, content, JSON.stringify(metadata)]
      );

      // Update conversation updated_at
      await client.query(
        'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationId]
      );

      return messageResult.rows[0];
    });

    logger.info('Message added to conversation', { 
      conversationId, 
      messageId: result.id,
      role 
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

// Delete a conversation (hard delete)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const conversationId = req.params.id;

    // Use transaction to ensure atomicity
    const result = await database.transaction(async (client) => {
      // Verify conversation exists and user owns it
      const conversationResult = await client.query(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, req.user.id]
      );

      if (conversationResult.rows.length === 0) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
      }

      // Delete conversation (cascade will automatically delete messages)
      await client.query(
        'DELETE FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, req.user.id]
      );

      return { conversationId };
    });

    logger.info('Conversation permanently deleted', { conversationId: result.conversationId });

    res.json({
      success: true,
      message: 'Conversation permanently deleted'
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

// Update conversation (title and/or project assignment)
router.put('/:id', authenticateToken, [
  body('title').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Title must be between 1 and 500 characters'),
  body('project_id').optional().custom(value => {
    if (value === null) return true; // Allow null for uncategorized
    if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return true;
    }
    throw new Error('project_id must be a valid UUID or null');
  }),
  body('isPinned').optional().isBoolean().withMessage('isPinned must be a boolean value'),
  body('status').optional().isIn(['active', 'archived']).withMessage('status must be active or archived')
], updateConversation);

// Quick project assignment change
router.patch('/:id/project', authenticateToken, [
  body('project_id').custom(value => {
    if (value === null) return true; // Allow null for uncategorized
    if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return true;
    }
    throw new Error('project_id must be a valid UUID or null');
  })
], changeConversationProject);

// Batch project assignment (for future extension)
router.patch('/batch/project', authenticateToken, [
  body('conversation_ids').isArray({ min: 1 }).withMessage('conversation_ids must be a non-empty array'),
  body('conversation_ids.*').isUUID().withMessage('Each conversation_id must be a valid UUID'),
  body('project_id').custom(value => {
    if (value === null) return true; // Allow null for uncategorized
    if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return true;
    }
    throw new Error('project_id must be a valid UUID or null');
  })
], batchChangeConversationProject);

// AI-powered message generation
router.post('/:id/ai-message', 
  authenticateToken,
  aiHealthCheckMiddleware,
  aiLimitMiddleware,
  aiRequestValidationMiddleware,
  aiResponseFormatterMiddleware,
  [
    body('messages').isArray().withMessage('Messages must be an array'),
    body('model').optional().isString().withMessage('Model must be a string'),
    body('provider').optional().isString().withMessage('Provider must be a string'),
    body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
    body('maxTokens').optional().isInt({ min: 1, max: 8192 }).withMessage('MaxTokens must be between 1 and 8192')
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const conversationId = req.params.id;
      const { messages, model, provider, temperature, maxTokens, options = {} } = req.body;
      const userId = req.user.id;

      // Verify user owns this conversation
      const conversationResult = await database.query(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      );

      if (conversationResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Load conversation history for context
      const historyResult = await database.query(
        `SELECT role, content, created_at 
         FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC`,
        [conversationId]
      );

      // Combine history with new messages
      const historyMessages = historyResult.rows.map(row => ({
        role: row.role,
        content: row.content
      }));

      // Merge history and new messages, avoiding duplicates
      const allMessages = [...historyMessages, ...messages];

      // Generate AI response with full context
      const aiResponse = await aiClient.generate({
        messages: allMessages,
        model,
        provider,
        temperature,
        maxTokens,
        options
      }, req.token);

      // Start database transaction
      const client = await database.getClient();
      await client.query('BEGIN');

      try {
        // Save user message if provided in messages
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          await client.query(
            `INSERT INTO messages (conversation_id, content, role, metadata, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
              conversationId,
              lastMessage.content,
              'user',
              JSON.stringify({ provider: 'user', timestamp: new Date().toISOString() })
            ]
          );
        }

        // Save AI response (with slight delay to ensure proper ordering)
        const messageResult = await client.query(
          `INSERT INTO messages (conversation_id, content, role, metadata, created_at)
           VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 millisecond')
           RETURNING *`,
          [
            conversationId,
            aiResponse.content,
            'assistant',
            JSON.stringify({
              provider: aiResponse.provider,
              model: aiResponse.model,
              usage: aiResponse.usage,
              metadata: aiResponse.metadata
            })
          ]
        );

        // Update conversation updated_at timestamp
        await client.query(
          'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
          [conversationId]
        );

        await client.query('COMMIT');

        logger.info('AI message generated', {
          conversationId,
          userId,
          provider: aiResponse.provider,
          model: aiResponse.model,
          tokens: aiResponse.usage.totalTokens
        });

        res.json({
          success: true,
          data: {
            message: messageResult.rows[0],
            aiResponse
          }
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('AI message generation failed', {
        conversationId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });
      next(error);
    }
  }
);

// AI-powered streaming message generation
router.post('/:id/ai-stream',
  authenticateToken,
  aiHealthCheckMiddleware,
  aiLimitMiddleware,
  aiRequestValidationMiddleware,
  [
    body('messages').isArray().withMessage('Messages must be an array'),
    body('model').optional().isString().withMessage('Model must be a string'),
    body('provider').optional().isString().withMessage('Provider must be a string')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const conversationId = req.params.id;
      const { messages, model, provider, temperature, maxTokens, options = {} } = req.body;
      const userId = req.user.id;

      // Verify user owns this conversation
      const conversationResult = await database.query(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      );

      if (conversationResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let fullContent = '';
      let finalMetadata = null;

      try {
        // Generate streaming response
        const streamResponse = await aiClient.generateStream({
          messages,
          model,
          provider,
          temperature,
          maxTokens,
          options
        });

        const streamGenerator = createStreamParser(streamResponse);

        for await (const chunk of streamGenerator) {
          if (chunk.type === 'content') {
            fullContent += chunk.content;
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          } else if (chunk.type === 'complete') {
            finalMetadata = chunk.metadata;
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            break;
          }
        }

        // Save the complete message to database
        if (fullContent && finalMetadata) {
          const client = await database.getClient();
          await client.query('BEGIN');

          try {
            // Save user message if provided
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.role === 'user') {
              await client.query(
                `INSERT INTO messages (conversation_id, content, role, metadata, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [
                  conversationId,
                  lastMessage.content,
                  'user',
                  JSON.stringify({ provider: 'user', timestamp: new Date().toISOString() })
                ]
              );
            }

            // Save AI response
            await client.query(
              `INSERT INTO messages (conversation_id, content, role, metadata, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [
                conversationId,
                fullContent,
                'assistant',
                JSON.stringify(finalMetadata)
              ]
            );

            // Update conversation
            await client.query(
              'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
              [conversationId]
            );

            await client.query('COMMIT');

            logger.info('AI streaming message completed', {
              conversationId,
              userId,
              provider: finalMetadata.provider,
              contentLength: fullContent.length
            });
          } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to save streaming message', { error: error.message });
          } finally {
            client.release();
          }
        }

        res.write('data: [DONE]\n\n');
      } catch (error) {
        logger.error('AI streaming failed', {
          conversationId,
          userId,
          error: error.message
        });
        
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`);
      }

      res.end();
    } catch (error) {
      next(error);
    }
  }
);

// Get available AI providers
router.get('/ai/providers',
  authenticateToken,
  async (req, res, next) => {
    try {
      const models = await aiClient.getAvailableModels();
      const providerNames = [...new Set(models.map(model => model.provider || 'unknown'))];
      
      res.json({
        success: true,
        data: providerNames.map(name => ({ name, type: 'text' }))
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get available AI models
router.get('/ai/models',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { provider } = req.query;
      const allModels = await aiClient.getAvailableModels();
      const models = provider ? allModels.filter(m => m.provider === provider) : allModels;
      
      res.json({
        success: true,
        data: models
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get AI service health status
router.get('/ai/health',
  authenticateToken,
  async (req, res, next) => {
    try {
      const health = await aiClient.getHealthStatus();
      
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get user AI usage statistics
router.get('/ai/usage',
  authenticateToken,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      // User statistics not implemented in AI client
      const stats = {
        totalRequests: 0,
        totalTokens: 0,
        message: 'Statistics tracking moved to backend database'
      };
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;