#!/usr/bin/env node

/**
 * Byteplus API调试脚本
 */

import axios from 'axios';
import { defaultConfigManager } from '../src/utils/ConfigManager.js';

async function debugByteplusAPI() {
  console.log('🔍 调试Byteplus API调用...\n');

  try {
    const config = defaultConfigManager.getConfig('byteplus');
    
    console.log('📋 配置信息:');
    console.log(`API Key: ${config.apiKey.substring(0, 12)}****`);
    console.log(`Chat端点ID: ${config.chatEndpoint}`);
    console.log();

    // 创建HTTP客户端
    const client = axios.create({
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // 测试API调用格式
    const testData = {
      model: config.chatEndpoint, // 使用端点ID作为model
      messages: [
        {
          role: 'user',
          content: '你好，这是一个测试消息'
        }
      ],
      max_tokens: 100
    };

    console.log('🌐 测试API调用...');
    console.log('请求URL: https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions');
    console.log('请求Headers:');
    console.log(`  Authorization: Bearer ${config.apiKey.substring(0, 12)}****`);
    console.log(`  Content-Type: application/json`);
    console.log('请求Body:');
    console.log(JSON.stringify(testData, null, 2));
    console.log();

    const response = await client.post(
      'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
      testData
    );

    console.log('✅ API调用成功!');
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ API调用失败:');
    
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('状态文本:', error.response.statusText);
      console.error('响应头:', JSON.stringify(error.response.headers, null, 2));
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('网络错误:', error.request);
    } else {
      console.error('错误信息:', error.message);
    }
  }
}

debugByteplusAPI();