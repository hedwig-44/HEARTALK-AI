/**
 * AI Provider 抽象基类
 * 定义所有AI服务提供商必须实现的接口
 */
export class AIProvider {
  constructor(config) {
    if (this.constructor === AIProvider) {
      throw new Error('AIProvider is an abstract class and cannot be instantiated directly');
    }
    this.config = config;
    this.name = 'unknown';
  }

  /**
   * 生成对话响应 (抽象方法)
   * @param {Object} params - 请求参数
   * @param {string} params.message - 用户消息
   * @param {string} params.conversationId - 对话ID
   * @param {Array} params.context - 对话上下文
   * @param {Object} params.options - 附加选项
   * @returns {Promise<Object>} 响应对象
   */
  async generateResponse() {
    throw new Error('generateResponse method must be implemented by subclass');
  }

  /**
   * 生成流式响应 (抽象方法)
   * @param {Object} params - 请求参数
   * @param {Function} onChunk - 流式数据回调
   * @returns {Promise<void>}
   */
  async generateStreamResponse() {
    throw new Error('generateStreamResponse method must be implemented by subclass');
  }

  /**
   * 翻译文本 (抽象方法)
   * @param {Object} params - 翻译参数
   * @param {string} params.text - 待翻译文本
   * @param {string} params.targetLanguage - 目标语言
   * @returns {Promise<Object>} 翻译结果
   */
  async translateText() {
    throw new Error('translateText method must be implemented by subclass');
  }

  /**
   * 健康检查 (可选实现)
   * @returns {Promise<boolean>} 服务是否健康
   */
  async healthCheck() {
    return true;
  }

  /**
   * 获取支持的模型列表 (可选实现)
   * @returns {Promise<Array>} 模型列表
   */
  async getSupportedModels() {
    return [];
  }

  /**
   * 获取Provider名称
   * @returns {string} Provider名称
   */
  getName() {
    return this.name;
  }

  /**
   * 获取Provider配置
   * @returns {Object} 配置对象
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 验证配置是否有效 (可选实现)
   * @returns {boolean} 配置是否有效
   */
  validateConfig() {
    return true;
  }
}

/**
 * 响应数据标准化接口
 */
export class AIResponse {
  constructor(data) {
    this.success = data.success || false;
    this.message = data.message || '';
    this.data = data.data || null;
    this.error = data.error || null;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.provider = data.provider || 'unknown';
    this.model = data.model || 'unknown';
    this.usage = data.usage || null;
  }

  /**
   * 创建成功响应
   * @param {*} data - 响应数据
   * @param {string} provider - Provider名称
   * @param {string} model - 模型名称
   * @returns {AIResponse}
   */
  static success(data, provider = 'unknown', model = 'unknown') {
    return new AIResponse({
      success: true,
      data: data,
      provider: provider,
      model: model
    });
  }

  /**
   * 创建错误响应
   * @param {string} error - 错误信息
   * @param {string} provider - Provider名称
   * @returns {AIResponse}
   */
  static error(error, provider = 'unknown') {
    return new AIResponse({
      success: false,
      error: error,
      provider: provider
    });
  }
}

/**
 * Provider支持的端点类型
 */
export const ENDPOINT_TYPES = {
  GENERAL_CHAT: 'general_chat',
  WORK_ASSISTANT: 'work_assistant',
  TRANSLATION: 'translation',
  CODE_GENERATION: 'code_generation'
};

/**
 * Provider配置验证工具
 */
export class ProviderConfigValidator {
  /**
   * 验证必需字段
   * @param {Object} config - 配置对象
   * @param {Array<string>} requiredFields - 必需字段列表
   * @throws {Error} 如果缺少必需字段
   */
  static validateRequiredFields(config, requiredFields) {
    const missingFields = requiredFields.filter(field => !config[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * 验证URL格式
   * @param {string} url - URL字符串
   * @param {string} fieldName - 字段名称
   * @throws {Error} 如果URL格式无效
   */
  static validateUrl(url, fieldName) {
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL format for ${fieldName}: ${url}`);
    }
  }
}