/**
 * Chat Controller
 * 处理对话相关的API请求
 */
import { getLogger } from '../utils/Logger.js';
import { defaultProviderFactory } from '../services/ProviderFactory.js';
import { defaultConfigManager } from '../utils/ConfigManager.js';
import { defaultContextManager } from '../utils/ContextManager.js';
import { VikingDBService } from '../services/VikingDBService.js';
import { defaultReasoningEnhancer } from '../services/ReasoningEnhancer.js';

const logger = getLogger('chat-controller');
const config = defaultConfigManager;

/**
 * 对话控制器类
 * 处理对话生成、流式响应等功能
 */
export class ChatController {
  constructor() {
    // 获取AI服务提供商
    const byteplusConfig = config.getConfig('byteplus');
    this.provider = defaultProviderFactory.getProvider('byteplus', byteplusConfig);
    
    // 初始化上下文管理器
    this.contextManager = defaultContextManager;
    
    // 初始化推理增强服务
    this.reasoningEnhancer = defaultReasoningEnhancer;
    
    // 初始化VikingDB服务
    try {
      const vikingdbConfig = config.getConfig('vikingdb');
      this.vikingDBService = new VikingDBService(vikingdbConfig);
    } catch (error) {
      logger.warn('VikingDB service initialization failed, RAG features disabled', {
        error: error.message
      });
      this.vikingDBService = null;
    }
  }

  /**
   * 对话生成API
   * POST /api/v1/chat/generate
   */
  async generateChat(req, res) {
    const startTime = Date.now();
    
    try {
      // 参数验证
      const validationResult = this.validateChatRequest(req.body);
      if (!validationResult.valid) {
        return this.sendErrorResponse(res, {
          code: 'VALIDATION_ERROR',
          message: validationResult.error,
          requestId: req.requestId,
          status: 400
        });
      }

      // 处理不同格式的请求
      let conversation_id, message, user_id, options = {};
      
      if (validationResult.format === 'openai') {
        // OpenAI格式：从messages数组中提取最后一条用户消息
        const userMessages = req.body.messages.filter(msg => msg.role === 'user');
        message = userMessages[userMessages.length - 1]?.content || '';
        
        // 对于OpenAI格式，我们需要生成临时的conversation_id和user_id
        // 或者从请求头/token中获取
        conversation_id = req.body.conversation_id || 'temp-' + Date.now();
        user_id = req.body.user_id || req.user?.userId || 'anonymous';
        options = {
          model: req.body.model,
          temperature: req.body.temperature,
          max_tokens: req.body.max_tokens,
          messages: req.body.messages // 保留完整的messages数组
        };
      } else {
        // 原有格式
        ({ conversation_id, message, user_id, options = {} } = req.body);
      }

      logger.info('Chat generation request received', {
        requestId: req.requestId,
        conversationId: conversation_id,
        userId: user_id,
        messageLength: message.length,
        format: validationResult.format,
        options
      });

      // 获取对话上下文（包括历史对话）
      let conversationHistory = [];
      let context = {};
      
      if (validationResult.format === 'openai') {
        // OpenAI格式：直接使用提供的messages作为对话历史
        conversationHistory = options.messages || [];
        context = { messages: conversationHistory };
        logger.debug('Using provided messages as conversation history', {
          requestId: req.requestId,
          messagesCount: conversationHistory.length
        });
      } else {
        // 原有格式：从数据库获取对话历史
        const contextResult = await this.contextManager.getConversationContext(
          conversation_id,
          user_id
        );

        if (!contextResult.success) {
          logger.warn('Failed to get conversation context, proceeding without history', {
            requestId: req.requestId,
            conversationId: conversation_id,
            error: contextResult.error
          });
        }

        context = contextResult.data || {};
        conversationHistory = context.messages || [];
      }

      logger.debug('Conversation context retrieved', {
        requestId: req.requestId,
        conversationId: conversation_id,
        historyCount: conversationHistory.length,
        estimatedTokens: context.estimatedTokens || 0
      });

      // 执行RAG模板检索增强
      let ragContext = [];
      if (this.vikingDBService) {
        try {
          const templates = await this.retrieveCommunicationTemplates(message);
          if (templates && templates.length > 0) {
            ragContext = templates;
            logger.debug('RAG templates retrieved', {
              requestId: req.requestId,
              templatesCount: templates.length
            });
          }
        } catch (error) {
          logger.warn('RAG template retrieval failed, proceeding without enhancement', {
            requestId: req.requestId,
            error: error.message
          });
        }
      }

      // 准备AI服务参数
      const aiParams = {
        message,
        context: conversationHistory, // 传入对话历史
        ragContext: ragContext, // 传入RAG检索结果
        conversationId: conversation_id,
        userId: user_id,
        options: {
          endpointType: options.endpointType,
          modelParams: {
            temperature: options.modelParams?.temperature || 0.7,
            max_tokens: options.modelParams?.max_tokens || 2000
          }
        }
      };

      // 使用推理增强服务生成响应
      const response = await this.reasoningEnhancer.enhanceReasoning({
        message,
        context: conversationHistory,
        ragContext: ragContext,
        aiProvider: this.provider
      });

      // 调试日志：详细记录响应结构
      logger.info('Provider response received', {
        requestId: req.requestId,
        responseSuccess: response.success,
        responseProvider: response.provider,
        responseModel: response.model,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        contentExists: !!(response.data && response.data.content),
        contentLength: response.data?.content?.length || 0,
        error: response.error
      });

      // 记录成功日志
      const duration = Date.now() - startTime;
      logger.info('Chat generation completed successfully', {
        requestId: req.requestId,
        conversationId: conversation_id,
        duration: `${duration}ms`,
        tokensUsed: response.data?.usage?.total_tokens || 0,
        endpoint: response.model || response.endpoint,
        contentLength: response.data?.content?.length || 0
      });

      // 返回标准响应（包含推理增强信息）
      const responseData = {
        success: true,
        data: {
          content: response.data?.content || '',
          conversation_id,
          finish_reason: response.data?.finish_reason || 'stop',
          usage: response.data?.usage || {
            completion_tokens: 0,
            prompt_tokens: 0,
            total_tokens: 0
          }
        },
        provider: 'byteplus',
        endpoint: response.model || response.endpoint
      };

      // 添加推理增强相关信息
      if (response.data?.enhanced) {
        responseData.reasoning = {
          type: response.data.reasoningType,
          enhanced: true,
          samples_count: response.data.samplesCount,
          selected_sample: response.data.selectedSample
        };
      }

      res.json(responseData);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Chat generation failed', {
        requestId: req.requestId,
        error: error.message,
        duration: `${duration}ms`,
        stack: error.stack
      });

