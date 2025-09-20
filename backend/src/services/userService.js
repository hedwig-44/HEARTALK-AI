/**
 * 用户服务
 * 处理用户数据的CRUD操作
 */

const { logger } = require('../utils/logger');
const database = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validateUserPreferences } = require('../config/defaults');

/**
 * 用户服务错误类
 */
class UserServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'UserServiceError';
    this.statusCode = statusCode;
  }
}


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

      const result = await database.query(
        'SELECT id, username, name, email, preferences, created_at, updated_at, last_login, status FROM users WHERE id = $1 AND status != $2',
        [userId, 'deleted']
      );
      
      const user = result.rows.length > 0 ? result.rows[0] : null;
      
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

      const result = await database.query(
        'SELECT id, username, name, email, preferences, created_at, updated_at, last_login, status FROM users WHERE username = $1 AND status != $2',
        [username, 'deleted']
      );
      
      const user = result.rows.length > 0 ? result.rows[0] : null;
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

      const result = await database.query(
        'SELECT id, username, name, email, preferences, created_at, updated_at, last_login, status FROM users WHERE LOWER(email) = LOWER($1) AND status != $2',
        [email, 'deleted']
      );
      
      const user = result.rows.length > 0 ? result.rows[0] : null;
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

      // 验证并设置默认偏好
      const validatedPreferences = validateUserPreferences(userData.preferences);

      const result = await database.query(
        `INSERT INTO users (username, name, email, preferences, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, username, name, email, preferences, created_at, updated_at, last_login, status`,
        [
          userData.username,
          userData.name || userData.username,
          userData.email.toLowerCase(),
          JSON.stringify(validatedPreferences),
          'active'
        ]
      );

      const newUser = result.rows[0];

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
    const { password, ...sanitized } = user;
    
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

// 创建服务实例
const userServiceInstance = new UserService();

// 导出服务方法和错误类
module.exports = {
  // 创建用户 (映射到 create 方法)
  createUser: userServiceInstance.create.bind(userServiceInstance),
  // 用户认证
  authenticateUser: async (email, password) => {
    try {
      const startTime = Date.now();
      
      userServiceInstance.logger.debug('Authenticating user', {
        email
      });

      // 验证必要字段
      if (!email || !password) {
        throw new UserServiceError('Email and password are required', 400);
      }

      // 查询数据库中的用户
      const result = await database.query(
        'SELECT id, email, password, name, preferences FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        const duration = Date.now() - startTime;
        userServiceInstance.logger.logDatabaseOperation(
          'SELECT',
          'users',
          duration,
          false,
          { email, reason: 'user_not_found' }
        );
        throw new UserServiceError('Invalid email or password', 401);
      }

      const user = result.rows[0];

      // 验证密码（使用bcrypt）
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        const duration = Date.now() - startTime;
        userServiceInstance.logger.logDatabaseOperation(
          'SELECT',
          'users',
          duration,
          false,
          { email, reason: 'invalid_password' }
        );
        throw new UserServiceError('Invalid email or password', 401);
      }

      // 更新最后登录时间
      await database.query(
        'UPDATE users SET updated_at = NOW() WHERE id = $1',
        [user.id]
      );

      // 生成JWT token
      const tokenPayload = {
        userId: user.id,
        email: user.email
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: '24h',
        issuer: 'heartalk-backend',
        audience: 'heartalk-frontend'
      });

      const duration = Date.now() - startTime;
      userServiceInstance.logger.logDatabaseOperation(
        'SELECT',
        'users',
        duration,
        true,
        { email, userId: user.id, authenticated: true }
      );

      // 返回用户信息和token（不包含密码）
      const { password: _, ...sanitizedUser } = user;
      
      return {
        token,
        user: sanitizedUser
      };

    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      
      userServiceInstance.logger.error('Failed to authenticate user', {
        email,
        error: error.message,
        stack: error.stack
      });
      throw new UserServiceError('Authentication service unavailable', 500);
    }
  },
  // 根据ID获取用户 (映射到 getById 方法)
  getUserById: userServiceInstance.getById.bind(userServiceInstance),
  // 更新用户资料 (映射到 update 方法)
  updateUserProfile: userServiceInstance.update.bind(userServiceInstance),
  // 更新密码 (需要实现)
  updateUserPassword: async (userId, currentPassword, newPassword) => {
    throw new UserServiceError('Password update not implemented in mock service', 501);
  },
  // 检查邮箱可用性 (映射到 getByEmail 的反向逻辑)
  isEmailAvailable: async (email) => {
    const existingUser = await userServiceInstance.getByEmail(email);
    return !existingUser;
  },
  UserServiceError
};