/**
 * BasicRouter - 基础路由器
 * 实现基于关键词的智能路由选择和缓存机制
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger('basic-router');

/**
 * LRU缓存实现
 */
class LRUCache {
  constructor(maxSize = 1000, ttl = 300000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
    this.timers = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const value = this.cache.get(key);
    
    // 移到最后（最近使用）
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  set(key, value) {
    // 如果已存在，删除旧的定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    // 如果缓存满了，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      if (this.timers.has(firstKey)) {
        clearTimeout(this.timers.get(firstKey));
        this.timers.delete(firstKey);
      }
    }

    this.cache.set(key, value);

    // 设置过期定时器
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, this.ttl);
    
    this.timers.set(key, timer);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * 关键词管理器
 */
class KeywordManager {
  constructor(keywordConfig) {
    this.routes = keywordConfig.routes || {};
    this.patterns = keywordConfig.patterns || {};
    this.settings = keywordConfig.settings || {};
    
    // 预处理关键词索引
    this.keywordIndex = this._buildKeywordIndex();
    
    logger.info('KeywordManager initialized', {
      routesCount: Object.keys(this.routes).length,
      totalKeywords: this._getTotalKeywordCount()
    });
  }

  /**
   * 构建关键词索引
   */
  _buildKeywordIndex() {
    const index = new Map();
    
    Object.entries(this.routes).forEach(([routeName, routeConfig]) => {
      routeConfig.keywords.forEach(keyword => {
        const normalizedKeyword = this.settings.case_sensitive ? keyword : keyword.toLowerCase();
        
        if (!index.has(normalizedKeyword)) {
          index.set(normalizedKeyword, []);
        }
        
        index.get(normalizedKeyword).push({
          route: routeName,
          weight: routeConfig.weight || 1.0,
          priority: routeConfig.priority || 999
        });
      });
    });
    
    return index;
  }

  /**
   * 获取总关键词数量
   */
  _getTotalKeywordCount() {
    return Object.values(this.routes).reduce((total, route) => {
      return total + (route.keywords ? route.keywords.length : 0);
    }, 0);
  }

  /**
   * 分析消息中的关键词匹配
   */
  analyzeKeywords(message) {
    const normalizedMessage = this.settings.case_sensitive ? message : message.toLowerCase();
    const matches = new Map();
    
    // 直接关键词匹配
    this.keywordIndex.forEach((routeInfos, keyword) => {
      if (normalizedMessage.includes(keyword)) {
        routeInfos.forEach(routeInfo => {
          const routeName = routeInfo.route;
          
          if (!matches.has(routeName)) {
            matches.set(routeName, {
              route: routeName,
              score: 0,
              matchedKeywords: [],
              weight: routeInfo.weight,
              priority: routeInfo.priority
            });
          }
          
          const match = matches.get(routeName);
          match.score += routeInfo.weight;
          match.matchedKeywords.push(keyword);
        });
      }
    });

    // 模式匹配增强
    this._enhanceWithPatterns(normalizedMessage, matches);
    
    return Array.from(matches.values())
      .sort((a, b) => {
        // 先按优先级排序，再按分数排序
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return b.score - a.score;
      });
  }

  /**
   * 使用模式增强匹配
   */
  _enhanceWithPatterns(message, matches) {
    Object.entries(this.patterns).forEach(([patternType, keywords]) => {
      const patternMatches = keywords.filter(keyword => 
        message.includes(this.settings.case_sensitive ? keyword : keyword.toLowerCase())
      );
      
      if (patternMatches.length > 0) {
        // 问句模式倾向于复杂推理
        if (patternType === 'question_words' || 
            patternType === 'comparison_words' || 
            patternType === 'analysis_words') {
          
          if (matches.has('complex_reasoning')) {
            matches.get('complex_reasoning').score += 0.5 * patternMatches.length;
          } else {
            matches.set('complex_reasoning', {
              route: 'complex_reasoning',
              score: 0.5 * patternMatches.length,
              matchedKeywords: patternMatches,
              weight: this.routes.complex_reasoning?.weight || 1.2,
              priority: this.routes.complex_reasoning?.priority || 1
            });
          }
        }
      }
    });
  }
}

/**
 * BasicRouter主类
 */
