/**
 * Translate Controller
 * 处理文本翻译API请求
 */
import { getLogger } from '../utils/Logger.js';
import { defaultProviderFactory } from '../services/ProviderFactory.js';
import { defaultConfigManager } from '../utils/ConfigManager.js';

const logger = getLogger('translate-controller');
const config = defaultConfigManager;

/**
 * 翻译控制器类
 * 处理文本翻译功能
 */
export class TranslateController {
  constructor() {
    // 获取AI服务提供商
    const byteplusConfig = config.getConfig('byteplus');
    this.provider = defaultProviderFactory.getProvider('byteplus', byteplusConfig);
  }

  /**
   * 文本翻译API
   * POST /api/v1/translate
   */
  async translateText(req, res) {
    const startTime = Date.now();
    
    try {
      // 参数验证
      const validationResult = this.validateTranslateRequest(req.body);
      if (!validationResult.valid) {
        return this.sendErrorResponse(res, {
          code: 'VALIDATION_ERROR',
          message: validationResult.error,
          requestId: req.requestId,
          status: 400
        });
      }

      const { text, target_language } = req.body;

      logger.info('Translation request received', {
        requestId: req.requestId,
        textLength: text.length,
        targetLanguage: target_language
      });

      // 准备翻译参数
      const translateParams = {
        text,
        targetLanguage: target_language,
        // 可以添加其他翻译选项
        options: {
          preserveFormatting: req.body.preserve_formatting || true,
          model: req.body.model || 'default'
        }
      };

      // 调用AI翻译服务
      const response = await this.provider.translateText(translateParams);

      // 记录成功日志
      const duration = Date.now() - startTime;
      logger.info('Translation completed successfully', {
        requestId: req.requestId,
        duration: `${duration}ms`,
        originalLength: text.length,
        translatedLength: response.data?.translated_text?.length || response.data?.content?.length || 0
      });

      // 返回标准响应
      res.json({
        success: true,
        data: {
          original_text: text,
          translated_text: response.data?.translated_text || response.data?.content || '',
          target_language,
          detected_language: response.data?.detected_language || null,
          confidence: response.data?.confidence || null
        },
        provider: 'byteplus'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Translation failed', {
        requestId: req.requestId,
        error: error.message,
        duration: `${duration}ms`,
        stack: error.stack
      });

      this.sendErrorResponse(res, {
        code: this.mapErrorCode(error),
        message: error.message,
        requestId: req.requestId,
        status: this.getErrorStatus(error)
      });
    }
  }

