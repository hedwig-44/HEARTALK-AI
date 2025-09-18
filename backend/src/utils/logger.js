/**
 * Backend Logger Utility
 * 基于winston的简化日志系统，专为backend服务设计
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * 确保日志目录存在
 */
function ensureLogDir() {
  const logDir = path.resolve(__dirname, '..', '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

/**
 * 解析文件大小字符串
 * @param {string} sizeStr - 大小字符串 (例: "10MB", "5GB")
 * @returns {number} 字节数
 */
function parseSize(sizeStr) {
  const units = {
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024
  };
  
  const match = sizeStr.match(/^(\d+)(KB|MB|GB)$/i);
  if (!match) return 10 * 1024 * 1024; // 默认10MB
  
  const [, size, unit] = match;
  return parseInt(size) * (units[unit.toUpperCase()] || 1);
}

/**
 * 创建Winston日志器
 */
function createLogger() {
  const logDir = ensureLogDir();
  
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level.toUpperCase()}] ${service || 'BACKEND'}: ${message} ${metaString}`;
      })
    ),
    defaultMeta: { 
      service: 'heartalk-backend',
      version: '1.0.0',
      env: process.env.NODE_ENV || 'development'
    },
    transports: [
      // 文件传输 - 所有日志
      new winston.transports.File({
        filename: path.join(logDir, 'backend.log'),
        maxsize: parseSize('10MB'),
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }),
      // 文件传输 - 错误日志
      new winston.transports.File({
        filename: path.join(logDir, 'backend-error.log'),
        level: 'error',
        maxsize: parseSize('10MB'),
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ],
    // 异常处理
    exceptionHandlers: [
      new winston.transports.File({ 
        filename: path.join(logDir, 'backend-exceptions.log'),
        maxsize: parseSize('5MB'),
        maxFiles: 3
      })
    ],
    // Promise拒绝处理
    rejectionHandlers: [
      new winston.transports.File({ 
        filename: path.join(logDir, 'backend-rejections.log'),
        maxsize: parseSize('5MB'),
        maxFiles: 3
      })
    ]
  });

  // 开发环境添加控制台输出
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, service }) => {
          return `${timestamp} [${level}] ${service || 'BACKEND'}: ${message}`;
        })
      )
    }));
  }

  return logger;
}

/**
 * 结构化日志记录器类
 */
class StructuredLogger {
  constructor(moduleName = 'backend') {
    this.logger = createLogger();
    this.moduleName = moduleName;
  }

  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 元数据
   */
  info(message, meta = {}) {
    this.logger.info(message, { ...meta, module: this.moduleName });
  }

  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 元数据
   */
  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta, module: this.moduleName });
  }

  /**
   * 记录错误日志
   * @param {string} message - 日志消息
   * @param {Error|Object} error - 错误对象或元数据
   */
  error(message, error = {}) {
    const meta = error instanceof Error 
      ? { error: error.message, stack: error.stack, module: this.moduleName }
      : { ...error, module: this.moduleName };
    
    this.logger.error(message, meta);
  }

  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 元数据
   */
  debug(message, meta = {}) {
    this.logger.debug(message, { ...meta, module: this.moduleName });
  }

  /**
   * 记录API请求日志
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {number} duration - 处理时间(ms)
   */
  logRequest(req, res, duration) {
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      module: this.moduleName
    };

    if (res.statusCode >= 400) {
      this.error(`${req.method} ${req.url} - ${res.statusCode}`, logData);
    } else {
      this.info(`${req.method} ${req.url} - ${res.statusCode}`, logData);
    }
  }

  /**
   * 记录数据库操作日志
   * @param {string} operation - 操作类型
   * @param {string} table - 表名
   * @param {number} duration - 处理时间
   * @param {boolean} success - 是否成功
   * @param {Object} meta - 额外元数据
   */
  logDatabaseOperation(operation, table, duration, success, meta = {}) {
    const logData = {
      operation,
      table,
      duration: `${duration}ms`,
      success,
      ...meta,
      module: this.moduleName
    };

    if (success) {
      this.debug(`DB ${operation}: ${table}`, logData);
    } else {
      this.error(`DB ${operation} failed: ${table}`, logData);
    }
  }

  /**
   * 记录性能指标
   * @param {string} operation - 操作名称
   * @param {number} duration - 持续时间
   * @param {Object} metrics - 性能指标
   */
  logPerformance(operation, duration, metrics = {}) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...metrics,
      module: this.moduleName,
      type: 'performance'
    });
  }
}

// 创建默认日志器实例
const logger = new StructuredLogger('backend');

module.exports = {
  logger,
  StructuredLogger,
  createLogger: (moduleName) => new StructuredLogger(moduleName)
};