#!/usr/bin/env node

/**
 * 健康检查脚本
 * 验证backend服务和Internal API的可用性
 */

const http = require('http');
const https = require('https');

const config = {
  host: process.env.HOST || 'localhost',
  port: process.env.PORT || 8000,
  timeout: 5000,
  apiKey: process.env.HEARTALK_API_KEY
};

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const protocol = options.port === 443 ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.setTimeout(config.timeout);
    req.end();
  });
}

async function checkBasicHealth() {
  console.log('🏥 Checking basic health...');
  
  try {
    const response = await makeRequest({
      hostname: config.host,
      port: config.port,
      path: '/health',
      method: 'GET',
      headers: {
        'User-Agent': 'HealthCheck/1.0'
      }
    });
    
    if (response.statusCode === 200) {
      console.log('   ✅ Basic health check PASSED');
      console.log(`   📊 Response: ${JSON.stringify(response.data, null, 2)}`);
      return true;
    } else {
      console.log(`   ❌ Basic health check FAILED (${response.statusCode})`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Basic health check FAILED: ${error.message}`);
    return false;
  }
}

async function checkInternalApiHealth() {
  console.log('\n🔒 Checking Internal API health...');
  
  if (!config.apiKey) {
    console.log('   ⚠️  SKIPPED: HEARTALK_API_KEY not configured');
    return false;
  }
  
  try {
    const response = await makeRequest({
      hostname: config.host,
      port: config.port,
      path: '/internal/api/v1/health',
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        'User-Agent': 'HealthCheck/1.0'
      }
    });
    
    if (response.statusCode === 200) {
      console.log('   ✅ Internal API health check PASSED');
      console.log(`   📊 Response: ${JSON.stringify(response.data, null, 2)}`);
      return true;
    } else {
      console.log(`   ❌ Internal API health check FAILED (${response.statusCode})`);
      console.log(`   📄 Response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Internal API health check FAILED: ${error.message}`);
    return false;
  }
}

async function checkApiStatus() {
  console.log('\n📡 Checking API status...');
  
  try {
    const response = await makeRequest({
      hostname: config.host,
      port: config.port,
      path: '/api/v1/status',
      method: 'GET',
      headers: {
        'User-Agent': 'HealthCheck/1.0'
      }
    });
    
    if (response.statusCode === 200) {
      console.log('   ✅ API status check PASSED');
      console.log(`   📊 Response: ${JSON.stringify(response.data, null, 2)}`);
      return true;
    } else {
      console.log(`   ❌ API status check FAILED (${response.statusCode})`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ API status check FAILED: ${error.message}`);
    return false;
  }
}

async function runHealthChecks() {
  console.log(`🚀 Starting health checks for ${config.host}:${config.port}`);
  console.log(`⏱️  Timeout: ${config.timeout}ms\n`);
  
  const results = {
    basic: await checkBasicHealth(),
    internalApi: await checkInternalApiHealth(),
    apiStatus: await checkApiStatus()
  };
  
  console.log('\n📊 Health Check Summary:');
  console.log(`   Basic Health: ${results.basic ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Internal API: ${results.internalApi ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   API Status: ${results.apiStatus ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = results.basic && results.internalApi && results.apiStatus;
  
  if (allPassed) {
    console.log('\n🎉 All health checks PASSED! Service is ready.');
    process.exit(0);
  } else {
    console.log('\n❌ Some health checks FAILED. Please check the service.');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runHealthChecks().catch((error) => {
    console.error('❌ Health check script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runHealthChecks, checkBasicHealth, checkInternalApiHealth, checkApiStatus };