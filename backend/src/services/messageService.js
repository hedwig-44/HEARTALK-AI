/**
 * 消息服务
 * 处理对话消息的CRUD操作
 */

const { logger } = require('../utils/logger');
const database = require('../config/database');
const { generateTimestamp } = require('../config/defaults');


class MessageService {
  constructor() {
    this.logger = logger;
  }

  /**
   * 根据对话ID获取消息列表
   * @param {number} conversationId - 对话ID
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 限制数量
   * @param {number} options.offset - 偏移量
   * @param {string} options.orderBy - 排序字段
   * @param {string} options.order - 排序方向 (ASC/DESC)
   * @returns {Promise<Array>} 消息列表
   */
  async getByConversationId(conversationId, options = {}) {
    try {
      const startTime = Date.now();
      const { 
        limit = 20, 
        offset = 0, 
        orderBy = 'created_at', 
        order = 'ASC' 
      } = options;

      this.logger.debug('Fetching messages by conversation ID', {
        conversationId,
        limit,
        offset,
        orderBy,
        order
      });

      // 构建排序语句
      const orderDirection = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const validOrderBy = ['created_at', 'updated_at', 'id'].includes(orderBy) ? orderBy : 'created_at';

      const result = await database.query(
        `SELECT id, conversation_id, role, content, created_at, updated_at
         FROM messages 
         WHERE conversation_id = $1
         ORDER BY ${validOrderBy} ${orderDirection}
         LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      const paginatedMessages = result.rows;

      // 获取总数用于日志
      const countResult = await database.query(
        'SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1',
        [conversationId]
      );
      const totalCount = parseInt(countResult.rows[0].total);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'messages',
        duration,
        true,
        { 
          conversationId, 
          found: paginatedMessages.length, 
          total: totalCount,
          limit, 
          offset 
        }
      );

      return paginatedMessages;

    } catch (error) {
      this.logger.error('Failed to get messages by conversation ID', {
        conversationId,
        options,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 根据ID获取消息
   * @param {number} messageId - 消息ID
   * @returns {Promise<Object|null>} 消息对象或null
   */
  async getById(messageId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Fetching message by ID', {
        messageId
      });

      const result = await database.query(
        'SELECT id, conversation_id, role, content, created_at, updated_at FROM messages WHERE id = $1',
        [messageId]
      );

      const message = result.rows.length > 0 ? result.rows[0] : null;
      
      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'messages',
        duration,
        !!message,
        { messageId, found: !!message }
      );

      return message || null;

    } catch (error) {
      this.logger.error('Failed to get message by ID', {
        messageId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 创建消息
   * @param {Object} messageData - 消息数据
   * @param {number} messageData.conversation_id - 对话ID
   * @param {string} messageData.role - 角色 (user/assistant)
   * @param {string} messageData.content - 消息内容
   * @returns {Promise<Object>} 创建的消息对象
   */
  async create(messageData) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Creating new message', {
        conversationId: messageData.conversation_id,
        role: messageData.role,
        contentLength: messageData.content?.length || 0
      });

      // 验证必要字段
      if (!messageData.conversation_id || !messageData.role || !messageData.content) {
        throw new Error('Missing required fields: conversation_id, role, content');
      }

      // 验证角色
      if (!['user', 'assistant'].includes(messageData.role)) {
        throw new Error('Invalid role. Must be "user" or "assistant"');
      }

      // 生成带偏移的时间戳
      let messageTime;
      
      if (messageData.role === 'user') {
        // 用户消息使用当前时间
        messageTime = new Date();
      } else {
        // AI消息需要查找对话中最后一条用户消息的时间
        const lastUserMessageResult = await database.query(
          `SELECT created_at FROM messages 
           WHERE conversation_id = $1 AND role = 'user'
           ORDER BY created_at DESC LIMIT 1`,
          [messageData.conversation_id]
        );
        
        const baseTime = lastUserMessageResult.rows.length > 0 
          ? new Date(lastUserMessageResult.rows[0].created_at)
          : new Date();
          
        messageTime = generateTimestamp(baseTime, messageData.role);
      }

      const result = await database.query(
        `INSERT INTO messages (conversation_id, role, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING id, conversation_id, role, content, created_at, updated_at`,
        [
          messageData.conversation_id,
          messageData.role,
          messageData.content,
          messageTime
        ]
      );

      const newMessage = result.rows[0];

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'INSERT',
        'messages',
        duration,
        true,
        { 
          messageId: newId, 
          conversationId: messageData.conversation_id,
          role: messageData.role 
        }
      );

      return newMessage;

    } catch (error) {
      this.logger.error('Failed to create message', {
        messageData,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 更新消息
   * @param {number} messageId - 消息ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object|null>} 更新后的消息对象或null
   */
  async update(messageId, updateData) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Updating message', {
        messageId,
        updateFields: Object.keys(updateData)
      });

      // 构建动态更新语句
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (updateData.content !== undefined) {
        updateFields.push(`content = $${paramIndex++}`);
        updateValues.push(updateData.content);
      }
      
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(messageId);

      if (updateFields.length === 1) {
        // 只有updated_at更新，没有实际数据变更
        return await this.getById(messageId);
      }

      const result = await database.query(
        `UPDATE messages SET ${updateFields.join(', ')} 
         WHERE id = $${paramIndex}
         RETURNING id, conversation_id, role, content, created_at, updated_at`,
        updateValues
      );

      const updatedMessage = result.rows.length > 0 ? result.rows[0] : null;

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'UPDATE',
        'messages',
        duration,
        !!updatedMessage,
        { messageId, updated: !!updatedMessage }
      );

      return updatedMessage;

    } catch (error) {
      this.logger.error('Failed to update message', {
        messageId,
        updateData,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 删除消息
   * @param {number} messageId - 消息ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(messageId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Deleting message', {
        messageId
      });

      const result = await database.query(
        'DELETE FROM messages WHERE id = $1',
        [messageId]
      );

      const existed = result.rowCount > 0;

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'DELETE',
        'messages',
        duration,
        existed,
        { messageId }
      );

      return existed;

    } catch (error) {
      this.logger.error('Failed to delete message', {
        messageId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 获取对话消息统计
   * @param {number} conversationId - 对话ID
   * @returns {Promise<Object>} 统计信息
   */
  async getConversationStats(conversationId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Fetching conversation message stats', {
        conversationId
      });

      const result = await database.query(
        `SELECT 
           COUNT(*) as total_messages,
           COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
           COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_messages,
           MIN(created_at) as first_message_date,
           MAX(created_at) as last_message_date
         FROM messages 
         WHERE conversation_id = $1`,
        [conversationId]
      );

      const row = result.rows[0];
      const stats = {
        totalMessages: parseInt(row.total_messages),
        userMessages: parseInt(row.user_messages),
        assistantMessages: parseInt(row.assistant_messages),
        firstMessageDate: row.first_message_date,
        lastMessageDate: row.last_message_date
      };

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'messages',
        duration,
        true,
        { conversationId, statsCalculated: true }
      );

      return stats;

    } catch (error) {
      this.logger.error('Failed to get conversation message stats', {
        conversationId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 批量创建消息
   * @param {Array} messagesData - 消息数据数组
   * @returns {Promise<Array>} 创建的消息对象数组
   */
  async createBatch(messagesData) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Creating messages in batch', {
        count: messagesData.length
      });

      const createdMessages = [];
      
      // 使用事务批量插入
      for (const messageData of messagesData) {
        // 验证必要字段
        if (!messageData.conversation_id || !messageData.role || !messageData.content) {
          throw new Error('Missing required fields in batch data: conversation_id, role, content');
        }

        // 验证角色
        if (!['user', 'assistant'].includes(messageData.role)) {
          throw new Error('Invalid role in batch data. Must be "user" or "assistant"');
        }

        // 生成带偏移的时间戳
        let messageTime;
        if (messageData.role === 'user') {
          messageTime = new Date();
        } else {
          // 对于AI消息，使用当前对话中最后一条用户消息的时间作为基准
          const lastUserMessageResult = await database.query(
            `SELECT created_at FROM messages 
             WHERE conversation_id = $1 AND role = 'user'
             ORDER BY created_at DESC LIMIT 1`,
            [messageData.conversation_id]
          );
          
          const baseTime = lastUserMessageResult.rows.length > 0 
            ? new Date(lastUserMessageResult.rows[0].created_at)
            : new Date();
            
          messageTime = generateTimestamp(baseTime, messageData.role);
        }

        const result = await database.query(
          `INSERT INTO messages (conversation_id, role, content, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $4)
           RETURNING id, conversation_id, role, content, created_at, updated_at`,
          [
            messageData.conversation_id,
            messageData.role,
            messageData.content,
            messageTime
          ]
        );

        createdMessages.push(result.rows[0]);
      }

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'INSERT_BATCH',
        'messages',
        duration,
        true,
        { count: createdMessages.length }
      );

      return createdMessages;

    } catch (error) {
      this.logger.error('Failed to create messages in batch', {
        messagesCount: messagesData?.length,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

}

module.exports = new MessageService();