#!/usr/bin/env node

/**
 * 专门测试工作助理端点
 */

import axios from 'axios';
import { defaultConfigManager } from '../src/utils/ConfigManager.js';

async function testWorkAssistantEndpoint() {
  console.log('🔍 专门测试工作助理端点...\n');

  try {
    const config = defaultConfigManager.getConfig('byteplus');
    
    const client = axios.create({
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const testData = {
      model: config.workAssistantEndpoint,
      messages: [
        {
          role: 'user',
          content: '帮我制定一个工作计划'
        }
      ],
      max_tokens: 200
    };

    console.log('📋 测试配置:');
    console.log(`工作助理端点: ${config.workAssistantEndpoint}`);
    console.log(`API Key: ${config.apiKey.substring(0, 12)}****\n`);

    console.log('🌐 发送请求...');
    const response = await client.post(
      'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
      testData
    );

    console.log('✅ 工作助理端点调用成功!');
    console.log('响应状态:', response.status);
    console.log('响应内容:', response.data.choices[0].message.content);
    
    return true;

  } catch (error) {
    console.error('❌ 工作助理端点调用失败:');
    
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('状态文本:', error.response.statusText);
      if (error.response.data) {
        console.error('错误详情:', JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.request) {
      console.error('网络错误 - 无法连接到服务器');
      console.error('请求配置:', error.config.url);
    } else {
      console.error('错误信息:', error.message);
    }
    
    return false;
  }
}

testWorkAssistantEndpoint().then(success => {
  process.exit(success ? 0 : 1);
});