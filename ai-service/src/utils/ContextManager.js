/**
 * 上下文管理器
 * 处理对话历史获取、用户信息管理和上下文构建
 */
import { defaultBackendApiClient } from '../services/BackendApiClient.js';
import { getLogger } from './Logger.js';

const logger = getLogger('context-manager');

export class ContextManager {
  constructor() {
    this.backendClient = defaultBackendApiClient;
    this.maxContextTokens = parseInt(process.env.MAX_CONTEXT_TOKENS) || 2000;
    this.maxConversationRounds = parseInt(process.env.MAX_CONVERSATION_ROUNDS) || 10;
    
    // 缓存配置
    this.conversationCache = new Map();
    this.userContextCache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15分钟缓存
  }

  /**
   * 获取对话上下文
   * @param {string} conversationId - 对话ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 上下文数据
   */
  async getConversationContext(conversationId, userId) {
    try {
      logger.info('Building conversation context', {
        conversationId,
        userId
      });

      // 并行获取对话历史和用户上下文
      const [conversationHistory, userContext] = await Promise.all([
        this.getConversationHistory(conversationId),
        this.getUserContext(userId)
      ]);

      // 构建消息上下文
      const messages = this.buildMessageContext(conversationHistory.data);
      
      // 构建用户信息上下文  
      const userInfo = this.buildUserInfoContext(userContext.data);

      const context = {
        conversationId,
        userId,
        messages: messages || [],
        userInfo: userInfo || {},
        totalMessages: messages?.length || 0,
        estimatedTokens: this.estimateTokenCount(messages)
      };

      logger.info('Context built successfully', {
        conversationId,
        totalMessages: context.totalMessages,
        estimatedTokens: context.estimatedTokens
      });

      return {
        success: true,
        data: context
      };

    } catch (error) {
      logger.error('Failed to build conversation context', {
        conversationId,
        userId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        data: {
          conversationId,
          userId,
          messages: [],
          userInfo: {},
          totalMessages: 0,
          estimatedTokens: 0
        }
      };
    }
  }

  /**
   * 获取对话历史（带缓存）
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Object>} 对话历史
   */
  async getConversationHistory(conversationId) {
    const cacheKey = `conv_${conversationId}`;
    const cached = this.conversationCache.get(cacheKey);

    // 检查缓存是否有效
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      logger.debug('Using cached conversation history', {
        conversationId
      });
      return cached.data;
    }

    // 从Backend API获取
    const result = await this.backendClient.getConversationHistory(conversationId);
    
    if (result.success) {
      // 缓存结果
      this.conversationCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * 获取用户上下文（带缓存）
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 用户上下文
   */
  async getUserContext(userId) {
    const cacheKey = `user_${userId}`;
    const cached = this.userContextCache.get(cacheKey);

    // 检查缓存是否有效
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      logger.debug('Using cached user context', {
        userId
      });
      return cached.data;
    }

    // 从Backend API获取
    const result = await this.backendClient.getUserContext(userId);
    
    if (result.success) {
      // 缓存结果
      this.userContextCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * 构建消息上下文
   * @param {Object} conversationData - 对话数据
   * @returns {Array} 消息数组
   */
  buildMessageContext(conversationData) {
    if (!conversationData?.messages || !Array.isArray(conversationData.messages)) {
      logger.warn('No valid messages in conversation data');
      return [];
    }

    let messages = conversationData.messages;
    
    // 限制对话轮次
    if (messages.length > this.maxConversationRounds * 2) {
      messages = messages.slice(-(this.maxConversationRounds * 2));
      logger.debug('Trimmed messages to max conversation rounds', {
        originalCount: conversationData.messages.length,
        trimmedCount: messages.length
      });
    }

    // 转换为标准格式
    const formattedMessages = messages.map(msg => ({
      role: msg.role || 'user',
      content: msg.content || msg.message || '',
      timestamp: msg.timestamp || msg.created_at,
      messageId: msg.id || msg.message_id
    })).filter(msg => msg.content.trim().length > 0);

    // 检查token限制
    const estimatedTokens = this.estimateTokenCount(formattedMessages);
    if (estimatedTokens > this.maxContextTokens) {
      // 如果超过token限制，从最新的消息开始截取
      let truncatedMessages = [];
      let currentTokens = 0;
      
      for (let i = formattedMessages.length - 1; i >= 0; i--) {
        const msgTokens = this.estimateTokenCount([formattedMessages[i]]);
        if (currentTokens + msgTokens <= this.maxContextTokens) {
          truncatedMessages.unshift(formattedMessages[i]);
          currentTokens += msgTokens;
        } else {
          break;
        }
      }

      logger.debug('Truncated messages due to token limit', {
        originalCount: formattedMessages.length,
        truncatedCount: truncatedMessages.length,
        estimatedTokens: currentTokens
      });

      return truncatedMessages;
    }

    return formattedMessages;
  }

  /**
   * 构建用户信息上下文
   * @param {Object} userData - 用户数据
   * @returns {Object} 用户信息对象
   */
  buildUserInfoContext(userData) {
    if (!userData || typeof userData !== 'object') {
      return {};
    }

    return {
      userId: userData.user_id || userData.id,
      profile: userData.profile || {},
      preferences: userData.preferences || {},
      settings: userData.settings || {},
      permissions: userData.permissions || [],
      // 敏感信息过滤
      lastLogin: userData.last_login,
      accountStatus: userData.account_status
    };
  }

  /**
   * 估算token数量（简化版本）
   * @param {Array} messages - 消息数组
   * @returns {number} 估算的token数量
   */
  estimateTokenCount(messages) {
    if (!Array.isArray(messages)) {
      return 0;
    }

    let totalCount = 0;
    
    for (const msg of messages) {
      const content = msg.content || '';
      // 简化估算：中文字符按1.5个token计算，英文单词按1个token计算
      const chineseCount = (content.match(/[\u4e00-\u9fff]/g) || []).length;
      const englishWords = content.replace(/[\u4e00-\u9fff]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 0).length;
      
      totalCount += Math.ceil(chineseCount * 1.5) + englishWords;
    }

    return totalCount;
  }

  /**
   * 清除缓存
   * @param {string} type - 缓存类型（'conversation' | 'user' | 'all'）
   */
  clearCache(type = 'all') {
    switch (type) {
    case 'conversation':
      this.conversationCache.clear();
      logger.info('Conversation cache cleared');
      break;
    case 'user':
      this.userContextCache.clear();
      logger.info('User context cache cleared');
      break;
    case 'all':
    default:
      this.conversationCache.clear();
      this.userContextCache.clear();
      logger.info('All cache cleared');
      break;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return {
      conversation: {
        size: this.conversationCache.size,
        entries: Array.from(this.conversationCache.keys())
      },
      user: {
        size: this.userContextCache.size,
        entries: Array.from(this.userContextCache.keys())
      },
      config: {
        maxContextTokens: this.maxContextTokens,
        maxConversationRounds: this.maxConversationRounds,
        cacheTimeout: this.cacheTimeout
      }
    };
  }
}

// 创建默认实例
export const defaultContextManager = new ContextManager();

export default ContextManager;