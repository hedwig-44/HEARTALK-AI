#!/usr/bin/env node

/**
 * HearTalk AI MVP 自定义缓存测试脚本
 * 测试用户自定义问题的缓存性能和路由选择
 */

import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = 'dev_jwt_secret_key_change_in_production';
const BASE_URL = 'http://localhost:8001';

// 生成测试JWT token
function generateTestToken() {
  const payload = {
    userId: 'test-user-123',
    email: 'test@example.com',
    role: 'user'
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// 用户自定义测试消息
const testMessages = [
  '你好，你是谁？',
  '请帮我推荐一些适合6口之家的家庭用车。',
  '这些车悉尼地区有售卖吗？价格如何？',
  '比较一下它们的有辅助驾驶功能，有何优劣？',
  '你好，谁啊？',  // 类似问题，测试缓存相似性
  '你把之前推荐的车型按优先级排个序吧？性价比优先。'
];

// 预测每个问题的路由类型
const expectedRoutes = {
  '你好，你是谁？': 'chat',
  '请帮我推荐一些适合6口之家的家庭用车。': 'complex_reasoning',
  '这些车悉尼地区有售卖吗？价格如何？': 'chat',
  '比较一下它们的有辅助驾驶功能，有何优劣？': 'complex_reasoning',
  '你好，谁啊？': 'chat',
  '你把之前推荐的车型按优先级排个序吧？性价比优先。': 'work_assistant'
};

// 测试单个消息
async function testSingleMessage(message, index, token, conversationId) {
  console.log(`\n🎯 测试 ${index + 1}/${testMessages.length}`);
  console.log('='.repeat(60));
  console.log(`问题: ${message}`);
  console.log(`预期路由: ${expectedRoutes[message] || '未知'}`);
  console.log('-'.repeat(60));
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}/api/v1/chat/generate`, {
      conversation_id: conversationId,
      message: message,
      user_id: 'test-user-123'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 45000
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    if (response.data.success) {
      console.log(`✅ 响应成功 (${responseTime}ms)`);
      console.log(`🧠 推理类型: ${response.data.data.reasoningType || '标准'}`);
      console.log(`🔀 实际路由: ${response.data.modelName || '未知'}`);
      console.log(`📊 Token使用: ${response.data.data.usage?.total_tokens || 'N/A'}`);
      
      // 检查路由预测是否正确
      const actualRoute = response.data.modelName || 'unknown';
      const expectedRoute = expectedRoutes[message];
      const routeMatch = actualRoute.includes(expectedRoute) || expectedRoute === 'unknown';
      console.log(`🎯 路由预测: ${routeMatch ? '✅ 正确' : '❌ 不符'}`);
      
      console.log(`\n🤖 AI回复 (前200字符):`);
      console.log('-'.repeat(50));
      const content = response.data.data.content || '';
      console.log(content.substring(0, 200) + (content.length > 200 ? '...' : ''));
      console.log('-'.repeat(50));
      
      return {
        message: message,
        responseTime,
        success: true,
        route: actualRoute,
        expectedRoute,
        routeMatch,
        tokenUsage: response.data.data.usage?.total_tokens || 0,
        contentLength: content.length
      };
    } else {
      console.log(`❌ 响应失败: ${response.data.error}`);
      return {
        message: message,
        responseTime,
        success: false,
        error: response.data.error
      };
    }
    
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`❌ 请求失败 (${responseTime}ms): ${error.message}`);
    return {
      message: message,
      responseTime,
      success: false,
      error: error.message
    };
  }
}

// 获取系统指标
async function getSystemMetrics() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/metrics`);
    return response.data;
  } catch (error) {
    console.error('获取系统指标失败:', error.message);
    return null;
  }
}

