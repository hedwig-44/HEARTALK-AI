/**
 * 用户服务
 * 处理用户数据的CRUD操作
 * 注意：这是一个模拟服务，实际生产环境中应该连接真实数据库
 */

const { logger } = require('../utils/logger');

/**
 * 模拟用户数据存储
 * 在真实环境中，这应该是数据库表
 */
const mockUsers = new Map([
  [1, {
    id: 1,
    username: 'test_user',
    name: '测试用户',
    email: 'test@heartalk.ai',
    preferences: {
      language: 'zh-CN',
      theme: 'light',
      notifications: true,
      aiPersonality: 'friendly'
    },
    created_at: '2025-09-01T00:00:00Z',
    updated_at: '2025-09-18T08:00:00Z',
    last_login: '2025-09-18T08:00:00Z',
    status: 'active'
  }],
  [2, {
    id: 2,
    username: 'demo_user',
    name: '演示用户',
    email: 'demo@heartalk.ai',
    preferences: {
      language: 'en-US',
      theme: 'dark',
      notifications: false,
      aiPersonality: 'professional'
    },
    created_at: '2025-09-10T00:00:00Z',
    updated_at: '2025-09-17T15:30:00Z',
    last_login: '2025-09-17T15:30:00Z',
    status: 'active'
  }]
]);

class UserService {
  constructor() {
    this.logger = logger;
  }

