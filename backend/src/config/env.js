require('dotenv').config();

const requiredEnvVars = {
  // Database
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET,
};

const optionalEnvVars = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 8000,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3000',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 180000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8000/api/v1'
};

const validateEnvironment = () => {
  const missingVars = [];
  const warnings = [];

  // Check required variables
  Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value || value.trim() === '') {
      missingVars.push(key);
    }
  });

  // Check for production-specific requirements
  if (optionalEnvVars.NODE_ENV === 'production') {
    // In production, JWT_SECRET should be strong
    if (requiredEnvVars.JWT_SECRET && requiredEnvVars.JWT_SECRET.includes('change_in_production')) {
      warnings.push('JWT_SECRET appears to be using default value - should be changed in production');
    }
    
    if (requiredEnvVars.JWT_SECRET && requiredEnvVars.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters long in production');
    }

    // Check for default passwords
    if (requiredEnvVars.DB_PASSWORD && requiredEnvVars.DB_PASSWORD.includes('your_password_here')) {
      warnings.push('DB_PASSWORD appears to be using default value - should be changed in production');
    }
  }

  // Check numeric values
  if (isNaN(optionalEnvVars.PORT) || optionalEnvVars.PORT < 1 || optionalEnvVars.PORT > 65535) {
    warnings.push('PORT should be a valid port number between 1 and 65535');
  }

  if (isNaN(optionalEnvVars.RATE_LIMIT_WINDOW_MS) || optionalEnvVars.RATE_LIMIT_WINDOW_MS < 1000) {
    warnings.push('RATE_LIMIT_WINDOW_MS should be at least 1000 milliseconds');
  }

  if (isNaN(optionalEnvVars.RATE_LIMIT_MAX_REQUESTS) || optionalEnvVars.RATE_LIMIT_MAX_REQUESTS < 1) {
    warnings.push('RATE_LIMIT_MAX_REQUESTS should be a positive number');
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
    warnings,
    config: { ...requiredEnvVars, ...optionalEnvVars }
  };
};

const getConfig = () => {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    console.error('\n❌ Environment validation failed!');
    console.error('Missing required environment variables:');
    validation.missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\nPlease check your .env file or environment variables.');
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.warn('\n⚠️  Environment warnings:');
    validation.warnings.forEach(warning => {
      console.warn(`  - ${warning}`);
    });
    console.warn('');
  }

  // Success message
  console.log('✅ Environment configuration loaded successfully');
  
  return validation.config;
};

module.exports = {
  validateEnvironment,
  getConfig
};