#!/usr/bin/env node

/**
 * HearTalk AI MVP 聊天测试脚本
 * 用于测试AI聊天机器人功能
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

// 测试聊天功能
async function testChat(message, conversationId = 'test-conv-001') {
  const token = generateTestToken();
  
  console.log('\n🤖 HearTalk AI MVP 聊天测试');
  console.log('='.repeat(50));
  console.log(`用户消息: ${message}`);
  console.log(`对话ID: ${conversationId}`);
  console.log('-'.repeat(50));
  
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
      timeout: 30000
    });
    
    if (response.data.success) {
      console.log('\n✅ 响应成功');
      console.log(`🧠 推理类型: ${response.data.data.reasoningType || '标准'}`);
      console.log(`🔀 路由端点: ${response.data.modelName || '未知'}`);
      console.log('\n🤖 AI回复:');
      console.log('-'.repeat(50));
      console.log(response.data.data.content);
      console.log('-'.repeat(50));
      
      if (response.data.data.usage) {
        console.log(`\n📊 Token使用: ${response.data.data.usage.total_tokens || 'N/A'}`);
      }
    } else {
      console.log('\n❌ 响应失败');
      console.log(`错误: ${response.data.error}`);
    }
    
  } catch (error) {
    console.log('\n❌ 请求失败');
    if (error.response) {
      console.log(`HTTP状态: ${error.response.status}`);
      console.log(`错误信息: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`错误详情: ${error.message}`);
    }
  }
}

// 测试健康检查
async function testHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('\n💚 健康检查通过');
    console.log(`运行时间: ${Math.floor(response.data.uptime)}秒`);
    console.log(`内存使用: ${Math.floor(response.data.memory.heapUsed / 1024 / 1024)}MB`);
  } catch (error) {
    console.log('\n❤️‍🩹 健康检查失败');
    console.log(`错误: ${error.message}`);
  }
}

// 主函数
async function main() {
  // 获取命令行参数
  const message = process.argv[2] || '你好，请介绍一下你自己';
  
  // 先测试健康检查
  await testHealth();
  
  // 测试不同类型的消息
  const testMessages = [
    message,
    '请帮我分析这个工作项目的风险',
    '比较一下React和Vue的优缺点',
    '今天天气怎么样？'
  ];
  
  for (let i = 0; i < testMessages.length; i++) {
    await testChat(testMessages[i], `test-conv-${Date.now()}-${i}`);
    if (i < testMessages.length - 1) {
      // 等待1秒避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n🎉 测试完成！');
}

// 如果是直接执行该脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
}