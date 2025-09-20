/**
 * 安全和CORS中间件
 * 处理跨域请求、安全头设置和其他安全策略
 */
import cors from 'cors';
import helmet from 'helmet';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger('security-middleware');

export class SecurityMiddleware {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.isDev = this.env === 'development';
    this.isProd = this.env === 'production';
    
    // 允许的域名列表（生产环境需要配置）
    this.allowedOrigins = this.getAllowedOrigins();
  }

  /**
   * 获取允许的域名列表
   * @returns {Array} 允许的域名列表
   */
  getAllowedOrigins() {
    const envOrigins = process.env.ALLOWED_ORIGINS;
    
    if (envOrigins) {
      return envOrigins.split(',').map(origin => origin.trim());
    }

    // 默认配置
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:8080'
    ];

    // 开发环境允许更多域名
    if (this.isDev) {
      defaultOrigins.push(
        'http://localhost:5173', // Vite dev server
        'http://localhost:4200', // Angular dev server
        'http://localhost:8000'  // Backend dev server
      );
    }

    return defaultOrigins;
  }

  /**
   * 创建CORS中间件
   * @returns {Function} Express中间件函数
   */
  createCorsMiddleware() {
    return cors({
      origin: (origin, callback) => {
        // 允许没有origin的请求（如移动应用、Postman等）
        if (!origin) {
          return callback(null, true);
        }

        // 开发环境允许所有localhost域名
        if (this.isDev && origin.includes('localhost')) {
          return callback(null, true);
        }

        // 检查是否在允许列表中
        if (this.allowedOrigins.includes(origin)) {
          logger.debug('CORS: Origin allowed', { origin });
          return callback(null, true);
        }

        // 生产环境严格检查
        if (this.isProd) {
          logger.warn('CORS: Origin blocked', { origin });
          return callback(new Error(`Origin ${origin} not allowed by CORS policy`), false);
        }

        // 开发环境宽松策略
        logger.warn('CORS: Origin not in whitelist but allowed in dev mode', { origin });
        return callback(null, true);
      },
      
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      
      allowedHeaders: [
        'Content-Type',
        'Authorization', 
        'X-Requested-With',
        'X-API-Key',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-Request-ID'
      ],
      
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining', 
        'X-RateLimit-Reset',
        'X-Request-ID',
        'X-Response-Time'
      ],
      
      credentials: true, // 允许发送cookies
      
      maxAge: this.isProd ? 86400 : 600, // 预检请求缓存时间（秒）
      
      optionsSuccessStatus: 200, // 对于旧浏览器的兼容性
      
      preflightContinue: false // 处理OPTIONS预检请求
    });
  }

  /**
   * 创建Helmet安全中间件
   * @returns {Function} Express中间件函数
   */
  createHelmetMiddleware() {
    return helmet({
      // 内容安全策略
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // 开发环境需要，生产环境应该移除
            ...(this.isDev ? ["'unsafe-eval'"] : [])
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://ark.ap-southeast.bytepluses.com", // Byteplus API
            "https://*.volcengineapi.com", // VikingDB API
            ...(this.isDev ? ["http://localhost:*", "ws://localhost:*"] : [])
          ],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        },
        reportOnly: this.isDev // 开发环境仅报告，不阻止
      },

      // 跨域嵌入保护
      crossOriginEmbedderPolicy: false, // 暂时禁用，可能影响某些第三方服务

      // 跨域资源策略
      crossOriginResourcePolicy: { 
        policy: this.isProd ? "same-origin" : "cross-origin"
      },

      // DNS预取控制
      dnsPrefetchControl: { allow: false },

      // 强制HTTPS（仅生产环境）
      hsts: this.isProd ? {
        maxAge: 31536000, // 1年
        includeSubDomains: true,
        preload: true
      } : false,

      // 隐藏X-Powered-By头
      hidePoweredBy: true,

      // IE兼容性
      ieNoOpen: true,

      // 阻止MIME类型嗅探
      noSniff: true,

      // 来源策略
      originAgentCluster: true,

      // 权限策略
      permittedCrossDomainPolicies: false,

      // 引用者策略
      referrerPolicy: { 
        policy: ["no-referrer", "strict-origin-when-cross-origin"] 
      },

      // XSS过滤
      xssFilter: true
    });
  }

  /**
   * 创建自定义安全头中间件
   * @returns {Function} Express中间件函数
   */
  createCustomSecurityHeaders() {
    return (req, res, next) => {
      // 服务器信息隐藏
      res.removeHeader('Server');
      res.removeHeader('X-Powered-By');

      // 自定义安全头
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // API相关头
      res.setHeader('X-API-Version', '1.0');
      res.setHeader('X-Service-Name', 'HearTalk-AI-MVP');
      
      // 缓存控制（API响应不缓存）
      if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      // 添加请求追踪头
      if (req.requestId) {
        res.setHeader('X-Request-ID', req.requestId);
      }

      next();
    };
  }

  /**
   * 创建请求体大小限制中间件
   * @returns {Function} Express中间件函数
   */
  createBodySizeLimiter() {
    return (req, res, next) => {
      const maxSize = {
        '/api/v1/chat/': '10mb',    // 对话请求
        '/api/v1/translate/': '5mb', // 翻译请求
        '/admin/': '50mb',           // 管理接口
        'default': '1mb'             // 默认限制
      };

      let limit = maxSize.default;
      
      for (const [path, size] of Object.entries(maxSize)) {
        if (path !== 'default' && req.path.startsWith(path)) {
          limit = size;
          break;
        }
      }

      // 设置请求体大小限制
      req.maxBodySize = limit;
      next();
    };
  }

  /**
   * 创建IP白名单中间件
   * @param {Array} allowedIPs - 允许的IP地址列表
   * @returns {Function} Express中间件函数
   */
  createIPWhitelist(allowedIPs = []) {
    if (!allowedIPs.length) {
      // 如果没有指定IP白名单，直接通过
      return (req, res, next) => next();
    }

    return (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      
      if (!allowedIPs.includes(clientIP)) {
        logger.warn('IP not in whitelist', {
          ip: clientIP,
          path: req.path,
          userAgent: req.get('User-Agent'),
          requestId: req.requestId
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied - IP not allowed',
          code: 'IP_NOT_ALLOWED',
          requestId: req.requestId
        });
      }

      next();
    };
  }

  /**
   * 创建用户代理过滤中间件
   * @returns {Function} Express中间件函数
   */
  createUserAgentFilter() {
    const blockedUserAgents = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i
      // 可以添加更多规则
    ];

    const allowedBots = [
      /googlebot/i,
      /bingbot/i,
      /slackbot/i,
      /twitterbot/i
      // 允许的爬虫
    ];

    return (req, res, next) => {
      const userAgent = req.get('User-Agent') || '';

      // 检查是否是允许的爬虫
      const isAllowedBot = allowedBots.some(pattern => pattern.test(userAgent));
      if (isAllowedBot) {
        return next();
      }

      // 检查是否是被阻止的爬虫
      const isBlockedBot = blockedUserAgents.some(pattern => pattern.test(userAgent));
      if (isBlockedBot && this.isProd) {
        logger.warn('Blocked user agent', {
          userAgent,
          ip: req.ip,
          path: req.path,
          requestId: req.requestId
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'USER_AGENT_BLOCKED',
          requestId: req.requestId
        });
      }

      next();
    };
  }

  /**
   * 创建组合安全中间件
   * @param {Object} options - 配置选项
   * @returns {Array} 中间件数组
   */
  createSecurityStack(options = {}) {
    const stack = [];

    // 1. CORS处理（必须在最前面）
    stack.push(this.createCorsMiddleware());

    // 2. Helmet安全头
    if (options.helmet !== false) {
      stack.push(this.createHelmetMiddleware());
    }

    // 3. 自定义安全头
    stack.push(this.createCustomSecurityHeaders());

    // 4. 请求体大小限制
    if (options.bodyLimit !== false) {
      stack.push(this.createBodySizeLimiter());
    }

    // 5. IP白名单（如果配置了）
    if (options.allowedIPs && options.allowedIPs.length > 0) {
      stack.push(this.createIPWhitelist(options.allowedIPs));
    }

    // 6. 用户代理过滤
    if (options.userAgentFilter !== false) {
      stack.push(this.createUserAgentFilter());
    }

    logger.info('Security middleware stack initialized', {
      middlewareCount: stack.length,
      environment: this.env,
      allowedOrigins: this.allowedOrigins.length
    });

    return stack;
  }
}

// 创建默认实例
export const defaultSecurityMiddleware = new SecurityMiddleware();

export default SecurityMiddleware;