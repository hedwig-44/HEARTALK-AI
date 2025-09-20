import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { defaultConfigManager } from './ConfigManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 日志管理器
 * 基于Winston的统一日志系统
 */
class LoggerManager {
  constructor() {
    this.loggers = new Map();
    this.config = defaultConfigManager.getConfig('logging');
    this.setupDefaultLogger();
  }

  /**
   * 设置默认日志器
   * @private
   */
  setupDefaultLogger() {
    const logDir = path.resolve(path.dirname(__dirname), '..', 'logs');
    
    // 创建默认日志器
    const logger = winston.createLogger({
      level: this.config.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level.toUpperCase()}] ${service || 'APP'}: ${message} ${metaString}`;
        })
      ),
      defaultMeta: { 
        service: 'ai-service',
        version: '1.0.0',
        env: process.env.NODE_ENV || 'development'
      },
      transports: [
        // 文件传输 - 所有日志
        new winston.transports.File({
          filename: path.join(logDir, 'app.log'),
          maxsize: this.parseSize(this.config.maxSize || '10MB'),
          maxFiles: this.config.maxFiles || 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        // 文件传输 - 错误日志
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: this.parseSize(this.config.maxSize || '10MB'),
          maxFiles: this.config.maxFiles || 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ],
      // 异常处理
      exceptionHandlers: [
        new winston.transports.File({ 
          filename: path.join(logDir, 'exceptions.log'),
          maxsize: this.parseSize('5MB'),
          maxFiles: 3
        })
      ],
      // 拒绝处理
      rejectionHandlers: [
        new winston.transports.File({ 
          filename: path.join(logDir, 'rejections.log'),
          maxsize: this.parseSize('5MB'),
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
            return `${timestamp} [${level}] ${service || 'APP'}: ${message}`;
          })
        )
      }));
    }

    this.loggers.set('default', logger);
  }

  /**
   * 获取日志器
   * @param {string} name - 日志器名称
   * @returns {winston.Logger}
   */
  getLogger(name = 'default') {
    if (!this.loggers.has(name) && name !== 'default') {
      // 为特定模块创建专用日志器
      this.createModuleLogger(name);
    }
    return this.loggers.get(name) || this.loggers.get('default');
  }

  /**
   * 创建模块专用日志器
   * @param {string} moduleName - 模块名称
   * @private
   */
  createModuleLogger(moduleName) {
    const baseLogger = this.loggers.get('default');
    const moduleLogger = baseLogger.child({ 
      service: `ai-service:${moduleName}`,
      module: moduleName
    });
    
    this.loggers.set(moduleName, moduleLogger);
  }

  /**
   * 解析文件大小字符串
   * @param {string} sizeStr - 大小字符串 (例: "10MB", "5GB")
   * @returns {number} 字节数
   * @private
   */
  parseSize(sizeStr) {
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
   * 设置日志级别
   * @param {string} level - 日志级别
   */
  setLogLevel(level) {
    for (const logger of this.loggers.values()) {
      logger.level = level;
    }
    this.config.level = level;
  }

  /**
   * 获取日志统计
   * @returns {Object} 日志统计信息
   */
  getStats() {
    return {
      loggers: this.loggers.size,
      level: this.config.level,
      logFile: this.config.file,
      maxSize: this.config.maxSize,
      maxFiles: this.config.maxFiles
    };
  }
}

// 创建全局日志管理器实例
const loggerManager = new LoggerManager();

/**
 * 创建结构化日志记录器
 */
export class StructuredLogger {
  constructor(moduleName = 'default') {
    this.logger = loggerManager.getLogger(moduleName);
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
   * 记录AI Provider调用日志
   * @param {string} provider - Provider名称
   * @param {string} endpoint - 端点
   * @param {number} duration - 处理时间
   * @param {boolean} success - 是否成功
   * @param {Object} meta - 额外元数据
   */
  logProviderCall(provider, endpoint, duration, success, meta = {}) {
    const logData = {
      provider,
      endpoint,
      duration: `${duration}ms`,
      success,
      ...meta,
      module: this.moduleName
    };

    if (success) {
      this.info(`AI Provider call: ${provider}/${endpoint}`, logData);
    } else {
      this.error(`AI Provider call failed: ${provider}/${endpoint}`, logData);
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

// 默认导出
export const defaultLogger = new StructuredLogger('app');
export { loggerManager };

// 便捷函数
export function getLogger(moduleName) {
  return new StructuredLogger(moduleName);
}

export default StructuredLogger;