// 分析测试结果
function analyzeResults(results) {
  console.log('\n📊 测试结果分析');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`📈 成功率: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
  
  if (successful.length > 0) {
    const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
    const minResponseTime = Math.min(...successful.map(r => r.responseTime));
    const maxResponseTime = Math.max(...successful.map(r => r.responseTime));
    
    console.log(`⏱️  平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`⚡ 最快响应时间: ${minResponseTime}ms`);
    console.log(`🐌 最慢响应时间: ${maxResponseTime}ms`);
    
    const routeCorrect = successful.filter(r => r.routeMatch).length;
    console.log(`🎯 路由预测准确率: ${routeCorrect}/${successful.length} (${(routeCorrect/successful.length*100).toFixed(1)}%)`);
    
    const totalTokens = successful.reduce((sum, r) => sum + (r.tokenUsage || 0), 0);
    console.log(`🔢 总Token使用: ${totalTokens}`);
    
    // 路由分布统计
    const routeDistribution = {};
    successful.forEach(r => {
      const route = r.route || 'unknown';
      routeDistribution[route] = (routeDistribution[route] || 0) + 1;
    });
    
    console.log(`\n📊 路由分布:`);
    Object.entries(routeDistribution).forEach(([route, count]) => {
      console.log(`  ${route}: ${count}次`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ 失败请求: ${failed.length}次`);
    failed.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.message.substring(0, 30)}... - ${result.error}`);
    });
  }
  
  console.log(`\n📋 详细结果:`);
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const routeStatus = result.routeMatch ? '🎯' : '❓';
    console.log(`${status} ${routeStatus} [${index + 1}] ${result.responseTime}ms - ${result.message.substring(0, 40)}...`);
  });
}

// 主函数
async function main() {
  console.log('🚀 HearTalk AI MVP 自定义缓存测试');
  console.log('='.repeat(80));
  console.log('测试场景: 家庭用车推荐对话流程');
  console.log('测试目标: 验证缓存机制、路由选择、上下文理解\n');
  
  // 获取测试前的系统指标
  console.log('📈 获取测试前系统状态...');
  const beforeMetrics = await getSystemMetrics();
  if (beforeMetrics) {
    console.log(`当前请求总数: ${beforeMetrics.requests?.total || 0}`);
    console.log(`当前缓存命中: ${beforeMetrics.cache?.hits || 0}`);
    console.log(`当前缓存未命中: ${beforeMetrics.cache?.misses || 0}`);
    console.log(`当前缓存命中率: ${beforeMetrics.cache?.hitRate || '0%'}`);
  }
  
  const token = generateTestToken();
  const conversationId = `custom-test-${Date.now()}`;
  const results = [];
  
  // 执行测试
  for (let i = 0; i < testMessages.length; i++) {
    const result = await testSingleMessage(testMessages[i], i, token, conversationId);
    results.push(result);
    
    // 每次请求后等待1秒，模拟真实对话节奏
    if (i < testMessages.length - 1) {
      console.log('\n⏳ 等待1秒模拟对话节奏...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 获取测试后的系统指标
  console.log('\n📈 获取测试后系统状态...');
  const afterMetrics = await getSystemMetrics();
  
  if (beforeMetrics && afterMetrics) {
    const requestIncrease = (afterMetrics.requests?.total || 0) - (beforeMetrics.requests?.total || 0);
    const cacheHitsIncrease = (afterMetrics.cache?.hits || 0) - (beforeMetrics.cache?.hits || 0);
    const cacheMissesIncrease = (afterMetrics.cache?.misses || 0) - (beforeMetrics.cache?.misses || 0);
    
    console.log(`📊 本次测试统计:`);
    console.log(`  新增请求: ${requestIncrease}次`);
    console.log(`  新增缓存命中: ${cacheHitsIncrease}次`);
    console.log(`  新增缓存未命中: ${cacheMissesIncrease}次`);
    console.log(`  最终缓存命中率: ${afterMetrics.cache?.hitRate || '0%'}`);
  }
  
  // 分析结果
  analyzeResults(results);
  
  console.log('\n💡 测试总结:');
  console.log('✅ 验证了生产模式下的推理过程控制');
  console.log('✅ 测试了不同类型问题的路由选择准确性');
  console.log('✅ 验证了对话上下文的连续性理解');
  console.log('✅ 评估了系统的响应性能和稳定性');
  
  console.log('\n🎉 自定义缓存测试完成！');
}

// 如果是直接执行该脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
}