/**
 * 请求限流中间件
 * 基于用户和IP的请求限制，防止API滥用
 */
import rateLimit from 'express-rate-limit';
import { getLogger } from '../utils/Logger.js';
import { defaultConfigManager } from '../utils/ConfigManager.js';

const logger = getLogger('rate-limit-middleware');

export class RateLimitMiddleware {
  constructor() {
    this.config = defaultConfigManager.getConfig('rateLimit');
    this.stores = new Map(); // 存储不同类型的限流器
  }

  /**
   * 创建全局IP限流中间件
   * @returns {Function} Express中间件函数
   */
  createGlobalRateLimit() {
    return rateLimit({
      windowMs: this.config.windowMs, // 15分钟
      max: this.config.maxRequests, // 限制每个IP 100个请求
      message: {
        success: false,
        error: this.config.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(this.config.windowMs / 1000)
      },
      standardHeaders: true, // 返回rate limit信息在headers中
      legacyHeaders: false,
      skip: (req) => {
        // 跳过健康检查和静态资源
        const skipPaths = ['/', '/health', '/favicon.ico'];
        return skipPaths.includes(req.path);
      },
      keyGenerator: (req) => {
        // 使用真实IP地址作为key
        return req.ip || req.connection.remoteAddress;
      },
      handler: (req, res) => {
        logger.warn('Global rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          userAgent: req.get('User-Agent'),
          requestId: req.requestId
        });

        res.status(429).json({
          success: false,
          error: this.config.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(this.config.windowMs / 1000),
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 创建基于用户的限流中间件
   * @param {Object} options - 配置选项
   * @returns {Function} Express中间件函数
   */
  createUserRateLimit(options = {}) {
    const {
      windowMs = 60 * 1000, // 1分钟
      max = 60, // 每分钟60次请求
      message = 'Too many requests from this user, please try again later.'
    } = options;

    return rateLimit({
      windowMs,
      max,
      message: {
        success: false,
        error: message,
        code: 'USER_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // 基于用户ID限流，如果没有用户信息则基于IP
        if (req.user && req.user.userId) {
          return `user:${req.user.userId}`;
        }
        return `ip:${req.ip}`;
      },
      skip: (req) => {
        // 内部服务调用不限流
        return req.path.startsWith('/internal/');
      },
      handler: (req, res) => {
        const identifier = req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
        
        logger.warn('User rate limit exceeded', {
          identifier,
          userId: req.user?.userId,
          ip: req.ip,
          path: req.path,
          requestId: req.requestId
        });

        res.status(429).json({
          success: false,
          error: message,
          code: 'USER_RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000),
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 创建AI API特定的限流中间件
   * @returns {Function} Express中间件函数
   */
  createAIApiRateLimit() {
    return rateLimit({
      windowMs: 60 * 1000, // 1分钟
      max: 30, // AI API每分钟30次请求
      message: {
        success: false,
        error: 'Too many AI API requests, please try again later.',
        code: 'AI_API_RATE_LIMIT_EXCEEDED',
        retryAfter: 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // AI API限流基于用户ID
        if (req.user && req.user.userId) {
          return `ai_api:${req.user.userId}`;
        }
        return `ai_api:${req.ip}`;
      },
      handler: (req, res) => {
        const identifier = req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
        
        logger.warn('AI API rate limit exceeded', {
          identifier,
          userId: req.user?.userId,
          ip: req.ip,
          path: req.path,
          endpoint: req.path,
          requestId: req.requestId
        });

        res.status(429).json({
          success: false,
          error: 'Too many AI API requests, please try again later.',
          code: 'AI_API_RATE_LIMIT_EXCEEDED',
          retryAfter: 60,
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 创建流式请求特殊限流中间件
   * @returns {Function} Express中间件函数
   */
  createStreamRateLimit() {
    return rateLimit({
      windowMs: 60 * 1000, // 1分钟
      max: 10, // 流式请求每分钟10次
      message: {
        success: false,
        error: 'Too many streaming requests, please try again later.',
        code: 'STREAM_RATE_LIMIT_EXCEEDED',
        retryAfter: 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        if (req.user && req.user.userId) {
          return `stream:${req.user.userId}`;
        }
        return `stream:${req.ip}`;
      },
      handler: (req, res) => {
        const identifier = req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
        
        logger.warn('Stream API rate limit exceeded', {
          identifier,
          userId: req.user?.userId,
          ip: req.ip,
          path: req.path,
          requestId: req.requestId
        });

        res.status(429).json({
          success: false,
          error: 'Too many streaming requests, please try again later.',
          code: 'STREAM_RATE_LIMIT_EXCEEDED',
          retryAfter: 60,
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 创建管理员API限流中间件
   * @returns {Function} Express中间件函数
   */
  createAdminRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100, // 管理API每15分钟100次请求
      message: {
        success: false,
        error: 'Too many admin API requests, please try again later.',
        code: 'ADMIN_API_RATE_LIMIT_EXCEEDED',
        retryAfter: 900
      },
      keyGenerator: (req) => {
        if (req.user && req.user.userId) {
          return `admin:${req.user.userId}`;
        }
        return `admin:${req.ip}`;
      },
      handler: (req, res) => {
        logger.warn('Admin API rate limit exceeded', {
          userId: req.user?.userId,
          ip: req.ip,
          path: req.path,
          requestId: req.requestId
        });

        res.status(429).json({
          success: false,
          error: 'Too many admin API requests, please try again later.',
          code: 'ADMIN_API_RATE_LIMIT_EXCEEDED',
          retryAfter: 900,
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 创建自定义限流中间件
   * @param {Object} options - 限流配置
   * @returns {Function} Express中间件函数
   */
  createCustomRateLimit(options) {
    const {
      windowMs = 60 * 1000,
      max = 100,
      message = 'Too many requests',
      keyGenerator,
      skip,
      handler
    } = options;

    return rateLimit({
      windowMs,
      max,
      message: typeof message === 'string' ? {
        success: false,
        error: message,
        code: 'CUSTOM_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      } : message,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: keyGenerator || ((req) => req.ip),
      skip: skip || (() => false),
      handler: handler || ((req, res) => {
        logger.warn('Custom rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          requestId: req.requestId
        });

        const response = typeof message === 'string' ? {
          success: false,
          error: message,
          code: 'CUSTOM_RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000),
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        } : message;

        res.status(429).json(response);
      })
    });
  }

  /**
   * 获取限流统计信息
   * @param {string} key - 限流key
   * @returns {Object} 统计信息
   */
  getStats(key) {
    // 这里可以扩展为从Redis或其他存储中获取统计信息
    return {
      key,
      requests: 0,
      remaining: 0,
      resetTime: null
    };
  }

  /**
   * 重置特定key的限流计数
   * @param {string} key - 限流key
   */
  resetLimit(key) {
    logger.info('Manual rate limit reset', { key });
    // 这里可以扩展为重置Redis中的计数
  }

  /**
   * 创建智能限流中间件（根据端点类型自动选择限流策略）
   * @returns {Function} Express中间件函数
   */
  createSmartRateLimit() {
    const globalLimit = this.createGlobalRateLimit();
    const userLimit = this.createUserRateLimit();
    const aiApiLimit = this.createAIApiRateLimit();
    const streamLimit = this.createStreamRateLimit();
    const adminLimit = this.createAdminRateLimit();

    return (req, res, next) => {
      const path = req.path.toLowerCase();

      // 根据路径选择合适的限流策略
      if (path.includes('/admin/')) {
        return adminLimit(req, res, next);
      } else if (path.includes('/stream')) {
        return streamLimit(req, res, next);
      } else if (path.includes('/api/v1/chat/') || path.includes('/api/v1/translate/')) {
        return aiApiLimit(req, res, next);
      } else if (req.user) {
        return userLimit(req, res, next);
      } else {
        return globalLimit(req, res, next);
      }
    };
  }
}

// 创建默认实例
export const defaultRateLimitMiddleware = new RateLimitMiddleware();

export default RateLimitMiddleware;