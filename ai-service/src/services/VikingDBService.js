/**
 * VikingDB 向量数据库服务
 * 基于官方 @volcengine/openapi Node.js SDK 实现
 */
import { vikingdb } from '@volcengine/openapi';

/**
 * VikingDB 服务类
 * 提供向量存储、检索和管理功能
 */
export class VikingDBService {
  constructor(config) {
    // 验证必需配置
    this.validateConfig(config);
    
    this.config = config;
    
    // 初始化 VikingDB 服务
    try {
      this.vikingdbService = new vikingdb.VikingdbService({
        ak: config.accessKey,
        sk: config.secretKey,
        region: config.region || 'ap-southeast-1',
        host: config.host
      });
    } catch (error) {
      throw new Error(`VikingDB initialization failed: ${error.message}`);
    }
    
    // 缓存Collection信息
    this.collections = new Map();
  }

  /**
   * 验证配置参数
   * @param {Object} config - 配置对象
   * @throws {Error} 如果配置无效
   */
  validateConfig(config) {
    const requiredFields = ['accessKey', 'secretKey', 'region', 'host'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing VikingDB configuration fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * 搜索向量数据
   * @param {Object} params - 搜索参数
   * @param {string} params.collectionName - Collection名称
   * @param {string} params.query - 查询文本
   * @param {number} params.limit - 返回结果数量限制
   * @param {number} params.threshold - 相似度阈值
   * @returns {Promise<Array>} 搜索结果
   */
  async searchVectors(params) {
    try {
      const {
        collectionName,
        query,
        limit = 5,
        threshold = 0.7
      } = params;

      // 获取Collection信息（确保Collection存在）
      await this.getCollection(collectionName);
      
      // 执行向量搜索
      const searchRequest = {
        collection_name: collectionName,
        search: {
          vectors: [{
            text: query
          }],
          limit: limit,
          score_threshold: threshold
        }
      };

      const response = await this.vikingdbService.search(searchRequest);
      
      return this.processSearchResults(response.data || []);

    } catch (error) {
      throw this.handleVikingDBError(error, 'searchVectors');
    }
  }

  /**
   * 插入向量数据
   * @param {Object} params - 插入参数
   * @param {string} params.collectionName - Collection名称
   * @param {Array} params.data - 要插入的数据数组
   * @returns {Promise<Object>} 插入结果
   */
  async insertVectors(params) {
    try {
      const { collectionName, data } = params;

      // 验证数据格式
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data must be a non-empty array');
      }

      // 构建插入请求
      const insertRequest = {
        collection_name: collectionName,
        fields: data.map(item => ({
          text: item.text || '',
          metadata: item.metadata || {},
          id: item.id || this.generateId()
        }))
      };

      const response = await this.vikingdbService.upsertData(insertRequest);
      
      return {
        success: true,
        inserted_count: data.length,
        collection: collectionName,
        response: response
      };

    } catch (error) {
      throw this.handleVikingDBError(error, 'insertVectors');
    }
  }

  /**
   * 获取Collection信息
   * @param {string} collectionName - Collection名称
   * @returns {Promise<Object>} Collection信息
   */
  async getCollection(collectionName) {
    try {
      // 检查缓存
      if (this.collections.has(collectionName)) {
        return this.collections.get(collectionName);
      }

      // 获取Collection详情
      const response = await this.vikingdbService.getCollection({
        collection_name: collectionName
      });

      const collection = response.collection;
      
      // 缓存Collection信息
      this.collections.set(collectionName, collection);
      
      return collection;

    } catch (error) {
      throw this.handleVikingDBError(error, 'getCollection');
    }
  }

  /**
   * 列出所有Collection
   * @returns {Promise<Array>} Collection列表
   */
  async listCollections() {
    try {
      const response = await this.vikingdbService.listCollections();
      return response.collections || [];
    } catch (error) {
      throw this.handleVikingDBError(error, 'listCollections');
    }
  }

  /**
   * 创建Collection
   * @param {Object} params - Collection参数
   * @param {string} params.name - Collection名称
   * @param {number} params.dimension - 向量维度
   * @param {string} params.description - 描述
   * @returns {Promise<Object>} 创建结果
   */
  async createCollection(params) {
    try {
      const {
        name,
        dimension = 1536, // 默认OpenAI embedding维度
        description = ''
      } = params;

      const createRequest = {
        collection_name: name,
        fields: [
          {
            field_name: 'id',
            field_type: 'string',
            primary_key: true
          },
          {
            field_name: 'text',
            field_type: 'text'
          },
          {
            field_name: 'vector',
            field_type: 'vector',
            dim: dimension
          }
        ],
        description: description
      };

      const response = await this.vikingdbService.createCollection(createRequest);
      
      // 清除缓存以便重新获取
      this.collections.clear();
      
      return {
        success: true,
        collection_name: name,
        response: response
      };

    } catch (error) {
      throw this.handleVikingDBError(error, 'createCollection');
    }
  }

  /**
   * 删除Collection
   * @param {string} collectionName - Collection名称
   * @returns {Promise<Object>} 删除结果
   */
  async deleteCollection(collectionName) {
    try {
      const response = await this.vikingdbService.dropCollection({
        collection_name: collectionName
      });

      // 从缓存中移除
      this.collections.delete(collectionName);

      return {
        success: true,
        collection_name: collectionName,
        response: response
      };

    } catch (error) {
      throw this.handleVikingDBError(error, 'deleteCollection');
    }
  }

  /**
   * 健康检查
   * @returns {Promise<boolean>} 服务是否健康
   */
  async healthCheck() {
    try {
      // 尝试列出Collections来检查连接
      await this.listCollections();
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`VikingDB health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 处理搜索结果
   * @param {Array} rawResults - 原始搜索结果
   * @returns {Array} 处理后的结果
   * @private
   */
  processSearchResults(rawResults) {
    if (!Array.isArray(rawResults)) {
      return [];
    }

    return rawResults.map(result => ({
      id: result.id,
      text: result.fields?.text || '',
      metadata: result.fields?.metadata || {},
      score: result.score || 0,
      distance: result.distance || 0
    })).sort((a, b) => b.score - a.score); // 按分数降序排列
  }

  /**
   * 处理VikingDB错误
   * @param {Error} error - 原始错误
   * @param {string} operation - 操作名称
   * @returns {Error} 处理后的错误
   * @private
   */
  handleVikingDBError(error, operation) {
    let errorMessage = `VikingDB ${operation} failed: `;

    if (error.name === 'VikingdbError') {
      // SDK内部错误
      errorMessage += `SDK Error - ${error.message}`;
    } else if (error.name === 'VikingdbRequestError') {
      // API请求错误
      errorMessage += `API Error - ${error.message}`;
      if (error.code) {
        errorMessage += ` (Code: ${error.code})`;
      }
    } else {
      // 其他错误
      errorMessage += error.message || 'Unknown error';
    }

    return new Error(errorMessage);
  }

  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   * @private
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取服务状态信息
   * @returns {Object} 服务状态
   */
  getStatus() {
    return {
      service: 'VikingDB',
      region: this.config.region,
      host: this.config.host,
      collections_cached: this.collections.size,
      initialized: !!this.vikingdbService
    };
  }
}

export default VikingDBService;