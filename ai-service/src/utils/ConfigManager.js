import dotenv from 'dotenv';
import path from 'path';

/**
 * 配置管理器
 * 负责加载、验证和提供应用配置
 */
export class ConfigManager {
  constructor(options = {}) {
    this.env = options.env || process.env.NODE_ENV || 'development';
    this.configCache = new Map();
    
    // 加载环境变量
    this.loadEnvironmentVariables(options);
    
    // 初始化配置
    this.initializeConfig();
  }

  /**
   * 加载环境变量文件
   * @param {Object} options - 选项
   * @private
   */
  loadEnvironmentVariables(options) {
    const envFiles = [
      `.env.${this.env}.local`,
      '.env.local',
      `.env.${this.env}`,
      '.env'
    ];

    for (const envFile of envFiles) {
      const envPath = options.configPath ? 
        path.join(options.configPath, envFile) : envFile;
      
      try {
        dotenv.config({ path: envPath, override: false });
      } catch (error) {
        // 忽略文件不存在的错误
      }
    }
  }

  /**
   * 初始化配置
   * @private
   */
  initializeConfig() {
    // 服务器配置
    this.configCache.set('server', {
      env: this.env,
      port: this.getInt('PORT', 8001),
      host: this.getString('HOST', 'localhost'),
      timezone: this.getString('TZ', 'UTC')
    });

    // JWT配置
    this.configCache.set('jwt', {
      secret: this.getString('JWT_SECRET', 'default_jwt_secret'),
      expiresIn: this.getString('JWT_EXPIRES_IN', '24h')
    });

    // Byteplus配置
    this.configCache.set('byteplus', {
      apiKey: this.getString('BYTEPLUS_API_KEY'),
      chatEndpoint: this.getString('BYTEPLUS_AMI_CHAT_EP'),
      workAssistantEndpoint: this.getString('BYTEPLUS_AMI_WORK_ASSISTANT_EP'),
      timeout: this.getInt('BYTEPLUS_TIMEOUT', 30000),
      workAssistantTimeout: this.getInt('BYTEPLUS_WORK_ASSISTANT_TIMEOUT', 60000)
    });

    // VikingDB配置
    this.configCache.set('vikingdb', {
      host: this.getString('VIKINGDB_HOST'),
      region: this.getString('VIKINGDB_REGION', 'ap-southeast-1'),
      accessKey: this.getString('VIKINGDB_ACCESS_KEY'),
      secretKey: this.getString('VIKINGDB_SECRET_KEY'),
      collections: {
        communicationTemplates: this.getString('COMMUNICATION_TEMPLATES_COLLECTION', 'communication_templates_base')
      }
    });

    // HearTalk后端集成配置
    this.configCache.set('heartalk', {
      backendUrl: this.getString('HEARTALK_BACKEND_URL', 'http://localhost:8000'),
      apiKey: this.getString('HEARTALK_API_KEY'),
      timeout: this.getInt('HEARTALK_TIMEOUT', 10000)
    });

    // 日志配置
    this.configCache.set('logging', {
      level: this.getString('LOG_LEVEL', 'info'),
      file: this.getString('LOG_FILE', 'logs/app.log'),
      maxSize: this.getString('LOG_MAX_SIZE', '10MB'),
      maxFiles: this.getInt('LOG_MAX_FILES', 5)
    });

    // 速率限制配置
    this.configCache.set('rateLimit', {
      windowMs: this.getInt('RATE_LIMIT_WINDOW', 15) * 60 * 1000,
      maxRequests: this.getInt('RATE_LIMIT_MAX_REQUESTS', 100),
      message: this.getString('RATE_LIMIT_MESSAGE', 'Too many requests from this IP, please try again later.')
    });

    // 上下文管理配置
    this.configCache.set('context', {
      maxTokens: this.getInt('MAX_CONTEXT_TOKENS', 2000),
      maxRounds: this.getInt('MAX_CONVERSATION_ROUNDS', 10)
    });

    // Chain-of-Thought & Self-Consistency配置
    this.configCache.set('reasoning', {
      enableChainOfThought: this.getBoolean('ENABLE_CHAIN_OF_THOUGHT', true),
      enableSelfConsistency: this.getBoolean('ENABLE_SELF_CONSISTENCY', true),
      selfConsistencySamples: this.getInt('SELF_CONSISTENCY_SAMPLES', 3),
      showReasoningProcess: this.getBoolean('SHOW_REASONING_PROCESS', false)
    });
  }

  /**
   * 获取配置组
   * @param {string} group - 配置组名称
   * @returns {Object} 配置对象
   */
  getConfig(group) {
    if (!this.configCache.has(group)) {
      throw new Error(`Configuration group '${group}' not found`);
    }
    
    return { ...this.configCache.get(group) };
  }

