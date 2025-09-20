#!/usr/bin/env node

/**
 * 配置检查脚本
 * 验证所有配置文件的一致性和完整性
 */

import { defaultConfigManager } from '../src/utils/ConfigManager.js';

async function checkConfiguration() {
  console.log('🔍 开始配置检查...\n');

  try {
    // 验证所有配置
    const validation = defaultConfigManager.validateAll();
    
    console.log('📋 配置验证结果:');
    console.log(`状态: ${validation.valid ? '✅ 有效' : '❌ 无效'}`);
    
    if (validation.errors.length > 0) {
      console.log('\n❌ 错误:');
      validation.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      validation.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }

    // 显示配置概览（隐藏敏感信息）
    console.log('\n📊 配置概览:');
    const allConfig = defaultConfigManager.getAllConfig(false);
    
    for (const [group, config] of Object.entries(allConfig)) {
      console.log(`\n${group}:`);
      for (const [key, value] of Object.entries(config)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    // 检查环境一致性
    console.log('\n🌍 环境配置检查:');
    const serverConfig = defaultConfigManager.getConfig('server');
    console.log(`环境: ${serverConfig.env}`);
    console.log(`端口: ${serverConfig.port}`);
    console.log(`主机: ${serverConfig.host}`);

    return validation.valid;
    
  } catch (error) {
    console.error('❌ 配置检查失败:', error.message);
    return false;
  }
}

// 执行配置检查
checkConfiguration().then(isValid => {
  if (isValid) {
    console.log('\n✅ 配置检查通过!');
    process.exit(0);
  } else {
    console.log('\n❌ 配置检查失败!');
    process.exit(1);
  }
}).catch(error => {
  console.error('配置检查过程中发生错误:', error);
  process.exit(1);
});