  /**
   * 根据ID获取用户
   * @param {number} userId - 用户ID
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async getById(userId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Fetching user by ID', {
        userId
      });

      // 模拟数据库查询延迟
      await this.simulateDelay(15);

      const user = mockUsers.get(parseInt(userId));
      
      // 出于安全考虑，不返回敏感信息
      const sanitizedUser = user ? this.sanitizeUser(user) : null;
      
      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'users',
        duration,
        !!user,
        { userId, found: !!user }
      );

      return sanitizedUser;

    } catch (error) {
      this.logger.error('Failed to get user by ID', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 根据用户名获取用户
   * @param {string} username - 用户名
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async getByUsername(username) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Fetching user by username', {
        username
      });

      // 模拟数据库查询延迟
      await this.simulateDelay(20);

      const user = Array.from(mockUsers.values())
        .find(u => u.username === username);
      
      const sanitizedUser = user ? this.sanitizeUser(user) : null;
      
      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'users',
        duration,
        !!user,
        { username, found: !!user }
      );

      return sanitizedUser;

    } catch (error) {
      this.logger.error('Failed to get user by username', {
        username,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 根据邮箱获取用户
   * @param {string} email - 邮箱
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async getByEmail(email) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Fetching user by email', {
        email
      });

      // 模拟数据库查询延迟
      await this.simulateDelay(20);

      const user = Array.from(mockUsers.values())
        .find(u => u.email.toLowerCase() === email.toLowerCase());
      
      const sanitizedUser = user ? this.sanitizeUser(user) : null;
      
      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'users',
        duration,
        !!user,
        { email, found: !!user }
      );

      return sanitizedUser;

    } catch (error) {
      this.logger.error('Failed to get user by email', {
        email,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @param {string} userData.username - 用户名
   * @param {string} userData.name - 显示名称
   * @param {string} userData.email - 邮箱
   * @param {Object} userData.preferences - 用户偏好设置
   * @returns {Promise<Object>} 创建的用户对象
   */
  async create(userData) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Creating new user', {
        username: userData.username,
        email: userData.email
      });

      // 验证必要字段
      if (!userData.username || !userData.email) {
        throw new Error('Missing required fields: username, email');
      }

      // 检查用户名和邮箱是否已存在
      const existingUsername = await this.getByUsername(userData.username);
      if (existingUsername) {
        throw new Error('Username already exists');
      }

      const existingEmail = await this.getByEmail(userData.email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // 模拟数据库写入延迟
      await this.simulateDelay(40);

      const newId = Math.max(...mockUsers.keys()) + 1;
      const now = new Date().toISOString();
      
      const newUser = {
        id: newId,
        username: userData.username,
        name: userData.name || userData.username,
        email: userData.email.toLowerCase(),
        preferences: {
          language: 'zh-CN',
          theme: 'light',
          notifications: true,
          aiPersonality: 'friendly',
          ...userData.preferences
        },
        created_at: now,
        updated_at: now,
        last_login: null,
        status: 'active'
      };

      mockUsers.set(newId, newUser);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'INSERT',
        'users',
        duration,
        true,
        { userId: newId, username: userData.username }
      );

      return this.sanitizeUser(newUser);

    } catch (error) {
      this.logger.error('Failed to create user', {
        userData: {
          username: userData?.username,
          email: userData?.email
        },
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 更新用户
   * @param {number} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object|null>} 更新后的用户对象或null
   */
  async update(userId, updateData) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Updating user', {
        userId,
        updateFields: Object.keys(updateData)
      });

      // 模拟数据库更新延迟
      await this.simulateDelay(35);

      const user = mockUsers.get(parseInt(userId));
      if (!user) {
        const duration = Date.now() - startTime;
        this.logger.logDatabaseOperation(
          'UPDATE',
          'users',
          duration,
          false,
          { userId, reason: 'not_found' }
        );
        return null;
      }

      // 合并偏好设置
      const updatedUser = {
        ...user,
        ...updateData,
        preferences: updateData.preferences 
          ? { ...user.preferences, ...updateData.preferences }
          : user.preferences,
        updated_at: new Date().toISOString()
      };

      mockUsers.set(parseInt(userId), updatedUser);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'UPDATE',
        'users',
        duration,
        true,
        { userId }
      );

      return this.sanitizeUser(updatedUser);

    } catch (error) {
      this.logger.error('Failed to update user', {
        userId,
        updateData,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 更新用户最后登录时间
   * @param {number} userId - 用户ID
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateLastLogin(userId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Updating user last login', {
        userId
      });

      // 模拟数据库更新延迟
      await this.simulateDelay(20);

      const user = mockUsers.get(parseInt(userId));
      if (!user) {
        const duration = Date.now() - startTime;
        this.logger.logDatabaseOperation(
          'UPDATE',
          'users',
          duration,
          false,
          { userId, reason: 'not_found' }
        );
        return false;
      }

      const updatedUser = {
        ...user,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockUsers.set(parseInt(userId), updatedUser);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'UPDATE',
        'users',
        duration,
        true,
        { userId, operation: 'last_login_update' }
      );

      return true;

    } catch (error) {
      this.logger.error('Failed to update user last login', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 统计信息
   */
  async getStats(userId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Fetching user stats', {
        userId
      });

      // 模拟数据库查询延迟
      await this.simulateDelay(25);

      const user = mockUsers.get(parseInt(userId));
      if (!user) {
        return null;
      }

      // 在真实实现中，这里会查询相关的对话和消息统计
      const stats = {
        accountAge: Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)), // 天数
        lastActiveDate: user.last_login || user.updated_at,
        totalConversations: 0, // TODO: 从conversationService获取
        totalMessages: 0, // TODO: 从messageService获取
        preferences: user.preferences
      };

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'SELECT',
        'users',
        duration,
        true,
        { userId, statsCalculated: true }
      );

      return stats;

    } catch (error) {
      this.logger.error('Failed to get user stats', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 删除用户（软删除）
   * @param {number} userId - 用户ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(userId) {
    try {
      const startTime = Date.now();
      
      this.logger.debug('Soft deleting user', {
        userId
      });

      // 模拟数据库更新延迟
      await this.simulateDelay(30);

      const user = mockUsers.get(parseInt(userId));
      if (!user) {
        const duration = Date.now() - startTime;
        this.logger.logDatabaseOperation(
          'UPDATE',
          'users',
          duration,
          false,
          { userId, reason: 'not_found' }
        );
        return false;
      }

      // 软删除：标记为已删除而不是物理删除
      const deletedUser = {
        ...user,
        status: 'deleted',
        updated_at: new Date().toISOString()
      };

      mockUsers.set(parseInt(userId), deletedUser);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'UPDATE',
        'users',
        duration,
        true,
        { userId, operation: 'soft_delete' }
      );

      return true;

    } catch (error) {
      this.logger.error('Failed to delete user', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 清理用户敏感信息
   * @param {Object} user - 原始用户对象
   * @returns {Object} 清理后的用户对象
   * @private
   */
  sanitizeUser(user) {
    // 移除敏感信息，只返回公开字段
    const { ...sanitized } = user;
    
    // 可以根据需要添加更多的字段过滤逻辑
    return sanitized;
  }

  /**
   * 验证邮箱格式
   * @param {string} email - 邮箱地址
   * @returns {boolean} 是否为有效邮箱
   * @private
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证用户名格式
   * @param {string} username - 用户名
   * @returns {boolean} 是否为有效用户名
   * @private
   */
  validateUsername(username) {
    // 用户名：3-30个字符，字母、数字、下划线
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
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

module.exports = new UserService();