/**
 * 对话服务
 * 处理对话数据的CRUD操作
 * 注意：这是一个模拟服务，实际生产环境中应该连接真实数据库
 */

const { logger } = require('../utils/logger');

/**
 * 模拟对话数据存储
 * 在真实环境中，这应该是数据库表
 */
const mockConversations = new Map([
  [1, {
    id: 1,
    user_id: 1,
    title: '测试对话1',
    status: 'active',
    created_at: '2025-09-18T08:00:00Z',
    updated_at: '2025-09-18T08:00:00Z'
  }],
  [2, {
    id: 2,
    user_id: 1,
    title: '测试对话2',
    status: 'active',
    created_at: '2025-09-18T09:00:00Z',
    updated_at: '2025-09-18T09:00:00Z'
  }]
]);

class ConversationService {
  constructor() {
    this.logger = logger;
  }

  /**
   * 根据ID获取对话
   * @param {number} conversationId - 对话ID
   * @returns {Promise<Object|null>} 对话对象或null
   */
  async getById(conversationId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Fetching conversation by ID', {
        conversationId
      });

      // 模拟数据库查询延迟
      await this.simulateDelay(10);

      const conversation = mockConversations.get(parseInt(conversationId));
      
      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'conversations',
        duration,
        !!conversation,
        { conversationId, found: !!conversation }
      );

      return conversation || null;

    } catch (error) {
      this.logger.error('Failed to get conversation by ID', {
        conversationId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 根据用户ID获取对话列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 限制数量
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Array>} 对话列表
   */
  async getByUserId(userId, options = {}) {
    try {
      const startTime = Date.now();
      const { limit = 20, offset = 0 } = options;

      this.logger.debug('Fetching conversations by user ID', {
        userId,
        limit,
        offset
      });

      // 模拟数据库查询延迟
      await this.simulateDelay(20);

      // 筛选属于该用户的对话
      const userConversations = Array.from(mockConversations.values())
        .filter(conv => conv.user_id === parseInt(userId))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)) // 按更新时间倒序
        .slice(offset, offset + limit);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'conversations',
        duration,
        true,
        { userId, found: userConversations.length, limit, offset }
      );

      return userConversations;

    } catch (error) {
      this.logger.error('Failed to get conversations by user ID', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 创建对话
   * @param {Object} conversationData - 对话数据
   * @param {number} conversationData.user_id - 用户ID
   * @param {string} conversationData.title - 对话标题
   * @returns {Promise<Object>} 创建的对话对象
   */
  async create(conversationData) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Creating new conversation', {
        userId: conversationData.user_id,
        title: conversationData.title
      });

      // 模拟数据库写入延迟
      await this.simulateDelay(30);

      const newId = Math.max(...mockConversations.keys()) + 1;
      const now = new Date().toISOString();
      
      const newConversation = {
        id: newId,
        user_id: conversationData.user_id,
        title: conversationData.title || `对话 ${newId}`,
        status: 'active',
        created_at: now,
        updated_at: now
      };

      mockConversations.set(newId, newConversation);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'INSERT',
        'conversations',
        duration,
        true,
        { conversationId: newId, userId: conversationData.user_id }
      );

      return newConversation;

    } catch (error) {
      this.logger.error('Failed to create conversation', {
        conversationData,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 更新对话
   * @param {number} conversationId - 对话ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object|null>} 更新后的对话对象或null
   */
  async update(conversationId, updateData) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Updating conversation', {
        conversationId,
        updateData
      });

      // 模拟数据库更新延迟
      await this.simulateDelay(25);

      const conversation = mockConversations.get(parseInt(conversationId));
      if (!conversation) {
        const duration = Date.now() - startTime;
        this.logger.logDatabaseOperation(
          'UPDATE',
          'conversations',
          duration,
          false,
          { conversationId, reason: 'not_found' }
        );
        return null;
      }

      const updatedConversation = {
        ...conversation,
        ...updateData,
        updated_at: new Date().toISOString()
      };

      mockConversations.set(parseInt(conversationId), updatedConversation);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'UPDATE',
        'conversations',
        duration,
        true,
        { conversationId }
      );

      return updatedConversation;

    } catch (error) {
      this.logger.error('Failed to update conversation', {
        conversationId,
        updateData,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 删除对话
   * @param {number} conversationId - 对话ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(conversationId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Deleting conversation', {
        conversationId
      });

      // 模拟数据库删除延迟
      await this.simulateDelay(20);

      const existed = mockConversations.has(parseInt(conversationId));
      mockConversations.delete(parseInt(conversationId));

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'DELETE',
        'conversations',
        duration,
        existed,
        { conversationId }
      );

      return existed;

    } catch (error) {
      this.logger.error('Failed to delete conversation', {
        conversationId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 获取对话统计信息
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 统计信息
   */
  async getStats(userId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Fetching conversation stats', {
        userId
      });

      // 模拟数据库查询延迟
      await this.simulateDelay(15);

      const userConversations = Array.from(mockConversations.values())
        .filter(conv => conv.user_id === parseInt(userId));

      const stats = {
        totalConversations: userConversations.length,
        activeConversations: userConversations.filter(conv => conv.status === 'active').length,
        lastConversationDate: userConversations.length > 0 
          ? Math.max(...userConversations.map(conv => new Date(conv.updated_at)))
          : null
      };

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'conversations',
        duration,
        true,
        { userId, statsCalculated: true }
      );

      return stats;

    } catch (error) {
      this.logger.error('Failed to get conversation stats', {
        userId,
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
    const randomDelay = ms + Math.random() * 10;
    await new Promise(resolve => setTimeout(resolve, randomDelay));
  }
}

module.exports = new ConversationService();