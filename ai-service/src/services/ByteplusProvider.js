import axios from 'axios';
import { AIProvider, AIResponse, ProviderConfigValidator } from '../models/AIProvider.js';
import { defaultBasicRouter } from './BasicRouter.js';

/**
 * Byteplus Model Ark AI Provider
 * 基于官方文档实现的Byteplus服务提供商
 */
export class ByteplusProvider extends AIProvider {
  constructor(config) {
    super(config);
    this.name = 'byteplus';
    
    // 验证必需配置
    this.validateConfig();
    
    // 设置HTTP客户端 (使用较短的默认超时，工作助理端点会动态调整)
    this.httpClient = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 工作助理端点的特殊超时设置
    this.workAssistantTimeout = config.workAssistantTimeout || 60000;

    // 端点配置
    this.endpoints = {
      chat: config.chatEndpoint,
      workAssistant: config.workAssistantEndpoint
    };

    // 默认模型配置
    this.defaultConfig = {
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 1.0,
      frequency_penalty: 0,
      presence_penalty: 0
    };
  }

  /**
   * 验证Byteplus Provider配置
   * @returns {boolean}
   * @throws {Error} 如果配置无效
   */
  validateConfig() {
    const requiredFields = ['apiKey', 'chatEndpoint', 'workAssistantEndpoint'];
    ProviderConfigValidator.validateRequiredFields(this.config, requiredFields);
    
    // 验证端点ID格式 (Byteplus使用端点ID，不是URL)
    if (!this.config.chatEndpoint.startsWith('ep-')) {
      throw new Error('chatEndpoint must be a valid Byteplus endpoint ID starting with "ep-"');
    }
    
    if (!this.config.workAssistantEndpoint.startsWith('ep-')) {
      throw new Error('workAssistantEndpoint must be a valid Byteplus endpoint ID starting with "ep-"');
    }
    
    return true;
  }

  /**
   * 生成对话响应
   * @param {Object} params
   * @param {string} params.message - 用户消息
   * @param {string} params.conversationId - 对话ID
   * @param {Array} params.context - 对话上下文
   * @param {Object} params.options - 附加选项
   * @returns {Promise<AIResponse>}
   */
  async generateResponse(params) {
    try {
      const { message, context = [], ragContext = [], options = {} } = params;
      
      // 选择合适的端点
      const endpoint = await this._selectEndpoint(message, options);
      
      // 构建消息格式 (OpenAI兼容格式)
      const messages = this._buildMessages(message, context, ragContext);
      
      // 构建请求参数
      const requestData = {
        model: endpoint,
        messages: messages,
        ...this.defaultConfig,
        ...options.modelParams
      };

      // 根据端点类型选择超时时间
      const timeoutMs = endpoint === this.endpoints.workAssistant 
        ? this.workAssistantTimeout 
        : this.httpClient.defaults.timeout;
      
      // 发送请求
      const response = await this.httpClient.post(
        'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
        requestData,
        { timeout: timeoutMs }
      );

      return this._handleResponse(response.data);

    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * 生成流式响应
   * @param {Object} params - 请求参数
   * @param {Function} onChunk - 流式数据回调
   * @returns {Promise<void>}
   */
  async generateStreamResponse(params, onChunk) {
    const { message, context = [], ragContext = [], options = {} } = params;
    
    try {
      // 选择合适的端点
      const endpoint = await this._selectEndpoint(message, options);
      
      // 构建消息格式
      const messages = this._buildMessages(message, context, ragContext);
      
      // 构建请求参数
      const requestData = {
        model: endpoint,
        messages: messages,
        stream: true,
        ...this.defaultConfig,
        ...options.modelParams
      };

      // 根据端点类型选择超时时间
      const timeoutMs = endpoint === this.endpoints.workAssistant 
        ? this.workAssistantTimeout 
        : this.httpClient.defaults.timeout;
      
      // 发送流式请求
      const response = await this.httpClient.post(
        'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
        requestData,
        {
          responseType: 'stream',
          timeout: timeoutMs
        }
      );

      return new Promise((resolve, reject) => {
        let streamEnded = false;

        // 处理流式数据
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              if (data === '[DONE]') {
                if (!streamEnded) {
                  streamEnded = true;
                  onChunk({ done: true });
                  resolve();
                }
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0]) {
                  const content = parsed.choices[0].delta?.content;
                  if (content) {
                    onChunk({
                      content: content,
                      done: false,
                      provider: this.name
                    });
                  }
                }
              } catch (parseError) {
                // 忽略解析错误，继续处理下一行
              }
            }
          }
        });