      this.sendErrorResponse(res, {
        code: this.mapErrorCode(error),
        message: error.message,
        requestId: req.requestId,
        status: this.getErrorStatus(error)
      });
    }
  }

  /**
   * 流式对话API
   * POST /api/v1/chat/stream
   */
  async streamChat(req, res) {
    const startTime = Date.now();
    
    try {
      // 参数验证
      const validationResult = this.validateStreamRequest(req.body);
      if (!validationResult.valid) {
        return this.sendErrorResponse(res, {
          code: 'VALIDATION_ERROR',
          message: validationResult.error,
          requestId: req.requestId,
          status: 400
        });
      }

      const { conversation_id, message, user_id } = req.body;

      logger.info('Stream chat request received', {
        requestId: req.requestId,
        conversationId: conversation_id,
        userId: user_id,
        messageLength: message.length
      });

      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // 准备流式响应参数
      const streamParams = {
        message,
        conversationId: conversation_id,
        userId: user_id
      };

      // 设置流式数据处理函数
      const onChunk = (chunk) => {
        try {
          if (res.writable && !res.destroyed) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        } catch (writeError) {
          logger.error('Error writing stream chunk', {
            requestId: req.requestId,
            error: writeError.message
          });
        }
      };

      // 调用流式AI服务
      await this.provider.generateStreamResponse(streamParams, onChunk);

      // 发送最终结束标记
      if (res.writable && !res.destroyed) {
        res.write('data: {"done": true}\n\n');
        res.end();
      }

      // 记录成功日志
      const duration = Date.now() - startTime;
      logger.info('Stream chat completed successfully', {
        requestId: req.requestId,
        conversationId: conversation_id,
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Stream chat failed', {
        requestId: req.requestId,
        error: error.message,
        duration: `${duration}ms`,
        stack: error.stack
      });

      // 对于流式响应，发送错误事件
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        this.sendErrorResponse(res, {
          code: this.mapErrorCode(error),
          message: error.message,
          requestId: req.requestId,
          status: this.getErrorStatus(error)
        });
      } else {
        // 如果已经开始流式响应，发送错误事件
        res.write(`data: ${JSON.stringify({
          error: error.message,
          done: true
        })}\n\n`);
        res.end();
      }
    }
  }

  /**
   * 验证对话生成请求
   * @param {Object} body - 请求体
   * @returns {Object} 验证结果
   */
  validateChatRequest(body) {
    // 支持两种格式：
    // 1. 原有格式：{ conversation_id, message, user_id }
    // 2. OpenAI格式：{ messages, model?, temperature?, ... }
    
    // 检查是否是OpenAI格式
    if (body.messages && Array.isArray(body.messages)) {
      // OpenAI格式验证
      if (body.messages.length === 0) {
        return { valid: false, error: 'messages array cannot be empty' };
      }
      
      for (const msg of body.messages) {
        if (!msg.role || !msg.content) {
          return { valid: false, error: 'each message must have role and content' };
        }
        if (typeof msg.content !== 'string') {
          return { valid: false, error: 'message content must be a string' };
        }
        if (msg.content.length > 10000) {
          return { valid: false, error: 'message content too long (max 10000 characters)' };
        }
      }
      
      return { valid: true, format: 'openai' };
    }
    
    // 原有格式验证
    const { conversation_id, message, user_id } = body;

    if (!conversation_id || typeof conversation_id !== 'string') {
      return { valid: false, error: 'conversation_id is required and must be a string' };
    }

    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'message is required and must be a string' };
    }

    if (!user_id || typeof user_id !== 'string') {
      return { valid: false, error: 'user_id is required and must be a string' };
    }

    if (message.length > 10000) {
      return { valid: false, error: 'message too long (max 10000 characters)' };
    }

    return { valid: true, format: 'legacy' };
  }

  /**
   * 验证流式请求
   * @param {Object} body - 请求体
   * @returns {Object} 验证结果
   */
  validateStreamRequest(body) {
    // 流式请求的验证规则与普通请求相同
    return this.validateChatRequest(body);
  }

  /**
   * 映射错误代码
   * @param {Error} error - 错误对象
   * @returns {string} 错误代码
   */
  mapErrorCode(error) {
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'AuthenticationError') return 'AUTHENTICATION_ERROR';
    if (error.name === 'TimeoutError') return 'TIMEOUT_ERROR';
    if (error.message.includes('rate limit')) return 'RATE_LIMIT_EXCEEDED';
    if (error.message.includes('Byteplus') || error.message.includes('AI Provider')) {
      return 'AI_PROVIDER_ERROR';
    }
    return 'INTERNAL_ERROR';
  }

  /**
   * 获取错误状态码
   * @param {Error} error - 错误对象
   * @returns {number} HTTP状态码
   */
  getErrorStatus(error) {
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'AuthenticationError') return 401;
    if (error.message.includes('rate limit')) return 429;
    if (error.name === 'TimeoutError') return 504;
    return 500;
  }

  /**
   * 发送错误响应
   * @param {Object} res - Express响应对象
   * @param {Object} errorInfo - 错误信息
   */
  sendErrorResponse(res, errorInfo) {
    const { code, message, requestId, status = 500 } = errorInfo;
    
    res.status(status).json({
      success: false,
      error: message,
      code,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 检索相关的沟通模板
   * @param {string} query - 查询文本
   * @returns {Array} 相关模板列表
   */
  async retrieveCommunicationTemplates(query) {
    if (!this.vikingDBService) {
      return [];
    }

    try {
      const vikingdbConfig = config.getConfig('vikingdb');
      const collectionName = vikingdbConfig.collections.communicationTemplates;

      // 执行向量相似度搜索
      const searchResult = await this.vikingDBService.searchVectors({
        collection: collectionName,
        query,
        topK: 3, // 返回最相关的3个模板
        scoreThreshold: 0.7 // 相似度阈值
      });

      if (!searchResult.success) {
        logger.warn('VikingDB search failed', {
          error: searchResult.error,
          query: query.substring(0, 100)
        });
        return [];
      }

      // 提取有用的模板内容
      const templates = searchResult.data?.results?.map(item => ({
        content: item.fields?.content || item.text,
        score: item.score,
        metadata: item.fields
      })) || [];

      return templates.filter(t => t.content && t.score > 0.7);

    } catch (error) {
      logger.error('Template retrieval failed', {
        error: error.message,
        query: query.substring(0, 100)
      });
      return [];
    }
  }
}

export default ChatController;