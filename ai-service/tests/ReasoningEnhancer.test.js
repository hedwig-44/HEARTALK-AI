/**
 * ReasoningEnhancer 测试
 * 测试Chain-of-Thought和Self-Consistency推理功能
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ReasoningEnhancer } from '../src/services/ReasoningEnhancer.js';

describe('ReasoningEnhancer', () => {
  let reasoningEnhancer;
  let mockProvider;

  beforeAll(() => {
    // 创建模拟AI提供商
    mockProvider = {
      generateResponse: async (params) => {
        const { message } = params;
        
        // 根据消息内容返回不同的模拟响应
        if (message.includes('分析')) {
          return {
            success: true,
            data: {
              content: `步骤1：理解问题核心\n步骤2：分析相关因素\n步骤3：得出结论\n\n这是对"${message}"的详细分析结果。`,
              finish_reason: 'stop'
            }
          };
        }
        
        return {
          success: true,
          data: {
            content: `这是对"${message}"的回答。`,
            finish_reason: 'stop'
          }
        };
      }
    };

    // 创建推理增强器实例
    const config = {
      enableChainOfThought: true,
      enableSelfConsistency: true,
      selfConsistencySamples: 3
    };
    reasoningEnhancer = new ReasoningEnhancer(config);
  });

  describe('shouldUseSelfConsistency', () => {
    test('should return true for complex questions with analysis keywords', () => {
      const complexMessage = '请分析这个商业决策的优缺点';
      const result = reasoningEnhancer.shouldUseSelfConsistency(complexMessage);
      expect(result).toBe(true);
    });

    test('should return false for simple questions', () => {
      const simpleMessage = '你好';
      const result = reasoningEnhancer.shouldUseSelfConsistency(simpleMessage);
      expect(result).toBe(false);
    });

    test('should return true for long questions with multiple question marks', () => {
      const longMessage = '这个产品的市场前景如何？我们应该如何定价？竞争对手的策略是什么？';
      const result = reasoningEnhancer.shouldUseSelfConsistency(longMessage);
      expect(result).toBe(true);
    });
  });

  describe('buildChainOfThoughtPrompt', () => {
    test('should build proper CoT prompt without RAG context', () => {
      const message = '请分析这个方案';
      const prompt = reasoningEnhancer.buildChainOfThoughtPrompt(message, []);
      
      expect(prompt).toContain('请按照以下步骤逐步分析');
      expect(prompt).toContain('用户问题: 请分析这个方案');
      expect(prompt).toContain('1. 首先理解问题的核心要点');
    });

    test('should build CoT prompt with RAG context', () => {
      const message = '请分析这个方案';
      const ragContext = [
        { content: '参考案例A' },
        { content: '参考案例B' }
      ];
      
      const prompt = reasoningEnhancer.buildChainOfThoughtPrompt(message, ragContext);
      
      expect(prompt).toContain('参考信息:');
      expect(prompt).toContain('1. 参考案例A');
      expect(prompt).toContain('2. 参考案例B');
      expect(prompt).toContain('用户问题: 请分析这个方案');
    });
  });

  describe('buildSelfConsistencyPrompt', () => {
    test('should add variation prefix to base prompt', () => {
      const basePrompt = '请分析这个问题';
      const sampleIndex = 0;
      
      const result = reasoningEnhancer.buildSelfConsistencyPrompt(basePrompt, sampleIndex);
      
      expect(result).toContain('请从不同角度思考这个问题:');
      expect(result).toContain(basePrompt);
    });

    test('should cycle through different variations', () => {
      const basePrompt = '请分析这个问题';
      
      const variation0 = reasoningEnhancer.buildSelfConsistencyPrompt(basePrompt, 0);
      const variation1 = reasoningEnhancer.buildSelfConsistencyPrompt(basePrompt, 1);
      const variation2 = reasoningEnhancer.buildSelfConsistencyPrompt(basePrompt, 2);
      
      expect(variation0).toContain('请从不同角度思考这个问题:');
      expect(variation1).toContain('让我们用另一种方式来分析:');
      expect(variation2).toContain('考虑其他可能的解决路径:');
    });
  });

  describe('applyChainOfThought', () => {
    test('should enhance simple message with CoT reasoning', async () => {
      const params = {
        message: '请分析这个决策',
        context: [],
        ragContext: [],
        aiProvider: mockProvider
      };

      const result = await reasoningEnhancer.applyChainOfThought(params);

      expect(result.success).toBe(true);
      expect(result.data.reasoningType).toBe('chain-of-thought');
      expect(result.data.enhanced).toBe(true);
      expect(result.data.content).toContain('步骤');
    });
  });

  describe('enhanceReasoning', () => {
    test('should use Chain-of-Thought for simple messages when SC is disabled', async () => {
      const enhancer = new ReasoningEnhancer({
        enableChainOfThought: true,
        enableSelfConsistency: false,
        selfConsistencySamples: 3
      });

      const params = {
        message: '请分析这个复杂的商业策略决策',
        context: [],
        ragContext: [],
        aiProvider: mockProvider
      };

      const result = await enhancer.enhanceReasoning(params);

      expect(result.success).toBe(true);
      expect(result.data.reasoningType).toBe('chain-of-thought');
      expect(result.data.enhanced).toBe(true);
    });

    test('should fall back to direct response when reasoning is disabled', async () => {
      const enhancer = new ReasoningEnhancer({
        enableChainOfThought: false,
        enableSelfConsistency: false
      });

      const params = {
        message: '简单问题',
        context: [],
        ragContext: [],
        aiProvider: mockProvider
      };

      const result = await enhancer.enhanceReasoning(params);

      expect(result.success).toBe(true);
      expect(result.data.enhanced).toBeUndefined();
    });
  });

  describe('selectBestResponse', () => {
    test('should return single sample when only one available', () => {
      const samples = [
        { index: 0, content: '短回答', reasoning: '简短推理' }
      ];

      const result = reasoningEnhancer.selectBestResponse(samples);
      expect(result).toEqual(samples[0]);
    });

    test('should select middle length response from multiple samples', () => {
      const samples = [
        { index: 0, content: '很短', reasoning: '短推理' },
        { index: 1, content: '中等长度的回答内容', reasoning: '中等推理' },
        { index: 2, content: '这是一个非常详细和冗长的回答，包含了大量的分析和解释内容', reasoning: '详细推理' }
      ];

      const result = reasoningEnhancer.selectBestResponse(samples);
      expect(result.index).toBe(1); // 中等长度的回答
    });
  });

  describe('getReasoningConfig', () => {
    test('should return current configuration', () => {
      const config = reasoningEnhancer.getReasoningConfig();
      
      expect(config).toHaveProperty('enableChainOfThought');
      expect(config).toHaveProperty('enableSelfConsistency');
      expect(config).toHaveProperty('selfConsistencySamples');
      expect(typeof config.enableChainOfThought).toBe('boolean');
      expect(typeof config.enableSelfConsistency).toBe('boolean');
      expect(typeof config.selfConsistencySamples).toBe('number');
    });
  });

  describe('extractReasoning', () => {
    test('should extract first 200 characters as reasoning summary', () => {
      const longContent = 'A'.repeat(300);
      const result = reasoningEnhancer.extractReasoning(longContent);
      
      expect(result.length).toBe(200);
      expect(result).toBe('A'.repeat(200));
    });

    test('should return content as-is if shorter than 200 chars', () => {
      const shortContent = '简短内容';
      const result = reasoningEnhancer.extractReasoning(shortContent);
      
      expect(result).toBe(shortContent);
    });
  });
});