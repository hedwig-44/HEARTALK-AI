const Redis = require('ioredis');
const { logger } = require('../utils/logger');

/**
 * Redis Connection Configuration
 * Supports graceful degradation when Redis is unavailable
 */

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.degradationMode = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
    
    this.initialize();
  }

  initialize() {
    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'heartalk:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      commandTimeout: 3000,
      lazyConnect: true,
      enableOfflineQueue: false
    };

    this.client = new Redis(config);
    this.setupEventHandlers();
    this.connect();
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info('Redis connection established');
      this.isConnected = true;
      this.isConnecting = false;
      this.degradationMode = false;
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready for commands');
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error:', {
        error: error.message,
        stack: error.stack,
        degradationMode: this.degradationMode
      });
      
      if (!this.degradationMode) {
        this.enterDegradationMode();
      }
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
      
      if (!this.degradationMode) {
        this.scheduleReconnect();
      }
    });

    this.client.on('reconnecting', () => {
      this.isConnecting = true;
      this.reconnectAttempts++;
      logger.info('Redis reconnecting...', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
    });
  }

  async connect() {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    try {
      this.isConnecting = true;
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error.message);
      this.enterDegradationMode();
    }
  }

  enterDegradationMode() {
    if (!this.degradationMode) {
      logger.warn('Entering Redis degradation mode - cache operations will be bypassed');
      this.degradationMode = true;
      this.isConnected = false;
      this.isConnecting = false;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.enterDegradationMode();
      return;
    }

    setTimeout(() => {
      if (!this.isConnected && !this.degradationMode) {
        this.connect();
      }
    }, this.reconnectDelay);
  }

  getClient() {
    return this.client;
  }

  isAvailable() {
    return this.isConnected && !this.degradationMode;
  }

  isDegraded() {
    return this.degradationMode;
  }

  async healthCheck() {
    if (this.degradationMode) {
      return {
        status: 'degraded',
        connected: false,
        degradationMode: true,
        reconnectAttempts: this.reconnectAttempts
      };
    }

    if (!this.isConnected) {
      return {
        status: 'disconnected',
        connected: false,
        degradationMode: false,
        reconnectAttempts: this.reconnectAttempts
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        connected: true,
        degradationMode: false,
        responseTime,
        reconnectAttempts: this.reconnectAttempts
      };
    } catch (error) {
      logger.error('Redis health check failed:', error.message);
      return {
        status: 'unhealthy',
        connected: false,
        degradationMode: this.degradationMode,
        error: error.message
      };
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      this.isConnecting = false;
      logger.info('Redis client disconnected');
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await redisManager.disconnect();
});

process.on('SIGINT', async () => {
  await redisManager.disconnect();
});

module.exports = {
  redisManager,
  getRedisClient: () => redisManager.getClient(),
  isRedisAvailable: () => redisManager.isAvailable(),
  isRedisDegraded: () => redisManager.isDegraded()
};