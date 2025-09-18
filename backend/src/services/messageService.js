/**
 * 消息服务
 * 处理对话消息的CRUD操作
 * 注意：这是一个模拟服务，实际生产环境中应该连接真实数据库
 */

const { logger } = require('../utils/logger');

/**
 * 模拟消息数据存储
 * 在真实环境中，这应该是数据库表
 */
const mockMessages = new Map([
  [1, {
    id: 1,
    conversation_id: 1,
    role: 'user',
    content: '你好，请介绍一下你自己。',
    created_at: '2025-09-18T08:00:10Z',
    updated_at: '2025-09-18T08:00:10Z'
  }],
  [2, {
    id: 2,
    conversation_id: 1,
    role: 'assistant',
    content: '你好！我是HearTalk AI助手，很高兴为您服务。我可以帮助您解答问题、进行对话和提供各种信息。有什么我可以帮助您的吗？',
    created_at: '2025-09-18T08:00:15Z',
    updated_at: '2025-09-18T08:00:15Z'
  }],
  [3, {
    id: 3,
    conversation_id: 1,
    role: 'user',
    content: '能帮我写一个简单的Python函数吗？',
    created_at: '2025-09-18T08:01:20Z',
    updated_at: '2025-09-18T08:01:20Z'
  }],
  [4, {
    id: 4,
    conversation_id: 1,
    role: 'assistant',
    content: '当然可以！这里是一个简单的Python函数示例：\n\n```python\ndef greet(name):\n    """简单的问候函数"""\n    return f"你好，{name}！"\n\n# 使用示例\nresult = greet("小明")\nprint(result)  # 输出：你好，小明！\n```\n\n这个函数接受一个姓名参数，并返回一个问候语。您还需要其他类型的函数吗？',
    created_at: '2025-09-18T08:01:25Z',
    updated_at: '2025-09-18T08:01:25Z'
  }],
  [5, {
    id: 5,
    conversation_id: 2,
    role: 'user',
    content: '今天天气怎么样？',
    created_at: '2025-09-18T09:00:10Z',
    updated_at: '2025-09-18T09:00:10Z'
  }],
  [6, {
    id: 6,
    conversation_id: 2,
    role: 'assistant',
    content: '抱歉，我无法获取实时天气信息。建议您查看天气预报应用或网站获取准确的天气信息。不过我可以帮您解答其他问题！',
    created_at: '2025-09-18T09:00:15Z',
    updated_at: '2025-09-18T09:00:15Z'
  }]
]);

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

      // 模拟数据库查询延迟
      await this.simulateDelay(25);

      // 筛选属于该对话的消息
      let conversationMessages = Array.from(mockMessages.values())
        .filter(msg => msg.conversation_id === parseInt(conversationId));

      // 排序
      conversationMessages.sort((a, b) => {
        const aValue = new Date(a[orderBy]);
        const bValue = new Date(b[orderBy]);
        
        if (order.toUpperCase() === 'DESC') {
          return bValue - aValue;
        } else {
          return aValue - bValue;
        }
      });

      // 分页
      const paginatedMessages = conversationMessages.slice(offset, offset + limit);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'messages',
        duration,
        true,
        { 
          conversationId, 
          found: paginatedMessages.length, 
          total: conversationMessages.length,
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

      // 模拟数据库查询延迟
      await this.simulateDelay(10);

      const message = mockMessages.get(parseInt(messageId));
      
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

      // 模拟数据库写入延迟
      await this.simulateDelay(35);

      const newId = Math.max(...mockMessages.keys()) + 1;
      const now = new Date().toISOString();
      
      const newMessage = {
        id: newId,
        conversation_id: parseInt(messageData.conversation_id),
        role: messageData.role,
        content: messageData.content,
        created_at: now,
        updated_at: now
      };

      mockMessages.set(newId, newMessage);

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

      // 模拟数据库更新延迟
      await this.simulateDelay(30);

      const message = mockMessages.get(parseInt(messageId));
      if (!message) {
        const duration = Date.now() - startTime;
        this.logger.logDatabaseOperation(
          'UPDATE',
          'messages',
          duration,
          false,
          { messageId, reason: 'not_found' }
        );
        return null;
      }

      const updatedMessage = {
        ...message,
        ...updateData,
        updated_at: new Date().toISOString()
      };

      mockMessages.set(parseInt(messageId), updatedMessage);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'UPDATE',
        'messages',
        duration,
        true,
        { messageId }
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

      // 模拟数据库删除延迟
      await this.simulateDelay(25);

      const existed = mockMessages.has(parseInt(messageId));
      mockMessages.delete(parseInt(messageId));

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

      // 模拟数据库查询延迟
      await this.simulateDelay(20);

      const conversationMessages = Array.from(mockMessages.values())
        .filter(msg => msg.conversation_id === parseInt(conversationId));

      const stats = {
        totalMessages: conversationMessages.length,
        userMessages: conversationMessages.filter(msg => msg.role === 'user').length,
        assistantMessages: conversationMessages.filter(msg => msg.role === 'assistant').length,
        firstMessageDate: conversationMessages.length > 0 
          ? Math.min(...conversationMessages.map(msg => new Date(msg.created_at)))
          : null,
        lastMessageDate: conversationMessages.length > 0 
          ? Math.max(...conversationMessages.map(msg => new Date(msg.created_at)))
          : null
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

      // 模拟数据库批量写入延迟
      await this.simulateDelay(50 + messagesData.length * 10);

      const createdMessages = [];
      for (const messageData of messagesData) {
        const newId = Math.max(...mockMessages.keys(), ...createdMessages.map(m => m.id)) + 1;
        const now = new Date().toISOString();
        
        const newMessage = {
          id: newId,
          conversation_id: parseInt(messageData.conversation_id),
          role: messageData.role,
          content: messageData.content,
          created_at: now,
          updated_at: now
        };

        mockMessages.set(newId, newMessage);
        createdMessages.push(newMessage);
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

  /**
   * 模拟数据库操作延迟
   * @param {number} ms - 延迟毫秒数
   * @private
   */
  async simulateDelay(ms) {
    // 在测试环境中可以禁用延迟
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    
    // 添加随机波动以模拟真实数据库响应时间
    const randomDelay = ms + Math.random() * 15;
    await new Promise(resolve => setTimeout(resolve, randomDelay));
  }
}

module.exports = new MessageService();