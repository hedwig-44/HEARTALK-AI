#!/usr/bin/env node

/**
 * HearTalk Backend部署验证脚本
 * 
 * 用于验证Backend服务和Internal API部署后的连通性和功能正常性
 * 
 * 使用方法：
 * node scripts/verify-deployment.js [options]
 * 
 * 选项：
 * --host <host>     Backend服务主机地址 (默认: localhost)
 * --port <port>     Backend服务端口 (默认: 8000)  
 * --api-key <key>   Internal API密钥
 * --timeout <ms>    请求超时时间 (默认: 5000)
 * --verbose         显示详细输出
 * --env <file>      指定环境变量文件 (默认: .env)
 * 
 * 示例：
 * node scripts/verify-deployment.js --verbose
 * node scripts/verify-deployment.js --host production.heartalk.com --port 443
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 解析命令行参数
const args = process.argv.slice(2);
const options = {};
let i = 0;

while (i < args.length) {
  switch (args[i]) {
    case '--host':
      options.host = args[++i];
      break;
    case '--port':
      options.port = parseInt(args[++i]);
      break;
    case '--api-key':
      options.apiKey = args[++i];
      break;
    case '--timeout':
      options.timeout = parseInt(args[++i]);
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--env':
      options.envFile = args[++i];
      break;
    case '--help':
      console.log(`
HearTalk Backend部署验证脚本

使用方法: node scripts/verify-deployment.js [options]

选项:
  --host <host>     Backend服务主机地址 (默认: localhost)
  --port <port>     Backend服务端口 (默认: 8000)
  --api-key <key>   Internal API密钥
  --timeout <ms>    请求超时时间 (默认: 5000)
  --verbose         显示详细输出
  --env <file>      指定环境变量文件 (默认: .env)
  --help            显示此帮助信息

示例:
  node scripts/verify-deployment.js --verbose
  node scripts/verify-deployment.js --host production.heartalk.com --port 443
      `);
      process.exit(0);
    default:
      console.error(`未知选项: ${args[i]}`);
      process.exit(1);
  }
  i++;
}

// 默认配置
const config = {
  host: options.host || 'localhost',
  port: options.port || 8000,
  timeout: options.timeout || 5000,
  verbose: options.verbose || false,
  envFile: options.envFile || '.env'
};

// 尝试从环境文件加载API密钥
if (!options.apiKey && fs.existsSync(config.envFile)) {
  const envContent = fs.readFileSync(config.envFile, 'utf8');
  const apiKeyMatch = envContent.match(/HEARTALK_API_KEY=(.+)/);
  if (apiKeyMatch) {
    config.apiKey = apiKeyMatch[1].trim();
  }
}

// 如果仍然没有API密钥，尝试从环境变量获取
if (!config.apiKey) {
  config.apiKey = process.env.HEARTALK_API_KEY;
}

const baseUrl = `http://${config.host}:${config.port}`;

// 颜色输出函数
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// 日志函数
const log = {
  info: (message) => console.log(`${colors.blue('[INFO]')} ${message}`),
  success: (message) => console.log(`${colors.green('[SUCCESS]')} ${message}`),
  error: (message) => console.log(`${colors.red('[ERROR]')} ${message}`),
  warn: (message) => console.log(`${colors.yellow('[WARN]')} ${message}`),
  debug: (message) => config.verbose && console.log(`${colors.gray('[DEBUG]')} ${message}`)
};

// HTTP客户端配置
const httpClient = axios.create({
  timeout: config.timeout,
  headers: {
    'User-Agent': 'HearTalk-Deployment-Verification/1.0.0',
    'Accept': 'application/json'
  }
});

// 验证结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0
};

/**
 * 执行单个测试
 */
async function runTest(testName, testFunction) {
  results.total++;
  log.info(`正在执行: ${testName}`);
  
  try {
    const result = await testFunction();
    if (result.success) {
      results.passed++;
      log.success(`✓ ${testName}`);
      if (result.message) {
        log.debug(result.message);
      }
    } else {
      if (result.warning) {
        results.warnings++;
        log.warn(`⚠ ${testName}: ${result.message}`);
      } else {
        results.failed++;
        log.error(`✗ ${testName}: ${result.message}`);
      }
    }
    return result;
  } catch (error) {
    results.failed++;
    log.error(`✗ ${testName}: ${error.message}`);
    log.debug(error.stack);
    return { success: false, message: error.message };
  }
}

/**
 * 测试基本连通性
 */
async function testBasicConnectivity() {
  const response = await httpClient.get(`${baseUrl}/`);
  
  if (response.status !== 200) {
    return { success: false, message: `HTTP状态码: ${response.status}` };
  }
  
  if (!response.data.success) {
    return { success: false, message: '服务返回success=false' };
  }
  
  return { 
    success: true, 
    message: `服务版本: ${response.data.version}, 环境: ${response.data.environment}` 
  };
}

/**
 * 测试健康检查端点
 */
async function testHealthCheck() {
  const response = await httpClient.get(`${baseUrl}/health`);
  
  if (response.status !== 200) {
    return { success: false, message: `HTTP状态码: ${response.status}` };
  }
  
  return { 
    success: true, 
    message: `健康状态: ${response.data.status || 'OK'}` 
  };
}

/**
 * 测试API文档端点
 */
async function testApiDocs() {
  const response = await httpClient.get(`${baseUrl}/docs`);
  
  if (response.status !== 200) {
    return { success: false, message: `HTTP状态码: ${response.status}` };
  }
  
  if (!response.data.success) {
    return { success: false, message: 'API文档不可用' };
  }
  
  return { 
    success: true, 
    message: `API文档版本: ${response.data.documentation?.version || 'unknown'}` 
  };
}