  /**
   * 获取字符串配置值
   * @param {string} key - 环境变量键
   * @param {string} defaultValue - 默认值
   * @returns {string} 配置值
   */
  getString(key, defaultValue = '') {
    const value = process.env[key];
    return value !== undefined ? value : defaultValue;
  }

  /**
   * 获取整数配置值
   * @param {string} key - 环境变量键
   * @param {number} defaultValue - 默认值
   * @returns {number} 配置值
   */
  getInt(key, defaultValue = 0) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 获取浮点数配置值
   * @param {string} key - 环境变量键
   * @param {number} defaultValue - 默认值
   * @returns {number} 配置值
   */
  getFloat(key, defaultValue = 0.0) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 获取布尔配置值
   * @param {string} key - 环境变量键
   * @param {boolean} defaultValue - 默认值
   * @returns {boolean} 配置值
   */
  getBoolean(key, defaultValue = false) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    
    const lowercased = value.toLowerCase();
    return lowercased === 'true' || lowercased === '1' || lowercased === 'yes';
  }

  /**
   * 获取数组配置值（逗号分隔）
   * @param {string} key - 环境变量键
   * @param {Array} defaultValue - 默认值
   * @returns {Array} 配置值
   */
  getArray(key, defaultValue = []) {
    const value = process.env[key];
    if (!value) return defaultValue;
    
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }

  /**
   * 验证必需配置
   * @param {Array<string>} requiredKeys - 必需的配置键
   * @throws {Error} 如果缺少必需配置
   */
  validateRequired(requiredKeys) {
    const missingKeys = [];
    
    for (const key of requiredKeys) {
      if (!process.env[key]) {
        missingKeys.push(key);
      }
    }
    
    if (missingKeys.length > 0) {
      throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
    }
  }

  /**
   * 验证所有配置
   * @returns {Object} 验证结果
   */
  validateAll() {
    const results = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // 验证Byteplus配置
      const byteplusConfig = this.getConfig('byteplus');
      if (!byteplusConfig.apiKey) {
        results.errors.push('BYTEPLUS_API_KEY is required');
      }
      if (!byteplusConfig.chatEndpoint) {
        results.errors.push('BYTEPLUS_AMI_CHAT_EP is required');
      }
      if (!byteplusConfig.workAssistantEndpoint) {
        results.errors.push('BYTEPLUS_AMI_WORK_ASSISTANT_EP is required');
      }

      // 验证VikingDB配置
      const vikingdbConfig = this.getConfig('vikingdb');
      if (!vikingdbConfig.accessKey) {
        results.errors.push('VIKINGDB_ACCESS_KEY is required');
      }
      if (!vikingdbConfig.secretKey) {
        results.errors.push('VIKINGDB_SECRET_KEY is required');
      }
      if (!vikingdbConfig.host) {
        results.errors.push('VIKINGDB_HOST is required');
      }

      // 验证JWT配置
      const jwtConfig = this.getConfig('jwt');
      if (jwtConfig.secret === 'default_jwt_secret' && this.env === 'production') {
        results.errors.push('JWT_SECRET must be set to a secure value in production');
      }

      // 警告检查
      const hearTalkConfig = this.getConfig('heartalk');
      if (!hearTalkConfig.apiKey) {
        results.warnings.push('HEARTALK_API_KEY is not set, some features may not work');
      }

    } catch (error) {
      results.errors.push(`Configuration validation error: ${error.message}`);
    }

    results.valid = results.errors.length === 0;
    return results;
  }

  /**
   * 获取所有配置（用于调试）
   * @param {boolean} includeSensitive - 是否包含敏感信息
   * @returns {Object} 所有配置
   */
  getAllConfig(includeSensitive = false) {
    const config = {};
    
    for (const [group, values] of this.configCache.entries()) {
      config[group] = includeSensitive ? values : this.sanitizeConfig(values);
    }
    
    return config;
  }

  /**
   * 清理敏感配置信息
   * @param {Object} config - 配置对象
   * @returns {Object} 清理后的配置
   * @private
   */
  sanitizeConfig(config) {
    const sensitiveKeys = ['apiKey', 'secret', 'secretKey', 'password', 'token'];
    const sanitized = { ...config };
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        const value = sanitized[key];
        if (typeof value === 'string' && value.length > 8) {
          sanitized[key] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
        } else if (value) {
          sanitized[key] = '****';
        }
      }
    }
    
    return sanitized;
  }

  /**
   * 重新加载配置
   */
  reload() {
    this.configCache.clear();
    this.initializeConfig();
  }
}

/**
 * 默认配置管理器实例（单例）
 */
export const defaultConfigManager = new ConfigManager();

/**
 * 便捷方法：获取配置组
 * @param {string} group - 配置组名称
 * @returns {Object} 配置对象
 */
export function getConfig(group) {
  return defaultConfigManager.getConfig(group);
}

/**
 * 便捷方法：验证所有配置
 * @returns {Object} 验证结果
 */
export function validateConfig() {
  return defaultConfigManager.validateAll();
}

export default ConfigManager;