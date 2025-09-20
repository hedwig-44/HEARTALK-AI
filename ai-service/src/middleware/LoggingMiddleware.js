import { getLogger } from '../utils/Logger.js';

/**
 * 日志中间件
 * 自动记录所有HTTP请求和响应
 */
export class LoggingMiddleware {
  constructor(options = {}) {
    this.logger = getLogger('http');
    this.options = {
      logBody: process.env.NODE_ENV === 'development',
      logHeaders: process.env.NODE_ENV === 'development',
      excludePaths: ['/favicon.ico'],
      maxBodyLength: 1000,
      ...options
    };
  }

  /**
   * 创建日志中间件函数
   * @returns {Function} Express中间件函数
   */
  createMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // 跳过排除的路径
      if (this.options.excludePaths.includes(req.path)) {
        return next();
      }

      // 记录请求开始
      this.logRequestStart(req);

      // 监听响应结束
      const originalSend = res.send;
      const originalJson = res.json;
      let responseBody = null;

      // 重写res.send
      res.send = function(body) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      // 重写res.json  
      res.json = function(obj) {
        responseBody = JSON.stringify(obj);
        return originalJson.call(this, obj);
      };

      // 响应完成时记录
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logRequestComplete(req, res, duration, responseBody);
      });

      next();
    };
  }

  /**
   * 记录请求开始
   * @param {Object} req - 请求对象
   * @private
   */
  logRequestStart(req) {
    const logData = {
      requestId: this.generateRequestId(),
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
    };

    if (this.options.logHeaders) {
      logData.headers = this.sanitizeHeaders(req.headers);
    }

    if (this.options.logBody && req.body) {
      logData.body = this.sanitizeBody(req.body);
    }

    // 将requestId添加到请求对象中，方便后续使用
    req.requestId = logData.requestId;

    this.logger.info(`→ ${req.method} ${req.url}`, logData);
  }

  /**
   * 记录请求完成
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {number} duration - 处理时间
   * @param {string} responseBody - 响应体
   * @private
   */
  logRequestComplete(req, res, duration, responseBody) {
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
    };

    if (this.options.logBody && responseBody) {
      logData.responseBody = this.sanitizeBody(responseBody);
    }

    // 根据状态码决定日志级别
    const message = `← ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`;
    
    if (res.statusCode >= 500) {
      this.logger.error(message, logData);
    } else if (res.statusCode >= 400) {
      this.logger.warn(message, logData);
    } else {
      this.logger.info(message, logData);
    }
  }

  /**
   * 清理敏感的请求头
   * @param {Object} headers - 原始请求头
   * @returns {Object} 清理后的请求头
   * @private
   */
  sanitizeHeaders(headers) {
    const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
    const sanitized = { ...headers };
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = this.maskSensitiveData(sanitized[header]);
      }
    }
    
    return sanitized;
  }

  /**
   * 清理请求/响应体
   * @param {*} body - 原始数据
   * @returns {*} 清理后的数据
   * @private
   */
  sanitizeBody(body) {
    if (typeof body === 'string') {
      // 限制字符串长度
      if (body.length > this.options.maxBodyLength) {
        return body.substring(0, this.options.maxBodyLength) + '... (truncated)';
      }
      
      // 尝试解析JSON并清理敏感数据
      try {
        const parsed = JSON.parse(body);
        return this.sanitizeObject(parsed);
      } catch {
        return body;
      }
    }
    
    if (typeof body === 'object' && body !== null) {
      return this.sanitizeObject(body);
    }
    
    return body;
  }

  /**
   * 清理对象中的敏感数据
   * @param {Object} obj - 原始对象
   * @returns {Object} 清理后的对象
   * @private
   */
  sanitizeObject(obj) {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'apiKey', 'api_key',
      'authorization', 'auth', 'credential', 'accessToken', 'refreshToken'
    ];
    
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = this.maskSensitiveData(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 遮蔽敏感数据
   * @param {*} value - 敏感数据
   * @returns {string} 遮蔽后的数据
   * @private
   */
  maskSensitiveData(value) {
    if (typeof value !== 'string') {
      return '***';
    }
    
    if (value.length <= 8) {
      return '***';
    }
    
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }

  /**
   * 生成请求ID
   * @returns {string} 请求ID
   * @private
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 创建默认日志中间件
 * @param {Object} options - 配置选项
 * @returns {Function} Express中间件函数
 */
export function createLoggingMiddleware(options = {}) {
  const middleware = new LoggingMiddleware(options);
  return middleware.createMiddleware();
}

export default LoggingMiddleware;