export class BasicRouter {
  constructor(options = {}) {
    this.confidenceThreshold = options.confidenceThreshold || 0.6;
    this.cacheEnabled = options.enableCache !== false;
    this.cache = null;
    this.keywordManager = null;
    
    // 统计信息
    this.stats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      routeSelections: new Map(),
      startTime: Date.now()
    };
    
    this._initialized = false;
  }

  /**
   * 初始化路由器
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    try {
      // 加载关键词配置
      const keywordConfig = await this._loadKeywordConfig();
      
      // 初始化关键词管理器
      this.keywordManager = new KeywordManager(keywordConfig);
      
      // 初始化缓存
      if (this.cacheEnabled) {
        const cacheSize = keywordConfig.settings?.cache_size || 1000;
        const cacheTtl = keywordConfig.settings?.cache_ttl || 300000;
        this.cache = new LRUCache(cacheSize, cacheTtl);
      }
      
      this._initialized = true;
      
      logger.info('BasicRouter initialized successfully', {
        cacheEnabled: this.cacheEnabled,
        confidenceThreshold: this.confidenceThreshold,
        routes: Object.keys(keywordConfig.routes)
      });
      
    } catch (error) {
      logger.error('Failed to initialize BasicRouter', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 加载关键词配置
   */
  async _loadKeywordConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'keywords.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      logger.warn('Failed to load keyword config, using default', {
        error: error.message
      });
      
      // 返回默认配置
      return {
        routes: {
          chat: {
            keywords: ['聊天', '问答', '帮助'],
            weight: 0.8,
            priority: 2
          }
        },
        settings: {
          confidence_threshold: 0.6,
          case_sensitive: false
        }
      };
    }
  }

  /**
   * 选择路由
   */
  async selectRoute(message, context = [], options = {}) {
    if (!this._initialized) {
      await this.initialize();
    }

    this.stats.totalQueries++;
    
    try {
      // 生成缓存键
      const cacheKey = this._generateCacheKey(message, context, options);
      
      // 尝试从缓存获取
      if (this.cacheEnabled && this.cache.has(cacheKey)) {
        const cachedResult = this.cache.get(cacheKey);
        this.stats.cacheHits++;
        
        logger.debug('Route selection from cache', {
          message: message.substring(0, 50),
          route: cachedResult.selectedRoute,
          confidence: cachedResult.confidence
        });
        
        return cachedResult;
      }
      
      this.stats.cacheMisses++;
      
      // 执行路由分析
      const result = await this._performRouteAnalysis(message, context, options);
      
      // 缓存结果
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, result);
      }
      
      // 更新统计
      const route = result.selectedRoute || 'none';
      this.stats.routeSelections.set(route, (this.stats.routeSelections.get(route) || 0) + 1);
      
      logger.info('Route selection completed', {
        message: message.substring(0, 50),
        selectedRoute: result.selectedRoute,
        confidence: result.confidence,
        matches: result.matches?.length || 0
      });
      
      return result;
      
    } catch (error) {
      logger.error('Route selection failed', {
        message: message.substring(0, 50),
        error: error.message
      });
      
      // 返回默认路由
      return {
        selectedRoute: 'chat',
        confidence: 0.1,
        matches: [],
        fallback: true,
        error: error.message
      };
    }
  }

  /**
   * 执行路由分析
   */
  async _performRouteAnalysis(message, context, options) {
    // 分析关键词匹配
    const keywordMatches = this.keywordManager.analyzeKeywords(message);
    
    // 上下文增强分析
    const contextEnhanced = this._enhanceWithContext(keywordMatches, context);
    
    // 选择最佳路由
    const bestMatch = contextEnhanced[0];
    
    if (!bestMatch) {
      return {
        selectedRoute: options.defaultRoute || 'chat',
        confidence: 0.1,
        matches: [],
        reason: 'no_keywords_matched'
      };
    }
    
    // 计算最终置信度
    const confidence = this._calculateConfidence(bestMatch, contextEnhanced.length, message.length);
    
    // 应用置信度阈值
    if (confidence < this.confidenceThreshold) {
      return {
        selectedRoute: options.defaultRoute || 'chat',
        confidence,
        matches: contextEnhanced,
        reason: 'confidence_below_threshold',
        threshold: this.confidenceThreshold
      };
    }
    
    return {
      selectedRoute: bestMatch.route,
      confidence,
      matches: contextEnhanced,
      selectedMatch: bestMatch,
      reason: 'keyword_match_success'
    };
  }

  /**
   * 基于上下文增强匹配结果
   */
  _enhanceWithContext(matches, context) {
    if (!context || context.length === 0) {
      return matches;
    }
    
    // 分析最近的对话上下文（最多3轮）
    const recentContext = context.slice(-6); // 3轮对话 = 6条消息
    const contextText = recentContext
      .map(msg => msg.content || '')
      .join(' ')
      .toLowerCase();
    
    // 基于上下文调整路由分数
    matches.forEach(match => {
      const routeKeywords = this.keywordManager.routes[match.route]?.keywords || [];
      const contextKeywordCount = routeKeywords.filter(keyword => 
        contextText.includes(keyword.toLowerCase())
      ).length;
      
      if (contextKeywordCount > 0) {
        // 上下文中有相关关键词，增加分数
        match.score += contextKeywordCount * 0.3;
        match.contextEnhanced = true;
        match.contextKeywords = contextKeywordCount;
      }
    });
    
    // 重新排序
    return matches.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.score - a.score;
    });
  }

  /**
   * 计算置信度
   */
  _calculateConfidence(bestMatch, totalMatches, messageLength) {
    let confidence = 0;
    
    // 基础分数归一化 (降低门槛)
    const normalizedScore = Math.min(bestMatch.score / 2.0, 1.0);
    confidence += normalizedScore * 0.5;
    
    // 关键词匹配数量 (增加权重)
    const keywordCount = bestMatch.matchedKeywords?.length || 0;
    confidence += Math.min(keywordCount / 2.0, 1.0) * 0.3;
    
    // 优先级加成
    if (bestMatch.priority === 1) {
      confidence += 0.1;
    }
    
    // 消息长度影响
    const lengthFactor = Math.min(messageLength / 30.0, 1.0);
    confidence += lengthFactor * 0.05;
    
    // 上下文增强影响
    if (bestMatch.contextEnhanced) {
      confidence += 0.15;
    }
    
    // 权重加成
    if (bestMatch.weight > 1.0) {
      confidence += (bestMatch.weight - 1.0) * 0.1;
    }
    
    // 确保置信度在合理范围内
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * 生成缓存键
   */
  _generateCacheKey(message, context, options) {
    const hash = crypto.createHash('sha256');
    hash.update(message);
    hash.update(JSON.stringify(options));
    
    // 只考虑最近的上下文
    if (context && context.length > 0) {
      const recentContext = context.slice(-4).map(msg => msg.content || '').join('|');
      hash.update(recentContext);
    }
    
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * 获取路由器统计信息
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const hitRate = this.stats.totalQueries > 0 
      ? (this.stats.cacheHits / this.stats.totalQueries * 100).toFixed(2)
      : 0;
    
    return {
      uptime: `${Math.floor(uptime / 1000)}s`,
      totalQueries: this.stats.totalQueries,
      cache: {
        enabled: this.cacheEnabled,
        hits: this.stats.cacheHits,
        misses: this.stats.cacheMisses,
        hitRate: `${hitRate}%`,
        size: this.cache?.size() || 0,
        stats: this.cache?.getStats() || null
      },
      routeDistribution: Object.fromEntries(this.stats.routeSelections),
      config: {
        confidenceThreshold: this.confidenceThreshold,
        initialized: this._initialized
      }
    };
  }

  /**
   * 清除缓存
   */
  clearCache() {
    if (this.cache) {
      this.cache.clear();
      logger.info('Router cache cleared');
    }
  }

  /**
   * 重新加载配置
   */
  async reloadConfig() {
    try {
      const keywordConfig = await this._loadKeywordConfig();
      this.keywordManager = new KeywordManager(keywordConfig);
      this.clearCache();
      
      logger.info('Router configuration reloaded successfully');
      return true;
    } catch (error) {
      logger.error('Failed to reload router configuration', {
        error: error.message
      });
      return false;
    }
  }
}

// 创建默认实例
export const defaultBasicRouter = new BasicRouter();

export default BasicRouter;