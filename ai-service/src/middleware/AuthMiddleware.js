/**
 * JWT认证中间件
 * 处理API请求的JWT token验证和用户身份认证
 */
import jwt from 'jsonwebtoken';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger('auth-middleware');

export class AuthMiddleware {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production';
    this.apiKey = process.env.HEARTALK_API_KEY || 'dev_heartalk_api_key_placeholder';
    
    // 配置白名单路径（不需要认证）
    this.whitelistPaths = [
      '/',
      '/health',
      '/api/v1/providers',
      '/api/v1/models'
    ];

    // 配置内部服务路径（使用API Key认证）
    this.internalServicePaths = [
      '/internal/api'
    ];
  }

  /**
   * 创建JWT认证中间件
   * @returns {Function} Express中间件函数
   */
  createJwtMiddleware() {
    return (req, res, next) => {
      const path = req.path;
      
      // 检查是否在白名单中
      if (this.isWhitelistPath(path)) {
        return next();
      }

      // 检查是否是内部服务调用
      if (this.isInternalServicePath(path)) {
        return this.handleInternalServiceAuth(req, res, next);
      }

      // 处理用户JWT认证
      return this.handleUserJwtAuth(req, res, next);
    };
  }

  /**
   * 检查路径是否在白名单中
   * @param {string} path - 请求路径
   * @returns {boolean} 是否在白名单中
   */
  isWhitelistPath(path) {
    return this.whitelistPaths.some(whitelistPath => {
      if (whitelistPath.endsWith('*')) {
        const prefix = whitelistPath.slice(0, -1);
        return path.startsWith(prefix);
      }
      return path === whitelistPath;
    });
  }

  /**
   * 检查路径是否是内部服务路径
   * @param {string} path - 请求路径
   * @returns {boolean} 是否是内部服务路径
   */
  isInternalServicePath(path) {
    return this.internalServicePaths.some(internalPath => 
      path.startsWith(internalPath)
    );
  }

  /**
   * 处理内部服务认证（API Key + JWT）
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express下一个中间件函数
   */
  handleInternalServiceAuth(req, res, next) {
    try {
      // 检查API Key
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== this.apiKey) {
        logger.warn('Invalid API key for internal service', {
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          code: 'INVALID_API_KEY',
          requestId: req.requestId
        });
      }

      // 验证JWT token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Missing or invalid authorization header for internal service', {
          path: req.path,
          ip: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Missing or invalid authorization header',
          code: 'MISSING_TOKEN',
          requestId: req.requestId
        });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256']
      });

      // 验证是否是内部服务token
      if (decoded.service !== 'ai-service') {
        logger.warn('Invalid service in JWT token', {
          path: req.path,
          service: decoded.service,
          ip: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid service token',
          code: 'INVALID_SERVICE_TOKEN',
          requestId: req.requestId
        });
      }

      // 将解码后的信息附加到请求对象
      req.serviceAuth = decoded;

      logger.debug('Internal service authenticated successfully', {
        path: req.path,
        service: decoded.service,
        requestId: req.requestId
      });

      next();

    } catch (error) {
      logger.error('Internal service authentication failed', {
        path: req.path,
        error: error.message,
        ip: req.ip,
        requestId: req.requestId
      });

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
          requestId: req.requestId
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          requestId: req.requestId
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Authentication error',
        code: 'AUTH_ERROR',
        requestId: req.requestId
      });
    }
  }

  /**
   * 处理用户JWT认证
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express下一个中间件函数
   */
  handleUserJwtAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Missing or invalid authorization header', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({
          success: false,
          error: 'Authorization header is required',
          code: 'MISSING_TOKEN',
          requestId: req.requestId
        });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256']
      });

      // 验证用户token结构（支持多种字段格式）
      const userId = decoded.user_id || decoded.userId || decoded.id;
      if (!userId) {
        logger.warn('Invalid user token structure', {
          path: req.path,
          tokenKeys: Object.keys(decoded),
          ip: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid token structure - missing user identifier',
          code: 'INVALID_TOKEN_STRUCTURE',
          requestId: req.requestId
        });
      }

      // 将用户信息附加到请求对象（支持多种字段格式）
      req.user = {
        userId: userId,
        username: decoded.username || decoded.name,
        email: decoded.email,
        roles: decoded.roles || [],
        permissions: decoded.permissions || decoded.perms || [],
        // HearTalk兼容字段
        id: userId,
        user_id: userId
      };

      logger.debug('User authenticated successfully', {
        path: req.path,
        userId: req.user.userId,
        username: req.user.username,
        requestId: req.requestId
      });

      next();

    } catch (error) {
      logger.error('User authentication failed', {
        path: req.path,
        error: error.message,
        ip: req.ip,
        requestId: req.requestId
      });

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
          requestId: req.requestId
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          requestId: req.requestId
        });
      }

      if (error.name === 'NotBeforeError') {
        return res.status(401).json({
          success: false,
          error: 'Token not active',
          code: 'TOKEN_NOT_ACTIVE',
          requestId: req.requestId
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Authentication error',
        code: 'AUTH_ERROR',
        requestId: req.requestId
      });
    }
  }

  /**
   * 创建角色权限验证中间件
   * @param {Array} allowedRoles - 允许的角色列表
   * @returns {Function} Express中间件函数
   */
  createRoleMiddleware(allowedRoles = []) {
    return (req, res, next) => {
      if (!req.user) {
        logger.error('Role middleware called without user authentication', {
          path: req.path,
          requestId: req.requestId
        });

        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          requestId: req.requestId
        });
      }

      const userRoles = req.user.roles || [];
      const hasPermission = allowedRoles.some(role => userRoles.includes(role));

      if (!hasPermission) {
        logger.warn('User lacks required role permissions', {
          path: req.path,
          userId: req.user.userId,
          userRoles,
          requiredRoles: allowedRoles,
          requestId: req.requestId
        });

        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          requestId: req.requestId
        });
      }

      next();
    };
  }

  /**
   * 生成用户JWT token (HearTalk兼容格式)
   * @param {Object} userData - 用户数据
   * @param {string} expiresIn - 过期时间
   * @returns {string} JWT token
   */
  generateUserToken(userData, expiresIn = '24h') {
    const userId = userData.user_id || userData.id;
    const payload = {
      // 主要字段
      user_id: userId,
      username: userData.username || userData.name,
      email: userData.email,
      roles: userData.roles || [],
      permissions: userData.permissions || userData.perms || [],
      
      // HearTalk兼容字段
      id: userId,
      userId: userId,
      name: userData.username || userData.name,
      
      // 标准JWT字段
      iat: Math.floor(Date.now() / 1000),
      sub: userId.toString()
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
      expiresIn
    });
  }

  /**
   * 验证并解码JWT token
   * @param {string} token - JWT token
   * @returns {Object|null} 解码后的payload或null
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256']
      });
    } catch (error) {
      logger.debug('Token verification failed', {
        error: error.message,
        tokenType: error.name
      });
      return null;
    }
  }
}

// 创建默认实例
export const defaultAuthMiddleware = new AuthMiddleware();

export default AuthMiddleware;