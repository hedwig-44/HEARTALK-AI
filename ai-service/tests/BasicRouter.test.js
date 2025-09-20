/**
 * BasicRouter 测试套件
 * 测试关键词路由、缓存机制和置信度计算
 */
import { jest } from '@jest/globals';
import { BasicRouter } from '../src/services/BasicRouter.js';
import fs from 'fs/promises';

// Mock文件系统
jest.mock('fs/promises');

// Mock Logger
jest.mock('../src/utils/Logger.js', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(), 
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('BasicRouter Tests', () => {
  let router;
  const mockKeywordConfig = {
    routes: {
      work_assistant: {
        name: "工作助手",
        keywords: ["工作", "任务", "项目", "计划", "管理"],
        weight: 1.0,
        priority: 1
      },
      chat: {
        name: "日常对话",
        keywords: ["聊天", "问答", "帮助", "生活"],
        weight: 0.8,
        priority: 2
      },
      complex_reasoning: {
        name: "复杂推理",
        keywords: ["分析", "比较", "评估", "决策", "推理"],
        weight: 1.2,
        priority: 1
      }
    },
    patterns: {
      question_words: ["如何", "为什么", "什么", "怎么"],
      comparison_words: ["比较", "对比", "区别"],
      analysis_words: ["分析", "评估", "判断"]
    },
    settings: {
      confidence_threshold: 0.6,
      case_sensitive: false,
      cache_size: 100,
      cache_ttl: 30000
    }
  };

  beforeEach(async () => {
    // 清理之前的mocks
    jest.clearAllMocks();
    
    // Mock fs.readFile 返回mock配置
    fs.readFile.mockResolvedValue(JSON.stringify(mockKeywordConfig));
    
    router = new BasicRouter({
      confidenceThreshold: 0.6,
      enableCache: true
    });
    
    await router.initialize();
  });

  afterEach(() => {
    router?.clearCache();
  });

  describe('Initialization', () => {
    test('应该成功初始化BasicRouter', async () => {
      expect(router._initialized).toBe(true);
      expect(router.keywordManager).toBeDefined();
      expect(router.cache).toBeDefined();
    });

    test('应该使用默认配置当文件读取失败时', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      const newRouter = new BasicRouter();
      await newRouter.initialize();
      
      expect(newRouter._initialized).toBe(true);
    });
  });

  describe('Route Selection - Basic Keywords', () => {
    test('应该正确识别工作相关关键词', async () => {
      const testCases = [
        { message: '我需要制定一个工作计划', expectedRoute: 'work_assistant' },
        { message: '请帮我分析这个项目的进度', expectedRoute: 'work_assistant' },
        { message: '今天的任务安排是什么', expectedRoute: 'work_assistant' },
        { message: '需要准备会议报告', expectedRoute: 'work_assistant' }
      ];

      for (const testCase of testCases) {
        const result = await router.selectRoute(testCase.message);
        expect(result.selectedRoute).toBe(testCase.expectedRoute);
        expect(result.confidence).toBeGreaterThan(0.6);
      }
    });

    test('应该正确识别日常对话关键词', async () => {
      const testCases = [
        { message: '你好，我想聊聊天', expectedRoute: 'chat' },
        { message: '我需要一些生活建议', expectedRoute: 'chat' },
        { message: '请问有什么可以帮助我的', expectedRoute: 'chat' }
      ];

      for (const testCase of testCases) {
        const result = await router.selectRoute(testCase.message);
        expect(result.selectedRoute).toBe(testCase.expectedRoute);
      }
    });

    test('应该正确识别复杂推理关键词', async () => {
      const testCases = [
        { message: '请帮我分析这两个方案的优缺点', expectedRoute: 'complex_reasoning' },
        { message: '我需要比较不同的解决方案', expectedRoute: 'complex_reasoning' },
        { message: '请评估这个决策的风险', expectedRoute: 'complex_reasoning' }
      ];

      for (const testCase of testCases) {
        const result = await router.selectRoute(testCase.message);
        expect(result.selectedRoute).toBe(testCase.expectedRoute);
        expect(result.confidence).toBeGreaterThan(0.6);
      }
    });
  });

  describe('Pattern Matching Enhancement', () => {
    test('应该通过问句模式增强复杂推理路由', async () => {
      const testCases = [
        '如何提高工作效率？',
        '为什么这个项目会延期？',
        '什么时候应该做决策？',
        '怎么分析市场趋势？'
      ];

      for (const message of testCases) {
        const result = await router.selectRoute(message);
        expect(['complex_reasoning', 'work_assistant']).toContain(result.selectedRoute);
      }
    });

    test('应该正确处理比较类问题', async () => {
      const message = '请比较A方案和B方案的区别';
      const result = await router.selectRoute(message);
      
      expect(result.selectedRoute).toBe('complex_reasoning');
      expect(result.matches).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  describe('Context Enhancement', () => {
    test('应该基于对话上下文调整路由分数', async () => {
      const context = [
        { role: 'user', content: '我在做一个工作项目' },
        { role: 'assistant', content: '好的，我来帮您' },
        { role: 'user', content: '需要制定计划' }
      ];

      const result = await router.selectRoute('怎么安排时间', context);
      
      // 上下文中有工作相关内容，应该倾向于work_assistant
      expect(result.selectedRoute).toBe('work_assistant');
      
      // 检查是否有上下文增强
      const workMatch = result.matches?.find(m => m.route === 'work_assistant');
      expect(workMatch?.contextEnhanced).toBe(true);
    });

    test('应该限制上下文分析的消息数量', async () => {
      // 创建大量上下文消息
      const longContext = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: i % 4 === 0 ? '工作相关内容' : '普通对话'
      }));

      const result = await router.selectRoute('请帮助我', longContext);
      
      // 应该正常处理，不会因为上下文过长而失败
      expect(result.selectedRoute).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Confidence Calculation', () => {
    test('应该为高匹配度关键词返回高置信度', async () => {
      const result = await router.selectRoute('我需要分析工作项目的计划和管理方案');
      
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.selectedRoute).toBe('work_assistant');
    });

    test('应该为模糊匹配返回较低置信度', async () => {
      const result = await router.selectRoute('帮我看看');
      
      expect(result.confidence).toBeLessThan(0.7);
    });

    test('应该在置信度低于阈值时返回默认路由', async () => {
      const result = await router.selectRoute('随便聊聊');
      
      if (result.confidence < 0.6) {
        expect(result.selectedRoute).toBe('chat'); // 默认路由
        expect(result.reason).toBe('confidence_below_threshold');
      }
    });
  });

  describe('Caching Mechanism', () => {
    test('应该缓存路由结果', async () => {
      const message = '我需要制定工作计划';
      
      // 第一次请求
      const result1 = await router.selectRoute(message);
      const stats1 = router.getStats();
      
      // 第二次请求相同内容
      const result2 = await router.selectRoute(message);
      const stats2 = router.getStats();
      
      expect(result1.selectedRoute).toBe(result2.selectedRoute);
      expect(stats2.cache.hits).toBe(stats1.cache.hits + 1);
    });

    test('应该为不同的上下文生成不同的缓存键', async () => {
      const message = '帮我处理这个';
      const context1 = [{ role: 'user', content: '工作项目' }];
      const context2 = [{ role: 'user', content: '生活问题' }];
      
      const result1 = await router.selectRoute(message, context1);
      const result2 = await router.selectRoute(message, context2);
      
      // 应该产生不同的结果，因为上下文不同
      const stats = router.getStats();
      expect(stats.cache.misses).toBe(2); // 两次都是缓存未命中
    });

    test('应该正确清除缓存', async () => {
      await router.selectRoute('测试消息');
      
      let stats = router.getStats();
      expect(stats.cache.size).toBeGreaterThan(0);
      
      router.clearCache();
      stats = router.getStats();
      expect(stats.cache.size).toBe(0);
    });
  });

  describe('Error Handling and Fallback', () => {
    test('应该在关键词匹配失败时返回默认路由', async () => {
      const result = await router.selectRoute('xyz unknown content abc');
      
      expect(result.selectedRoute).toBe('chat');
      expect(result.reason).toBeDefined();
    });

    test('应该在初始化失败时提供回退机制', async () => {
      const uninitializedRouter = new BasicRouter({ enableCache: false });
      
      // 不调用initialize，直接使用
      const result = await uninitializedRouter.selectRoute('工作计划');
      
      // 应该自动初始化并返回结果
      expect(result.selectedRoute).toBeDefined();
      expect(uninitializedRouter._initialized).toBe(true);
    });
  });

  describe('Performance and Statistics', () => {
    test('应该正确统计路由选择分布', async () => {
      const testMessages = [
        '工作计划',
        '项目管理', 
        '日常聊天',
        '生活帮助',
        '分析评估'
      ];
      
      for (const message of testMessages) {
        await router.selectRoute(message);
      }
      
      const stats = router.getStats();
      expect(stats.totalQueries).toBe(testMessages.length);
      expect(Object.keys(stats.routeDistribution).length).toBeGreaterThan(0);
    });

    test('应该提供缓存命中率统计', async () => {
      const message = '重复测试消息';
      
      // 多次请求相同内容
      await router.selectRoute(message);
      await router.selectRoute(message);
      await router.selectRoute(message);
      
      const stats = router.getStats();
      expect(stats.cache.hits).toBe(2); // 后两次应该是缓存命中
      expect(stats.cache.hitRate).toContain('%');
    });

    test('应该跟踪运行时间', async () => {
      const stats = router.getStats();
      expect(stats.uptime).toMatch(/\d+s/);
    });
  });

  describe('Configuration Reload', () => {
    test('应该支持重新加载配置', async () => {
      const newConfig = {
        ...mockKeywordConfig,
        routes: {
          ...mockKeywordConfig.routes,
          test_route: {
            name: "测试路由",
            keywords: ["测试"],
            weight: 1.0,
            priority: 1
          }
        }
      };
      
      fs.readFile.mockResolvedValue(JSON.stringify(newConfig));
      
      const success = await router.reloadConfig();
      expect(success).toBe(true);
      
      // 验证新配置生效
      const result = await router.selectRoute('这是一个测试');
      expect(result.selectedRoute).toBe('test_route');
    });

    test('应该在配置重新加载失败时返回false', async () => {
      fs.readFile.mockRejectedValue(new Error('Config load failed'));
      
      const success = await router.reloadConfig();
      expect(success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('应该处理空消息', async () => {
      const result = await router.selectRoute('');
      expect(result.selectedRoute).toBe('chat');
      expect(result.confidence).toBeLessThan(0.5);
    });

    test('应该处理非常长的消息', async () => {
      const longMessage = '工作'.repeat(1000) + '项目计划管理';
      const result = await router.selectRoute(longMessage);
      
      expect(result.selectedRoute).toBe('work_assistant');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('应该处理特殊字符和标点', async () => {
      const result = await router.selectRoute('工作！！@#项目？？？计划...');
      expect(result.selectedRoute).toBe('work_assistant');
    });

    test('应该处理大小写混合', async () => {
      const result = await router.selectRoute('WORK工作Plan计划PROJECT项目');
      expect(result.selectedRoute).toBe('work_assistant');
    });
  });
});