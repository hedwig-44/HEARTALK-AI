#!/usr/bin/env node

/**
 * 环境变量验证脚本
 * 验证所有必需的环境变量是否正确配置
 */

require('dotenv').config();

const requiredEnvVars = {
  'HEARTALK_API_KEY': {
    required: true,
    description: 'Internal API key for AI service communication',
    validate: (value) => {
      if (value.includes('placeholder')) {
        return 'Should not use placeholder value in production';
      }
      if (value.length < 16) {
        return 'Should be at least 16 characters long';
      }
      return null;
    }
  },
  'JWT_SECRET': {
    required: true,
    description: 'JWT secret for token signing/verification',
    validate: (value) => {
      if (value.includes('change_in_production')) {
        return 'Should not use placeholder value in production';
      }
      if (value.length < 32) {
        return 'Should be at least 32 characters long for security';
      }
      return null;
    }
  },
  'NODE_ENV': {
    required: false,
    description: 'Environment mode (development/production)',
    validate: (value) => {
      if (value && !['development', 'production', 'test'].includes(value)) {
        return 'Should be one of: development, production, test';
      }
      return null;
    }
  },
  'PORT': {
    required: false,
    description: 'Server port number',
    validate: (value) => {
      if (value) {
        const port = parseInt(value);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Should be a valid port number (1-65535)';
        }
      }
      return null;
    }
  }
};

function validateEnvironment() {
  console.log('🔍 Validating environment configuration...\n');
  
  let hasErrors = false;
  let hasWarnings = false;

  for (const [envVar, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[envVar];
    
    console.log(`📋 ${envVar}:`);
    console.log(`   Description: ${config.description}`);
    
    if (config.required && !value) {
      console.log(`   ❌ ERROR: Missing required environment variable`);
      hasErrors = true;
    } else if (!value) {
      console.log(`   ⚠️  WARNING: Optional variable not set (will use default)`);
      hasWarnings = true;
    } else {
      const validationError = config.validate ? config.validate(value) : null;
      
      if (validationError) {
        if (process.env.NODE_ENV === 'production') {
          console.log(`   ❌ ERROR: ${validationError}`);
          hasErrors = true;
        } else {
          console.log(`   ⚠️  WARNING: ${validationError}`);
          hasWarnings = true;
        }
      } else {
        console.log(`   ✅ Valid`);
      }
    }
    console.log();
  }

  // 检查额外的环境特定验证
  if (process.env.NODE_ENV === 'production') {
    console.log('🚀 Production environment checks:');
    
    if (process.env.HEARTALK_API_KEY?.includes('placeholder') || 
        process.env.JWT_SECRET?.includes('change_in_production')) {
      console.log('   ❌ ERROR: Production environment cannot use development credentials!');
      hasErrors = true;
    } else {
      console.log('   ✅ Production credentials configured');
    }
    console.log();
  }

  // 打印总结
  console.log('📊 Validation Summary:');
  if (hasErrors) {
    console.log('   ❌ Environment validation FAILED');
    console.log('   🔧 Please fix the errors above before starting the application');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('   ⚠️  Environment validation completed with WARNINGS');
    console.log('   💡 Consider addressing the warnings for optimal configuration');
  } else {
    console.log('   ✅ Environment validation PASSED');
    console.log('   🎉 All configurations are valid!');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment, requiredEnvVars };