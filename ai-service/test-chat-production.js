#!/usr/bin/env node

/**
 * HearTalk AI MVP 生产模式聊天测试脚本
 * 测试生产模式（不显示推理过程）的AI回答
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

// 测试聊天功能（生产模式）
async function testProductionChat(message, conversationId = 'prod-test-001') {
  const token = generateTestToken();
  
  console.log('\n🎯 HearTalk AI MVP 生产模式测试');
  console.log('='.repeat(50));
  console.log(`用户消息: ${message}`);
  console.log(`对话ID: ${conversationId}`);
  console.log('模式: 生产模式 (隐藏推理过程)');
  console.log('-'.repeat(50));
  
  try {
    const response = await axios.post(`${BASE_URL}/api/v1/chat/generate`, {
      conversation_id: conversationId,
      message: message,
      user_id: 'test-user-123',
      options: {
        // 可以通过API参数控制
        showReasoningProcess: false
      }
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
      console.log('\n🤖 AI回复 (生产模式精简版):');
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

// 主函数
async function main() {
  // 获取命令行参数
  const message = process.argv[2] || '你好，请简单介绍一下你自己';
  
  console.log('\n🔧 测试说明:');
  console.log('当前配置为开发模式(SHOW_REASONING_PROCESS=true)');
  console.log('在生产环境中应设置 SHOW_REASONING_PROCESS=false');
  console.log('这样用户只会看到最终的精炼回答，而不是详细推理过程\n');
  
  // 测试生产模式的消息
  const testMessages = [
    message,
    '比较一下React和Vue的优缺点',
    '今天天气怎么样？'
  ];
  
  for (let i = 0; i < testMessages.length; i++) {
    await testProductionChat(testMessages[i], `prod-test-${Date.now()}-${i}`);
    if (i < testMessages.length - 1) {
      // 等待1秒避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n💡 提示:');
  console.log('要真正启用生产模式，请在 .env 文件中设置:');
  console.log('SHOW_REASONING_PROCESS=false');
  console.log('然后重启服务即可看到精简的AI回答\n');
  
  console.log('🎉 生产模式测试完成！');
}

// 如果是直接执行该脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
}