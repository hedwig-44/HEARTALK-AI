/**
 * Backend API客户端
 * 处理与HearTalk后端服务的内部API通信
 */
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger('backend-api-client');

export class BackendApiClient {
  constructor() {
    this.baseURL = process.env.HEARTALK_BACKEND_URL || 'http://localhost:8000';
    this.apiKey = process.env.HEARTALK_API_KEY || 'dev_heartalk_api_key_placeholder';
    this.jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production';
    this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000;
    
    // 可配置的API路径
    this.apiPrefix = process.env.BACKEND_API_PREFIX || '/internal/api/v1';
    this.conversationPath = process.env.BACKEND_CONVERSATION_PATH || '/conversations';
    this.userPath = process.env.BACKEND_USER_PATH || '/users';
    
    // 创建axios实例
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HearTalk-AI-MVP/1.0.0'
      }
    });

    // 配置请求拦截器（添加认证）
    this.httpClient.interceptors.request.use(
      (config) => {
        const token = this.generateInternalToken();
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['X-API-Key'] = this.apiKey;
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', {
          error: error.message,
          config: error.config
        });
        return Promise.reject(error);
      }
    );

    // 配置响应拦截器（处理错误和重试）
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('Backend API response received', {
          url: response.config.url,
          status: response.status,
          method: response.config.method.toUpperCase()
        });
        return response;
      },
      async (error) => {
        logger.error('Backend API error', {
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          message: error.message
        });

        // 实现重试逻辑
        if (this.shouldRetry(error) && !error.config._retry) {
          error.config._retry = true;
          await this.delay(1000); // 等待1秒后重试
          return this.httpClient.request(error.config);
        }

        return Promise.reject(error);
      }
    );

    // 启动健康检查
    this.startHealthCheck();

    // 检测开发占位符配置
    if (this.apiKey.includes('placeholder') || this.jwtSecret.includes('change_in_production')) {
      logger.warn('SECURITY WARNING: Development placeholder configurations detected!', {
        hasPlaceholderApiKey: this.apiKey.includes('placeholder'),
        hasPlaceholderJwtSecret: this.jwtSecret.includes('change_in_production'),
        environment: process.env.NODE_ENV
      });
      
      if (process.env.NODE_ENV === 'production') {
        logger.error('CRITICAL: Production environment with development credentials!');
      }
    }

    logger.info('Backend API client initialized', {
      baseURL: this.baseURL,
      healthCheckInterval: this.healthCheckInterval
    });
  }

  /**
   * 生成内部服务JWT token
   * @returns {string} JWT token
   */
  generateInternalToken() {
    const payload = {
      service: 'ai-service',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 5) // 5分钟过期
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256'
    });
  }

  /**
   * 验证JWT token
   * @param {string} token - JWT token
   * @returns {Object|null} 解码后的payload或null
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256']
      });
    } catch (error) {
      logger.warn('Token verification failed', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * 判断是否应该重试请求
   * @param {Object} error - 错误对象
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(error) {
    // 重试条件：网络错误、超时、或5xx服务器错误
    if (!error.response) return true; // 网络错误
    if (error.code === 'ECONNABORTED') return true; // 超时
    
    const status = error.response.status;
    return status >= 500 && status < 600; // 5xx服务器错误
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取对话历史
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Object>} 对话历史数据
   */
  async getConversationHistory(conversationId) {
    try {
      logger.info('Fetching conversation history', {
        conversationId
      });

      const response = await this.httpClient.get(
        `${this.apiPrefix}${this.conversationPath}/${conversationId}/history`
      );

      logger.info('Conversation history fetched successfully', {
        conversationId,
        messageCount: response.data?.data?.length || 0
      });

      return {
        success: true,
        data: {
          messages: response.data?.data || []
        }
      };

    } catch (error) {
      logger.error('Failed to fetch conversation history', {
        conversationId,
        error: error.message,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 500,
        data: {
          messages: [] // 提供空的消息数组作为降级，确保ContextManager能正常处理
        }
      };
    }
  }

  /**
   * 获取用户上下文信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 用户上下文数据
   */
  async getUserContext(userId) {
    try {
      logger.info('Fetching user context', {
        userId
      });

      const response = await this.httpClient.get(
        `${this.apiPrefix}${this.userPath}/${userId}/context`
      );

      logger.info('User context fetched successfully', {
        userId,
        contextKeys: Object.keys(response.data?.data || {})
      });

      return {
        success: true,
        data: response.data?.data || {}
      };

    } catch (error) {
      logger.error('Failed to fetch user context', {
        userId,
        error: error.message,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 500
      };
    }
  }

  /**
   * 健康检查
   * @returns {Promise<boolean>} 服务是否健康
   */
  async healthCheck() {
    try {
      const response = await this.httpClient.get('/health', {
        timeout: 5000
      });

      const isHealthy = response.status === 200;
      
      logger.debug('Backend health check result', {
        isHealthy,
        status: response.status,
        responseTime: response.headers['x-response-time']
      });

      return isHealthy;

    } catch (error) {
      logger.warn('Backend health check failed', {
        error: error.message,
        status: error.response?.status
      });

      return false;
    }
  }

  /**
   * 启动定期健康检查
   */
  startHealthCheck() {
    setInterval(async () => {
      const isHealthy = await this.healthCheck();
      
      if (!isHealthy) {
        logger.warn('Backend service appears unhealthy', {
          baseURL: this.baseURL
        });
      }
    }, this.healthCheckInterval);

    logger.info('Health check started', {
      interval: this.healthCheckInterval
    });
  }

  /**
   * 创建对话记录
   * @param {Object} conversationData - 对话数据
   * @returns {Promise<Object>} 创建结果
   */
  async createConversation(conversationData) {
    try {
      const response = await this.httpClient.post(
        `${this.apiPrefix}${this.conversationPath}`,
        conversationData
      );

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      logger.error('Failed to create conversation', {
        error: error.message,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 500
      };
    }
  }

  /**
   * 更新对话记录
   * @param {string} conversationId - 对话ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateConversation(conversationId, updateData) {
    try {
      const response = await this.httpClient.put(
        `${this.apiPrefix}${this.conversationPath}/${conversationId}`,
        updateData
      );

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      logger.error('Failed to update conversation', {
        conversationId,
        error: error.message,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 500
      };
    }
  }
}

// 创建默认实例
export const defaultBackendApiClient = new BackendApiClient();

export default BackendApiClient;