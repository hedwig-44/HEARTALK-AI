/**
 * 推理增强服务
 * 集成Chain-of-Thought和Self-Consistency推理机制
 */
import { getLogger } from '../utils/Logger.js';
import { defaultConfigManager } from '../utils/ConfigManager.js';
import { defaultBasicRouter } from './BasicRouter.js';

const logger = getLogger('reasoning-enhancer');

/**
 * 推理增强服务类
 * 提供Chain-of-Thought和Self-Consistency推理能力
 */
export class ReasoningEnhancer {
  constructor(config) {
    this.config = config || defaultConfigManager.getConfig('reasoning');
    this.enableChainOfThought = this.config.enableChainOfThought;
    this.enableSelfConsistency = this.config.enableSelfConsistency;
    this.selfConsistencySamples = this.config.selfConsistencySamples || 3;
    // 新增：控制是否显示推理过程，默认false（生产模式）
    this.showReasoningProcess = this.config.showReasoningProcess || false;
    
    logger.info('ReasoningEnhancer initialized', {
      enableChainOfThought: this.enableChainOfThought,
      enableSelfConsistency: this.enableSelfConsistency,
      selfConsistencySamples: this.selfConsistencySamples,
      showReasoningProcess: this.showReasoningProcess
    });
  }

  /**
   * 增强用户消息的推理能力
   * @param {Object} params - 参数对象
   * @param {string} params.message - 原始用户消息
   * @param {Array} params.context - 对话上下文
   * @param {Array} params.ragContext - RAG检索上下文
   * @param {Object} params.aiProvider - AI服务提供商
   * @returns {Promise<Object>} 增强后的响应
   */
  async enhanceReasoning(params) {
    const { message, context = [], ragContext = [], aiProvider } = params;
    
    try {
      // 使用BasicRouter进行智能路由判断
      const routingResult = await defaultBasicRouter.selectRoute(message, context);
      
      // 根据路由结果决定推理策略
      let needsComplexReasoning = false;
      if (routingResult.selectedRoute === 'complex_reasoning') {
        needsComplexReasoning = true;
        logger.info('BasicRouter detected complex reasoning needed', {
          message: message.substring(0, 100),
          confidence: routingResult.confidence,
          matches: routingResult.matches?.length || 0
        });
      } else {
        // 回退到原有的判断逻辑
        needsComplexReasoning = this.shouldUseSelfConsistency(message);
      }
      
      if (needsComplexReasoning && this.enableSelfConsistency) {
        logger.info('Using Self-Consistency reasoning', { message: message.substring(0, 100) });
        return await this.applySelfConsistency({
          message,
          context,
          ragContext,
          aiProvider
        });
      } else if (this.enableChainOfThought) {
        logger.info('Using Chain-of-Thought reasoning', { message: message.substring(0, 100) });
        return await this.applyChainOfThought({
          message,
          context,
          ragContext,
          aiProvider
        });
      } else {
        // 如果推理功能被禁用，直接调用原始AI服务
        logger.debug('Reasoning disabled, using direct response');
        return await aiProvider.generateResponse({
          message,
          context,
          ragContext
        });
      }
    } catch (error) {
      logger.error('Reasoning enhancement failed', {
        error: error.message,
        message: message.substring(0, 100)
      });
      
      // 降级到基础响应
      return await aiProvider.generateResponse({
        message,
        context,
        ragContext
      });
    }
  }

  /**
   * 应用Chain-of-Thought推理
   * @param {Object} params - 参数对象
   * @returns {Promise<Object>} CoT推理结果
   */
  async applyChainOfThought(params) {
    const { message, context, ragContext, aiProvider } = params;
    
    // 构建Chain-of-Thought prompt
    const cotPrompt = this.buildChainOfThoughtPrompt(message, ragContext);
    
    // 执行推理
    const response = await aiProvider.generateResponse({
      message: cotPrompt,
      context,
      ragContext: [] // CoT已经包含了RAG内容
    });

    // 添加推理标识
    if (response.success && response.data) {
      response.data.reasoningType = 'chain-of-thought';
      response.data.enhanced = true;
    }

    return response;
  }

  /**
   * 应用Self-Consistency推理验证
   * @param {Object} params - 参数对象
   * @returns {Promise<Object>} SC推理结果
   */
  async applySelfConsistency(params) {
    const { message, context, ragContext, aiProvider } = params;
    
    const samples = [];
    const cotPrompt = this.buildChainOfThoughtPrompt(message, ragContext);
    
    // 生成多个推理路径
    logger.debug(`Generating ${this.selfConsistencySamples} reasoning samples`);
    
    const samplePromises = [];
    for (let i = 0; i < this.selfConsistencySamples; i++) {
      const samplePrompt = this.buildSelfConsistencyPrompt(cotPrompt, i);
      
      samplePromises.push(
        aiProvider.generateResponse({
          message: samplePrompt,
          context,
          ragContext: [], // SC已经包含了所有上下文
          options: {
            modelParams: {
              temperature: 0.7 + (i * 0.1), // 为每个样本使用不同的温度
              max_tokens: 2000
            }
          }
        })
      );
    }
    
    // 并行执行所有推理路径
    const responses = await Promise.all(samplePromises);
    
    // 收集成功的响应
    for (let i = 0; i < responses.length; i++) {
      if (responses[i].success && responses[i].data?.content) {
        samples.push({
          index: i,
          content: responses[i].data.content,
          reasoning: this.extractReasoning(responses[i].data.content)
        });
      }
    }

    if (samples.length === 0) {
      throw new Error('All Self-Consistency samples failed');
    }

    // 选择最一致的答案
    const bestResponse = this.selectBestResponse(samples);
    
    // 构建最终响应
    const finalResponse = responses[bestResponse.index];
    if (finalResponse.success && finalResponse.data) {
      finalResponse.data.reasoningType = 'self-consistency';
      finalResponse.data.enhanced = true;
      finalResponse.data.samplesCount = samples.length;
      finalResponse.data.selectedSample = bestResponse.index;
    }

    logger.info('Self-Consistency reasoning completed', {
      samplesGenerated: responses.length,
      samplesSuccessful: samples.length,
      selectedIndex: bestResponse.index
    });

    return finalResponse;
  }

