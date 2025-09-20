import ByteplusProvider from './ByteplusProvider.js';

/**
 * AI Provider 工厂类
 * 负责创建和管理不同的AI服务提供商实例
 */
export class ProviderFactory {
  constructor() {
    // 注册支持的Provider类型
    this.providerTypes = new Map();
    this.providerInstances = new Map();
    
    // 注册内置Provider
    this.registerProvider('byteplus', ByteplusProvider);
  }

  /**
   * 注册新的Provider类型
   * @param {string} type - Provider类型名称
   * @param {class} ProviderClass - Provider类
   */
  registerProvider(type, ProviderClass) {
    if (!type || typeof type !== 'string') {
      throw new Error('Provider type must be a non-empty string');
    }

    if (!ProviderClass || typeof ProviderClass !== 'function') {
      throw new Error('ProviderClass must be a constructor function');
    }

    // 验证Provider类是否继承自AIProvider
    if (!this.isProviderValid(ProviderClass)) {
      throw new Error('Provider class must extend AIProvider');
    }

    this.providerTypes.set(type.toLowerCase(), ProviderClass);
  }

  /**
   * 创建Provider实例
   * @param {string} type - Provider类型
   * @param {Object} config - Provider配置
   * @returns {AIProvider} Provider实例
   */
  createProvider(type, config) {
    const normalizedType = type.toLowerCase();
    
    if (!this.providerTypes.has(normalizedType)) {
      throw new Error(`Unsupported provider type: ${type}. Available types: ${this.getAvailableTypes().join(', ')}`);
    }

    const ProviderClass = this.providerTypes.get(normalizedType);
    
    try {
      return new ProviderClass(config);
    } catch (error) {
      throw new Error(`Failed to create ${type} provider: ${error.message}`);
    }
  }

  /**
   * 获取或创建Provider实例（单例模式）
   * @param {string} type - Provider类型
   * @param {Object} config - Provider配置
   * @returns {AIProvider} Provider实例
   */
  getProvider(type, config) {
    const normalizedType = type.toLowerCase();
    const instanceKey = this.generateInstanceKey(normalizedType, config);

    if (this.providerInstances.has(instanceKey)) {
      return this.providerInstances.get(instanceKey);
    }

    const provider = this.createProvider(normalizedType, config);
    this.providerInstances.set(instanceKey, provider);
    
    return provider;
  }

  /**
   * 获取所有可用的Provider类型
   * @returns {Array<string>} Provider类型列表
   */
  getAvailableTypes() {
    return Array.from(this.providerTypes.keys());
  }

  /**
   * 检查Provider类型是否支持
   * @param {string} type - Provider类型
   * @returns {boolean} 是否支持
   */
  isTypeSupported(type) {
    return this.providerTypes.has(type.toLowerCase());
  }

  /**
   * 移除Provider实例缓存
   * @param {string} type - Provider类型
   * @param {Object} config - Provider配置（可选）
   */
  removeProvider(type, config = null) {
    const normalizedType = type.toLowerCase();
    
    if (config) {
      const instanceKey = this.generateInstanceKey(normalizedType, config);
      this.providerInstances.delete(instanceKey);
    } else {
      // 移除所有该类型的实例
      const keysToRemove = Array.from(this.providerInstances.keys())
        .filter(key => key.startsWith(`${normalizedType}:`));
      
      keysToRemove.forEach(key => {
        this.providerInstances.delete(key);
      });
    }
  }

  /**
   * 清除所有Provider实例缓存
   */
  clearAllProviders() {
    this.providerInstances.clear();
  }

  /**
   * 批量健康检查所有Provider实例
   * @returns {Promise<Object>} 健康检查结果
   */
  async healthCheckAll() {
    const results = {};
    
    for (const [key, provider] of this.providerInstances.entries()) {
      try {
        const isHealthy = await provider.healthCheck();
        results[key] = {
          healthy: isHealthy,
          type: provider.getName(),
          error: null
        };
      } catch (error) {
        results[key] = {
          healthy: false,
          type: provider.getName(),
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * 获取工厂状态信息
   * @returns {Object} 工厂状态
   */
  getStatus() {
    return {
      registered_types: this.getAvailableTypes(),
      active_instances: this.providerInstances.size,
      instance_keys: Array.from(this.providerInstances.keys())
    };
  }

  /**
   * 验证Provider类是否有效
   * @param {class} ProviderClass - Provider类
   * @returns {boolean} 是否有效
   * @private
   */
  isProviderValid(ProviderClass) {
    try {
      // 检查是否有必需的方法
      const prototype = ProviderClass.prototype;
      const requiredMethods = [
        'generateResponse',
        'generateStreamResponse',
        'translateText',
        'healthCheck'
      ];

      for (const method of requiredMethods) {
        if (typeof prototype[method] !== 'function') {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成Provider实例的唯一键
   * @param {string} type - Provider类型
   * @param {Object} config - Provider配置
   * @returns {string} 实例键
   * @private
   */
  generateInstanceKey(type, config) {
    // 基于配置的关键字段生成唯一键
    const keyParts = [type];
    
    if (config.apiKey) {
      // 只使用API Key的前8位来区分不同配置
      keyParts.push(config.apiKey.substring(0, 8));
    }
    
    if (config.region) {
      keyParts.push(config.region);
    }
    
    if (config.endpoint || config.chatEndpoint) {
      const endpoint = config.endpoint || config.chatEndpoint;
      // 提取域名部分
      try {
        const url = new URL(endpoint);
        keyParts.push(url.hostname);
      } catch {
        keyParts.push(endpoint.substring(0, 20));
      }
    }

    return keyParts.join(':');
  }
}

/**
 * 默认工厂实例（单例）
 */
export const defaultProviderFactory = new ProviderFactory();

/**
 * 便捷方法：创建Byteplus Provider
 * @param {Object} config - Byteplus配置
 * @returns {ByteplusProvider} Byteplus Provider实例
 */
export function createByteplusProvider(config) {
  return defaultProviderFactory.createProvider('byteplus', config);
}

/**
 * 便捷方法：获取或创建Byteplus Provider
 * @param {Object} config - Byteplus配置
 * @returns {ByteplusProvider} Byteplus Provider实例
 */
export function getByteplusProvider(config) {
  return defaultProviderFactory.getProvider('byteplus', config);
}

export default ProviderFactory;