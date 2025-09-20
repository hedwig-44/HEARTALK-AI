import { getLogger } from '../utils/Logger.js';

/**
 * 性能监控中间件
 * 收集API性能指标和使用统计
 */
export class MetricsMiddleware {
  constructor() {
    this.logger = getLogger('metrics');
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0
      },
      responseTime: {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0,
        avg: 0
      },
      endpoints: new Map(),
      status: new Map(),
      startTime: Date.now()
    };
  }

  /**
   * 创建监控中间件函数
   * @returns {Function} Express中间件函数
   */
  createMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // 监听响应完成
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordMetrics(req, res, duration);
      });

      next();
    };
  }

  /**
   * 记录请求指标
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {number} duration - 处理时间
   * @private
   */
  recordMetrics(req, res, duration) {
    // 总请求计数
    this.metrics.requests.total++;
    
    // 状态码统计
    const status = res.statusCode;
    if (status >= 200 && status < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }

    // 状态码分布
    const statusKey = `${Math.floor(status / 100)}xx`;
    this.metrics.status.set(statusKey, (this.metrics.status.get(statusKey) || 0) + 1);

    // 响应时间统计
    this.updateResponseTime(duration);

    // 端点统计
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const endpointStats = this.metrics.endpoints.get(endpoint) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errors: 0
    };

    endpointStats.count++;
    endpointStats.totalTime += duration;
    endpointStats.avgTime = Math.round(endpointStats.totalTime / endpointStats.count);
    endpointStats.minTime = Math.min(endpointStats.minTime, duration);
    endpointStats.maxTime = Math.max(endpointStats.maxTime, duration);
    
    if (status >= 400) {
      endpointStats.errors++;
    }

    this.metrics.endpoints.set(endpoint, endpointStats);

    // 记录性能日志
    this.logger.logPerformance(`${req.method} ${req.path}`, duration, {
      status: res.statusCode,
      contentLength: res.get('Content-Length'),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }

  /**
   * 更新响应时间统计
   * @param {number} duration - 响应时间
   * @private
   */
  updateResponseTime(duration) {
    this.metrics.responseTime.total += duration;
    this.metrics.responseTime.count++;
    this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, duration);
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, duration);
    this.metrics.responseTime.avg = Math.round(this.metrics.responseTime.total / this.metrics.responseTime.count);
  }

  /**
   * 获取当前监控指标
   * @returns {Object} 监控指标对象
   */
  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    
    return {
      uptime: Math.floor(uptime / 1000), // 运行时间(秒)
      requests: {
        ...this.metrics.requests,
        rate: Math.round((this.metrics.requests.total / uptime) * 1000 * 60) // 每分钟请求数
      },
      responseTime: {
        ...this.metrics.responseTime,
        min: this.metrics.responseTime.min === Infinity ? 0 : this.metrics.responseTime.min
      },
      statusCodes: Object.fromEntries(this.metrics.status),
      endpoints: Object.fromEntries(
        Array.from(this.metrics.endpoints.entries())
          .sort(([,a], [,b]) => b.count - a.count)
          .slice(0, 10) // 前10个最常访问的端点
      ),
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  /**
   * 重置监控指标
   */
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0
      },
      responseTime: {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0,
        avg: 0
      },
      endpoints: new Map(),
      status: new Map(),
      startTime: Date.now()
    };
    
    this.logger.info('Metrics reset', { timestamp: new Date().toISOString() });
  }
}

// 创建全局监控实例
export const globalMetrics = new MetricsMiddleware();

/**
 * 创建默认监控中间件
 * @returns {Function} Express中间件函数
 */
export function createMetricsMiddleware() {
  return globalMetrics.createMiddleware();
}

export default MetricsMiddleware;