  /**
   * 构建Chain-of-Thought推理prompt
   * @param {string} message - 用户消息
   * @param {Array} ragContext - RAG上下文
   * @returns {string} CoT prompt
   */
  buildChainOfThoughtPrompt(message, ragContext = []) {
    let prompt = '';
    
    // 添加RAG上下文
    if (ragContext && ragContext.length > 0) {
      prompt += '参考信息:\n';
      ragContext.forEach((template, index) => {
        prompt += `${index + 1}. ${template.content}\n`;
      });
      prompt += '\n';
    }
    
    if (this.showReasoningProcess) {
      // 开发/调试模式：显示详细推理过程
      prompt += '请按照以下步骤逐步分析和回答问题:\n';
      prompt += '1. 首先理解问题的核心要点\n';
      prompt += '2. 分析相关的背景信息和约束条件\n';
      prompt += '3. 逐步推理可能的解决方案\n';
      prompt += '4. 评估不同方案的优缺点\n';
      prompt += '5. 给出最终的建议和结论\n\n';
      
      prompt += `用户问题: ${message}\n\n`;
      prompt += '请按照上述步骤进行详细的逐步分析:';
    } else {
      // 生产模式：内部推理但只返回最终答案
      prompt += '请运用逐步推理的方法深入分析这个问题，但只返回清晰、简洁、实用的最终答案。\n';
      prompt += '要求：\n';
      prompt += '- 基于逻辑推理得出答案，但不显示推理步骤\n';
      prompt += '- 答案要准确、有用、易于理解\n';
      prompt += '- 如果需要提供建议，请给出具体可行的方案\n';
      prompt += '- 保持回答的专业性和友好性\n\n';
      
      prompt += `用户问题: ${message}\n\n`;
      prompt += '请提供最终答案:';
    }
    
    return prompt;
  }

  /**
   * 构建Self-Consistency采样prompt
   * @param {string} basePrompt - 基础CoT prompt
   * @param {number} sampleIndex - 采样索引
   * @returns {string} SC采样prompt
   */
  buildSelfConsistencyPrompt(basePrompt, sampleIndex) {
    const variations = [
      '请从不同角度思考这个问题:',
      '让我们用另一种方式来分析:',
      '考虑其他可能的解决路径:'
    ];
    
    const variation = variations[sampleIndex % variations.length];
    return `${variation}\n\n${basePrompt}`;
  }

  /**
   * 判断是否需要Self-Consistency推理
   * @param {string} message - 用户消息
   * @returns {boolean} 是否需要复杂推理
   */
  shouldUseSelfConsistency(message) {
    // 复杂问题特征关键词
    const complexityIndicators = [
      '分析', '比较', '评估', '决策', '选择', '判断',
      '计划', '策略', '方案', '建议', '推荐',
      '如何', '为什么', '什么时候', '哪种', '哪个更好',
      '优缺点', '利弊', '风险', '机会', '挑战'
    ];
    
    const messageLower = message.toLowerCase();
    
    // 检查是否包含复杂推理关键词
    const hasComplexityIndicators = complexityIndicators.some(indicator => 
      messageLower.includes(indicator)
    );
    
    // 检查问题长度（长问题通常更复杂）
    const isLongQuestion = message.length > 50;
    
    // 检查是否包含多个问句
    const hasMultipleQuestions = (message.match(/[？?]/g) || []).length > 1;
    
    const needsComplex = hasComplexityIndicators || (isLongQuestion && hasMultipleQuestions);
    
    logger.debug('Complexity analysis', {
      hasComplexityIndicators,
      isLongQuestion,
      hasMultipleQuestions,
      needsComplex,
      messageLength: message.length
    });
    
    return needsComplex;
  }

  /**
   * 从响应中提取推理过程
   * @param {string} content - 响应内容
   * @returns {string} 推理摘要
   */
  extractReasoning(content) {
    // 简单提取：取前200字符作为推理摘要
    return content.substring(0, 200).trim();
  }

  /**
   * 选择最佳的一致性响应
   * @param {Array} samples - 所有样本
   * @returns {Object} 最佳响应
   */
  selectBestResponse(samples) {
    if (samples.length === 1) {
      return samples[0];
    }
    
    // 简单策略：选择中间长度的响应
    // 更复杂的策略可以基于语义相似性或置信度
    samples.sort((a, b) => a.content.length - b.content.length);
    
    const middleIndex = Math.floor(samples.length / 2);
    const selected = samples[middleIndex];
    
    logger.debug('Best response selection', {
      totalSamples: samples.length,
      selectedIndex: selected.index,
      selectedLength: selected.content.length
    });
    
    return selected;
  }

  /**
   * 获取推理配置
   * @returns {Object} 推理配置
   */
  getReasoningConfig() {
    return {
      enableChainOfThought: this.enableChainOfThought,
      enableSelfConsistency: this.enableSelfConsistency,
      selfConsistencySamples: this.selfConsistencySamples
    };
  }
}

/**
 * 默认推理增强服务实例
 */
export const defaultReasoningEnhancer = new ReasoningEnhancer();

export default ReasoningEnhancer;