        response.data.on('end', () => {
          if (!streamEnded) {
            streamEnded = true;
            onChunk({ done: true });
            resolve();
          }
        });

        response.data.on('error', (error) => {
          if (!streamEnded) {
            streamEnded = true;
            onChunk({
              error: this._extractErrorMessage(error),
              done: true,
              provider: this.name
            });
            reject(error);
          }
        });
      });

    } catch (error) {
      onChunk({
        error: this._extractErrorMessage(error),
        done: true,
        provider: this.name
      });
      throw error;
    }
  }

  /**
   * 翻译文本 (使用通用chat端点)
   * @param {Object} params
   * @param {string} params.text - 待翻译文本
   * @param {string} params.targetLanguage - 目标语言
   * @param {Object} params.options - 翻译选项
   * @returns {Promise<AIResponse>}
   */
  async translateText(params) {
    try {
      const { text, targetLanguage, options = {} } = params;
      
      // 构建更精确的翻译prompt
      let translatePrompt;
      if (options.preserveFormatting) {
        translatePrompt = `请将以下文本翻译成${targetLanguage}，严格保持原文的格式、标点符号和结构，只翻译文本内容，不要添加任何解释：\n\n${text}`;
      } else {
        translatePrompt = `请将以下文本翻译成${targetLanguage}，保持自然流畅，只返回翻译结果，不要包含其他解释：\n\n${text}`;
      }
      
      const messages = [
        {
          role: 'system',
          content: '你是一个专业的翻译专家，能够准确翻译各种语言，保持原文的意思和语气。'
        },
        {
          role: 'user',
          content: translatePrompt
        }
      ];

      const requestData = {
        model: this.endpoints.chat,
        messages: messages,
        temperature: 0.3, // 翻译需要较低的随机性
        max_tokens: Math.max(text.length * 2, 500), // 动态调整token数量
        top_p: 0.9
      };

      const response = await this.httpClient.post(
        'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
        requestData,
        { timeout: this.httpClient.defaults.timeout }
      );

      const result = this._handleResponse(response.data);
      const translatedText = result.data.content;
      
      return AIResponse.success({
        original_text: text,
        translated_text: translatedText,
        target_language: targetLanguage,
        detected_language: this._detectLanguage(text),
        confidence: 0.9, // 基础置信度
        usage: response.data.usage
      }, this.name, this.endpoints.chat);

    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * 健康检查
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      // 发送简单的测试请求
      const testMessage = [{ role: 'user', content: 'Hello' }];
      
      const requestData = {
        model: this.endpoints.chat,
        messages: testMessage,
        max_tokens: 10
      };

      await this.httpClient.post(
        'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
        requestData
      );

      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Byteplus health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取支持的模型列表
   * @returns {Promise<Array>}
   */
  async getSupportedModels() {
    return [
      {
        id: this.endpoints.chat,
        name: 'General Chat Model',
        type: 'chat'
      },
      {
        id: this.endpoints.workAssistant,
        name: 'Work Assistant Model', 
        type: 'work_assistant'
      }
    ];
  }

  /**
   * 根据消息内容选择合适的端点
   * @param {string} message - 用户消息
   * @param {Object} options - 附加选项
   * @returns {string} 端点ID
   * @private
   */
  async _selectEndpoint(message, options = {}) {
    // 如果明确指定端点类型
    if (options.endpointType) {
      return options.endpointType === 'work_assistant' 
        ? this.endpoints.workAssistant 
        : this.endpoints.chat;
    }

    try {
      // 使用BasicRouter进行智能路由选择
      const routingResult = await defaultBasicRouter.selectRoute(message, [], {
        defaultRoute: 'chat'
      });

      // 映射路由结果到端点
      let endpoint;
      switch (routingResult.selectedRoute) {
        case 'work_assistant':
          endpoint = this.endpoints.workAssistant;
          break;
        case 'complex_reasoning':
          endpoint = this.endpoints.workAssistant;
          break;
        case 'chat':
        default:
          endpoint = this.endpoints.chat;
          break;
      }

      return endpoint;

    } catch (error) {
      // 路由失败时使用简单回退逻辑
      const workKeywords = ['工作', '任务', '项目', '计划', '安排', '会议', '报告', '分析'];
      const hasWorkKeyword = workKeywords.some(keyword => message.includes(keyword));
      
      return hasWorkKeyword ? this.endpoints.workAssistant : this.endpoints.chat;
    }
  }

  /**
   * 构建符合OpenAI格式的消息数组
   * @param {string} message - 用户消息
   * @param {Array} context - 对话上下文
   * @returns {Array} 消息数组
   * @private
   */
  _buildMessages(message, context = [], ragContext = []) {
    const messages = [];
    
    // 添加上下文消息
    for (const ctx of context) {
      if (ctx.role && ctx.content) {
        messages.push({
          role: ctx.role,
          content: ctx.content
        });
      }
    }
    
    // 构建包含RAG增强内容的用户消息
    let userMessage = message;
    if (ragContext && ragContext.length > 0) {
      const templateContent = ragContext.map(template => 
        `参考模板: ${template.content}`
      ).join('\n\n');
      
      userMessage = `${templateContent}\n\n用户问题: ${message}`;
    }
    
    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: userMessage
    });

    return messages;
  }

  /**
   * 处理API响应
   * @param {Object} responseData - API响应数据
   * @returns {AIResponse}
   * @private
   */
  _handleResponse(responseData) {
    try {
      if (responseData.choices && responseData.choices.length > 0) {
        const choice = responseData.choices[0];
        const content = choice.message?.content || choice.text || '';
        
        return AIResponse.success({
          content: content,
          finish_reason: choice.finish_reason,
          usage: responseData.usage
        }, this.name, responseData.model);
      }
      
      throw new Error('Invalid response format: no valid choices found');
    } catch (error) {
      return AIResponse.error(`Response processing error: ${error.message}`, this.name);
    }
  }

  /**
   * 处理API错误
   * @param {Error} error - 错误对象
   * @returns {AIResponse}
   * @private
   */
  _handleError(error) {
    const errorMessage = this._extractErrorMessage(error);
    return AIResponse.error(errorMessage, this.name);
  }

  /**
   * 提取错误消息
   * @param {Error} error - 错误对象
   * @returns {string} 错误消息
   * @private
   */
  _extractErrorMessage(error) {
    if (error.response) {
      // HTTP错误响应
      const status = error.response.status;
      const data = error.response.data;
      
      if (data && data.error) {
        return `HTTP ${status}: ${data.error.message || data.error}`;
      }
      
      return `HTTP ${status}: ${error.response.statusText}`;
    }
    
    if (error.request) {
      // 网络错误 - 添加更多调试信息
      return `Network error: ${error.code || 'Unable to reach Byteplus API'} - ${error.message}`;
    }
    
    // 其他错误
    return error.message || 'Unknown error occurred';
  }

  /**
   * 简单的语言检测
   * @param {string} text - 要检测的文本
   * @returns {string} 检测到的语言代码
   * @private
   */
  _detectLanguage(text) {
    const chineseRegex = /[\u4e00-\u9fff]/;
    const englishRegex = /[a-zA-Z]/;
    const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
    const koreanRegex = /[\uac00-\ud7af]/;
    const arabicRegex = /[\u0600-\u06ff]/;
    const russianRegex = /[\u0400-\u04ff]/;

    if (chineseRegex.test(text)) return 'zh';
    if (japaneseRegex.test(text)) return 'ja';
    if (koreanRegex.test(text)) return 'ko';
    if (arabicRegex.test(text)) return 'ar';
    if (russianRegex.test(text)) return 'ru';
    if (englishRegex.test(text)) return 'en';

    return 'unknown';
  }
}

export default ByteplusProvider;