/**
 * 测试Internal API健康检查
 */
async function testInternalApiHealth() {
  if (!config.apiKey) {
    return { 
      success: false, 
      warning: true,
      message: '未提供API密钥，跳过Internal API测试。请通过--api-key参数或环境变量HEARTALK_API_KEY提供' 
    };
  }
  
  const response = await httpClient.get(`${baseUrl}/internal/api/v1/health`, {
    headers: {
      'X-API-Key': config.apiKey
    }
  });
  
  if (response.status !== 200) {
    return { success: false, message: `HTTP状态码: ${response.status}` };
  }
  
  if (!response.data.success) {
    return { success: false, message: 'Internal API健康检查失败' };
  }
  
  const healthData = response.data.data;
  return { 
    success: true, 
    message: `Internal API状态: ${healthData.status}, 响应时间: ${healthData.performance?.responseTime}` 
  };
}

/**
 * 测试Internal API认证
 */
async function testInternalApiAuth() {
  // 测试无API密钥的情况
  try {
    await httpClient.get(`${baseUrl}/internal/api/v1/health`);
    return { success: false, message: 'Internal API未正确验证API密钥（应该返回401）' };
  } catch (error) {
    if (error.response?.status === 401) {
      return { 
        success: true, 
        message: 'API密钥验证正常工作（正确拒绝无密钥请求）' 
      };
    } else {
      return { success: false, message: `意外的响应: ${error.message}` };
    }
  }
}

/**
 * 测试404处理
 */
async function test404Handling() {
  try {
    await httpClient.get(`${baseUrl}/nonexistent-endpoint`);
    return { success: false, message: '404端点未正确处理（应该返回404）' };
  } catch (error) {
    if (error.response?.status === 404) {
      const responseData = error.response.data;
      if (responseData.success === false && responseData.code === 'NOT_FOUND') {
        return { 
          success: true, 
          message: '404错误处理正常' 
        };
      } else {
        return { success: false, message: '404响应格式不正确' };
      }
    } else {
      return { success: false, message: `意外的响应: ${error.message}` };
    }
  }
}

/**
 * 测试CORS头部
 */
async function testCorsHeaders() {
  const response = await httpClient.options(`${baseUrl}/api/v1/auth/login`);
  
  const corsHeaders = {
    'access-control-allow-origin': response.headers['access-control-allow-origin'],
    'access-control-allow-methods': response.headers['access-control-allow-methods'],
    'access-control-allow-headers': response.headers['access-control-allow-headers']
  };
  
  if (!corsHeaders['access-control-allow-origin']) {
    return { success: false, message: '缺少CORS Origin头部' };
  }
  
  return { 
    success: true, 
    message: `CORS配置正常，允许来源: ${corsHeaders['access-control-allow-origin']}` 
  };
}

/**
 * 性能测试
 */
async function testPerformance() {
  const iterations = 5;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await httpClient.get(`${baseUrl}/health`);
    times.push(Date.now() - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  
  if (avgTime > 1000) {
    return { 
      success: false, 
      message: `平均响应时间过慢: ${avgTime.toFixed(2)}ms (目标: <1000ms)` 
    };
  }
  
  return { 
    success: true, 
    message: `性能正常 - 平均: ${avgTime.toFixed(2)}ms, 最大: ${maxTime}ms` 
  };
}

/**
 * 主验证流程
 */
async function main() {
  console.log(colors.blue('='.repeat(60)));
  console.log(colors.blue('         HearTalk Backend部署验证'));
  console.log(colors.blue('='.repeat(60)));
  console.log();
  
  log.info(`目标服务: ${baseUrl}`);
  log.info(`超时设置: ${config.timeout}ms`);
  log.info(`API密钥: ${config.apiKey ? '已配置' : '未配置'}`);
  console.log();
  
  // 执行所有测试
  await runTest('基本连通性测试', testBasicConnectivity);
  await runTest('健康检查端点测试', testHealthCheck);
  await runTest('API文档端点测试', testApiDocs);
  await runTest('Internal API健康检查', testInternalApiHealth);
  await runTest('Internal API认证测试', testInternalApiAuth);
  await runTest('404错误处理测试', test404Handling);
  await runTest('CORS头部测试', testCorsHeaders);
  await runTest('性能测试', testPerformance);
  
  // 输出结果汇总
  console.log();
  console.log(colors.blue('='.repeat(60)));
  console.log(colors.blue('                  验证结果汇总'));
  console.log(colors.blue('='.repeat(60)));
  console.log();
  
  console.log(`总测试数: ${results.total}`);
  console.log(`${colors.green('通过:')} ${results.passed}`);
  console.log(`${colors.red('失败:')} ${results.failed}`);
  console.log(`${colors.yellow('警告:')} ${results.warnings}`);
  console.log();
  
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`成功率: ${successRate}%`);
  
  if (results.failed === 0) {
    log.success('所有关键测试通过！部署验证成功。');
    if (results.warnings > 0) {
      log.warn(`请注意 ${results.warnings} 个警告项。`);
    }
    process.exit(0);
  } else {
    log.error(`${results.failed} 个测试失败。请检查问题后重试。`);
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  log.error(`未处理的Promise拒绝: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log.error(`未捕获的异常: ${error.message}`);
  log.debug(error.stack);
  process.exit(1);
});

// 运行主程序
main().catch(error => {
  log.error(`验证过程发生错误: ${error.message}`);
  log.debug(error.stack);
  process.exit(1);
});