  /**
   * 获取支持的语言列表
   * GET /api/v1/translate/languages
   */
  async getSupportedLanguages(req, res) {
    try {
      logger.info('Supported languages request received', {
        requestId: req.requestId
      });

      // 返回支持的语言列表
      const supportedLanguages = [
        { code: 'zh', name: '中文', nativeName: '中文' },
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
        { code: 'ko', name: 'Korean', nativeName: '한국어' },
        { code: 'fr', name: 'French', nativeName: 'Français' },
        { code: 'de', name: 'German', nativeName: 'Deutsch' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
        { code: 'it', name: 'Italian', nativeName: 'Italiano' },
        { code: 'ru', name: 'Russian', nativeName: 'Русский' },
        { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }
      ];

      res.json({
        success: true,
        data: {
          languages: supportedLanguages,
          total: supportedLanguages.length
        }
      });

    } catch (error) {
      logger.error('Get supported languages failed', {
        requestId: req.requestId,
        error: error.message,
        stack: error.stack
      });

      this.sendErrorResponse(res, {
        code: 'INTERNAL_ERROR',
        message: error.message,
        requestId: req.requestId,
        status: 500
      });
    }
  }

  /**
   * 语言检测API
   * POST /api/v1/translate/detect
   */
  async detectLanguage(req, res) {
    const startTime = Date.now();
    
    try {
      // 参数验证
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return this.sendErrorResponse(res, {
          code: 'VALIDATION_ERROR',
          message: 'text is required and must be a string',
          requestId: req.requestId,
          status: 400
        });
      }

      logger.info('Language detection request received', {
        requestId: req.requestId,
        textLength: text.length
      });

      // 调用语言检测服务（这里可以集成到AI Provider中）
      const detectionResult = await this.detectTextLanguage(text);

      const duration = Date.now() - startTime;
      logger.info('Language detection completed', {
        requestId: req.requestId,
        duration: `${duration}ms`,
        detectedLanguage: detectionResult.language
      });

      res.json({
        success: true,
        data: {
          text,
          detected_language: detectionResult.language,
          confidence: detectionResult.confidence,
          possible_languages: detectionResult.alternatives || []
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Language detection failed', {
        requestId: req.requestId,
        error: error.message,
        duration: `${duration}ms`,
        stack: error.stack
      });

      this.sendErrorResponse(res, {
        code: this.mapErrorCode(error),
        message: error.message,
        requestId: req.requestId,
        status: this.getErrorStatus(error)
      });
    }
  }

  /**
   * 检测文本语言（简单实现）
   * @param {string} text - 要检测的文本
   * @returns {Object} 检测结果
   */
  async detectTextLanguage(text) {
    // 简单的语言检测逻辑
    const chineseRegex = /[\u4e00-\u9fff]/;
    const englishRegex = /[a-zA-Z]/;
    const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
    const koreanRegex = /[\uac00-\ud7af]/;

    if (chineseRegex.test(text)) {
      return { language: 'zh', confidence: 0.9 };
    }
    if (japaneseRegex.test(text)) {
      return { language: 'ja', confidence: 0.85 };
    }
    if (koreanRegex.test(text)) {
      return { language: 'ko', confidence: 0.85 };
    }
    if (englishRegex.test(text)) {
      return { language: 'en', confidence: 0.8 };
    }

    return { language: 'unknown', confidence: 0.1 };
  }

  /**
   * 验证翻译请求
   * @param {Object} body - 请求体
   * @returns {Object} 验证结果
   */
  validateTranslateRequest(body) {
    const { text, target_language } = body;

    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'text is required and must be a string' };
    }

    if (!target_language || typeof target_language !== 'string') {
      return { valid: false, error: 'target_language is required and must be a string' };
    }

    if (text.length > 5000) {
      return { valid: false, error: 'text too long (max 5000 characters)' };
    }

    if (target_language.length > 50) {
      return { valid: false, error: 'target_language too long (max 50 characters)' };
    }

    return { valid: true };
  }

  /**
   * 映射错误代码
   * @param {Error} error - 错误对象
   * @returns {string} 错误代码
   */
  mapErrorCode(error) {
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'AuthenticationError') return 'AUTHENTICATION_ERROR';
    if (error.name === 'TimeoutError') return 'TIMEOUT_ERROR';
    if (error.message.includes('rate limit')) return 'RATE_LIMIT_EXCEEDED';
    if (error.message.includes('Byteplus') || error.message.includes('AI Provider')) {
      return 'AI_PROVIDER_ERROR';
    }
    return 'INTERNAL_ERROR';
  }

  /**
   * 获取错误状态码
   * @param {Error} error - 错误对象
   * @returns {number} HTTP状态码
   */
  getErrorStatus(error) {
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'AuthenticationError') return 401;
    if (error.message.includes('rate limit')) return 429;
    if (error.name === 'TimeoutError') return 504;
    return 500;
  }

  /**
   * 发送错误响应
   * @param {Object} res - Express响应对象
   * @param {Object} errorInfo - 错误信息
   */
  sendErrorResponse(res, errorInfo) {
    const { code, message, requestId, status = 500 } = errorInfo;
    
    res.status(status).json({
      success: false,
      error: message,
      code,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
}

export default TranslateController;