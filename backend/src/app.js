/**
 * HEARTALK-AI Backend Application
 * 主应用入口，集成Internal API和核心服务
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 导入工具和中间件
const { logger } = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 导入路由
const internalRoutes = require('./routes/internal');

// 验证环境配置
function validateEnvironment() {
  const requiredEnvVars = ['HEARTALK_API_KEY', 'JWT_SECRET'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  // 检查开发占位符
  if (process.env.HEARTALK_API_KEY.includes('placeholder') || 
      process.env.JWT_SECRET.includes('change_in_production')) {
    logger.warn('Development placeholder configurations detected!', {
      environment: process.env.NODE_ENV
    });
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Production environment cannot use development credentials!');
    }
  }
}

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 8000;

// 验证环境变量
validateEnvironment();

// 安全中间件
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// 请求限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 100个请求
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// 请求解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求ID中间件
app.use((req, res, next) => {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });
  });
  
  next();
});

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'heartalk-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Internal API路由 (关键集成点)
app.use('/internal/api/v1', internalRoutes);

// API路由占位符 (根据需要添加其他路由)
app.get('/api/v1/status', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'HEARTALK-AI Backend API is running',
      timestamp: new Date().toISOString(),
      internalApi: {
        enabled: true,
        endpoints: [
          '/internal/api/v1/conversations/:id/history',
          '/internal/api/v1/users/:id/context',
          '/internal/api/v1/health'
        ]
      }
    }
  });
});

// 404处理
app.use(notFoundHandler);

// 错误处理中间件（必须放在最后）
app.use(errorHandler);

// 启动服务器
async function startServer() {
  try {
    // 测试Internal API可用性
    logger.info('Testing Internal API integration...');
    
    const server = app.listen(PORT, () => {
      logger.info('HEARTALK-AI Backend server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        internalApiEnabled: true,
        timestamp: new Date().toISOString()
      });
    });

    // 优雅关闭处理
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
  process.exit(1);
});

// 导出应用（用于测试）
module.exports = app;

// 如果直接运行此文件，启动服务器
if (require.main === module) {
  startServer();
}