#!/usr/bin/env node

/**
 * Byteplus端点连通性测试脚本
 */

import { defaultConfigManager } from '../src/utils/ConfigManager.js';
import { getByteplusProvider } from '../src/services/ProviderFactory.js';

async function testByteplusEndpoints() {
  console.log('🔍 测试Byteplus端点连通性...\n');

  try {
    // 获取配置
    const config = defaultConfigManager.getConfig('byteplus');
    
    console.log('📋 配置信息:');
    console.log(`API Key: ${config.apiKey.substring(0, 8)}****`);
    console.log(`Chat端点: ${config.chatEndpoint}`);
    console.log(`Work Assistant端点: ${config.workAssistantEndpoint}`);
    console.log();

    // 创建Provider实例
    const provider = getByteplusProvider(config);
    
    console.log('🏥 执行健康检查...');
    const isHealthy = await provider.healthCheck();
    
    if (isHealthy) {
      console.log('✅ Byteplus服务健康检查通过');
    } else {
      console.log('❌ Byteplus服务健康检查失败');
      return false;
    }
    
    console.log('\n📊 获取支持的模型列表...');
    const models = await provider.getSupportedModels();
    console.log('支持的模型:');
    models.forEach(model => {
      console.log(`  - ${model.name} (${model.id}) [${model.type}]`);
    });

    console.log('\n🧪 测试简单对话生成...');
    
    // 测试通用端点
    console.log('\n测试通用对话端点...');
    const chatResponse = await provider.generateResponse({
      message: '你好，请简单介绍一下自己',
      context: [],
      options: { endpointType: 'general_chat' }
    });

    if (chatResponse.success) {
      console.log('✅ 通用对话端点响应成功');
      console.log(`响应内容: ${chatResponse.data.content.substring(0, 100)}...`);
    } else {
      console.log('❌ 通用对话端点响应失败');
      console.log(`错误信息: ${chatResponse.error}`);
    }

    // 测试工作助理端点  
    console.log('\n测试工作助理端点...');
    const workResponse = await provider.generateResponse({
      message: '帮我制定一个工作计划',
      context: [],
      options: { endpointType: 'work_assistant' }
    });

    if (workResponse.success) {
      console.log('✅ 工作助理端点响应成功');
      console.log(`响应内容: ${workResponse.data.content.substring(0, 100)}...`);
    } else {
      console.log('❌ 工作助理端点响应失败');
      console.log(`错误信息: ${workResponse.error}`);
    }

    console.log('\n🎯 测试端点选择逻辑...');
    
    // 测试关键词路由
    const testQueries = [
      '你好世界',                    // 应该选择通用端点
      '帮我安排明天的工作任务',         // 应该选择工作助理端点
      '什么是人工智能？',             // 应该选择通用端点
      '我需要写一份项目报告',          // 应该选择工作助理端点
    ];

    for (const query of testQueries) {
      const response = await provider.generateResponse({
        message: query,
        context: []
      });
      
      const endpointUsed = query.includes('工作') || query.includes('任务') || 
                          query.includes('项目') || query.includes('安排') ? 
                          '工作助理' : '通用对话';
      
      console.log(`查询: "${query}"`);
      console.log(`预期端点: ${endpointUsed}`);
      console.log(`响应状态: ${response.success ? '成功' : '失败'}`);
      console.log();
    }

    return true;

  } catch (error) {
    console.error('❌ 端点测试过程中发生错误:', error.message);
    console.error('错误详情:', error.stack);
    return false;
  }
}

// 执行测试
testByteplusEndpoints().then(success => {
  if (success) {
    console.log('✅ Byteplus端点测试完成!');
    process.exit(0);
  } else {
    console.log('❌ Byteplus端点测试失败!');
    process.exit(1);
  }
}).catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});