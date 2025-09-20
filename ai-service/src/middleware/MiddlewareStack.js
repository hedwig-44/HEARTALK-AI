/**
 * 中间件堆栈配置管理器
 * 统一管理和配置所有Express中间件的加载顺序和配置
 */
import express from 'express';
import compression from 'compression';
import { getLogger } from '../utils/Logger.js';
import { createLoggingMiddleware } from './LoggingMiddleware.js';
import { createMetricsMiddleware } from './MetricsMiddleware.js';
import { defaultAuthMiddleware } from './AuthMiddleware.js';
import { defaultRateLimitMiddleware } from './RateLimitMiddleware.js';
import { defaultSecurityMiddleware } from './SecurityMiddleware.js';

const logger = getLogger('middleware-stack');

export class MiddlewareStack {
  constructor(options = {}) {
    this.env = process.env.NODE_ENV || 'development';
    this.isDev = this.env === 'development';
    this.options = {
      enableMetrics: true,
      enableRateLimit: true,
      enableSecurity: true,
      enableAuth: true,
      enableLogging: true,
      enableCompression: true,
      ...options
    };
  }

  /**
   * 配置预处理中间件（在任何业务逻辑之前）
   * @param {Object} app - Express应用实例
   */
  setupPreMiddleware(app) {
    logger.info('Configuring pre-middleware stack');

    // 1. 安全中间件（必须在最前面）
    if (this.options.enableSecurity) {
      const securityStack = defaultSecurityMiddleware.createSecurityStack({
        helmet: true,
        bodyLimit: true,
        userAgentFilter: true
      });
      
      securityStack.forEach(middleware => app.use(middleware));
      logger.debug('Security middleware stack applied');
    }

    // 2. 压缩中间件
    if (this.options.enableCompression) {
      app.use(compression({
        filter: (req, res) => {
          // 不压缩已经压缩的内容
          if (req.headers['x-no-compression']) {
            return false;
          }
          // 使用compression的默认过滤器
          return compression.filter(req, res);
        },
        threshold: 1024 // 只压缩大于1KB的响应
      }));
      logger.debug('Compression middleware applied');
    }

    // 3. 日志中间件（记录所有请求）
    if (this.options.enableLogging) {
      app.use(createLoggingMiddleware({
        logBody: this.isDev,
        logHeaders: this.isDev,
        excludePaths: ['/favicon.ico', '/health', '/metrics']
      }));
      logger.debug('Logging middleware applied');
    }

    // 4. 指标监控中间件
    if (this.options.enableMetrics) {
      app.use(createMetricsMiddleware());
      logger.debug('Metrics middleware applied');
    }

    // 5. 请求体解析中间件
    this.setupBodyParsing(app);
  }

  /**
   * 配置请求体解析中间件
   * @param {Object} app - Express应用实例
   */
  setupBodyParsing(app) {
    // JSON解析
    app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf, encoding) => {
        // 存储原始请求体用于验签等场景
        req.rawBody = buf;
      }
    }));

    // URL编码解析
    app.use(express.urlencoded({ 
      extended: true,
      limit: '10mb'
    }));

    // 静态文件处理（如果需要）
    if (process.env.SERVE_STATIC === 'true') {
      app.use('/static', express.static('public', {
        maxAge: this.isDev ? 0 : '1d',
        etag: true
      }));
    }

    logger.debug('Body parsing middleware applied');
  }

  /**
   * 配置认证和授权中间件
   * @param {Object} app - Express应用实例
   */
  setupAuthMiddleware(app) {
    if (!this.options.enableAuth) {
      logger.warn('Authentication middleware disabled');
      return;
    }

    // JWT认证中间件
    app.use(defaultAuthMiddleware.createJwtMiddleware());
    logger.debug('Authentication middleware applied');
  }

  /**
   * 配置限流中间件
   * @param {Object} app - Express应用实例
   */
  setupRateLimitMiddleware(app) {
    if (!this.options.enableRateLimit) {
      logger.warn('Rate limiting middleware disabled');
      return;
    }

    // 使用智能限流中间件
    app.use(defaultRateLimitMiddleware.createSmartRateLimit());
    logger.debug('Rate limiting middleware applied');
  }

  /**
   * 配置健康检查和系统端点
   * @param {Object} app - Express应用实例
   */
  setupSystemEndpoints(app) {
    // 健康检查端点（不需要认证）
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // 指标端点（开发环境可访问）
    if (this.isDev && this.options.enableMetrics) {
      app.get('/metrics', (req, res) => {
        // 这里可以返回Prometheus格式的指标
        res.set('Content-Type', 'text/plain');
        res.send('# HearTalk AI MVP Metrics\n# Coming soon...\n');
      });
    }

    // 根路径
    app.get('/', (req, res) => {
      res.json({
        message: 'HearTalk AI MVP Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        environment: this.env,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    });

    logger.debug('System endpoints configured');
  }

  /**
   * 配置错误处理中间件（必须在所有路由之后）
   * @param {Object} app - Express应用实例
   */
  setupErrorHandling(app) {
    // 404处理器
    app.use('*', (req, res) => {
      logger.warn('Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });

      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        code: 'ROUTE_NOT_FOUND',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    });

    // 全局错误处理器
    app.use((err, req, res, next) => {
      const isProduction = this.env === 'production';
      
      logger.error('Unhandled error in request', {
        error: err.message,
        stack: isProduction ? undefined : err.stack,
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.userId
      });

      // 根据错误类型返回不同的状态码
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (err.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
      } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
      }

      res.status(statusCode).json({
        success: false,
        error: isProduction ? 'Internal server error' : err.message,
        message: isProduction ? 'Something went wrong' : err.message,
        code: errorCode,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        ...(isProduction ? {} : { stack: err.stack })
      });
    });

    logger.debug('Error handling middleware applied');
  }

  /**
   * 完整配置中间件堆栈
   * @param {Object} app - Express应用实例
   * @returns {Object} 配置后的Express应用
   */
  configure(app) {
    logger.info('Configuring complete middleware stack', {
      environment: this.env,
      options: this.options
    });

    // 1. 预处理中间件
    this.setupPreMiddleware(app);

    // 2. 系统端点（在认证之前）
    this.setupSystemEndpoints(app);

    // 3. 认证中间件
    this.setupAuthMiddleware(app);

    // 4. 限流中间件（在认证之后）
    this.setupRateLimitMiddleware(app);

    logger.info('Middleware stack configuration completed');
    return app;
  }

  /**
   * 完整配置包括错误处理（在所有路由之后调用）
   * @param {Object} app - Express应用实例
   */
  configurePostRoutes(app) {
    this.setupErrorHandling(app);
  }

  /**
   * 获取中间件配置统计信息
   * @returns {Object} 配置统计
   */
  getStats() {
    return {
      environment: this.env,
      enabledMiddleware: Object.entries(this.options)
        .filter(([key, value]) => value === true)
        .map(([key]) => key),
      configuredAt: new Date().toISOString()
    };
  }
}

// 创建默认实例
export const defaultMiddlewareStack = new MiddlewareStack();

export default MiddlewareStack;