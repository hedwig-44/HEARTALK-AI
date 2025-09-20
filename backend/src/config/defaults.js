/**
 * 系统默认配置
 * 包含用户偏好、时间戳偏移等默认设置
 */

/**
 * 默认用户偏好设置
 * 避免在业务代码中硬编码这些值
 */
const DEFAULT_USER_PREFERENCES = {
  language: process.env.DEFAULT_LANGUAGE || 'zh-CN',
  theme: process.env.DEFAULT_THEME || 'light',
  notifications: process.env.DEFAULT_NOTIFICATIONS === 'false' ? false : true,
  aiPersonality: process.env.DEFAULT_AI_PERSONALITY || 'friendly'
};

/**
 * 时间戳偏移配置
 * 确保AI回复时间晚于用户消息，避免排序混乱
 */
const TIMESTAMP_CONFIG = {
  // AI回复相对于用户消息的最小延迟（毫秒）
  AI_RESPONSE_MIN_DELAY: parseInt(process.env.AI_RESPONSE_MIN_DELAY) || 1000,
  // AI回复相对于用户消息的最大延迟（毫秒）
  AI_RESPONSE_MAX_DELAY: parseInt(process.env.AI_RESPONSE_MAX_DELAY) || 5000,
  // 时间戳精度（毫秒）
  TIMESTAMP_PRECISION: parseInt(process.env.TIMESTAMP_PRECISION) || 1
};

/**
 * 支持的语言列表
 */
const SUPPORTED_LANGUAGES = [
  'zh-CN',
  'zh-TW', 
  'en-US',
  'ja-JP',
  'ko-KR'
];

/**
 * 支持的主题列表
 */
const SUPPORTED_THEMES = [
  'light',
  'dark',
  'auto'
];

/**
 * 支持的AI个性类型
 */
const SUPPORTED_AI_PERSONALITIES = [
  'friendly',    // 友好型
  'professional', // 专业型
  'casual',      // 随意型
  'formal'       // 正式型
];

/**
 * 生成带偏移的时间戳
 * @param {Date} baseTime - 基准时间（通常是用户消息时间）
 * @param {string} role - 角色 ('user' | 'assistant')
 * @returns {Date} 调整后的时间戳
 */
function generateTimestamp(baseTime = new Date(), role = 'user') {
  if (role === 'user') {
    return baseTime;
  }
  
  // AI回复需要在用户消息之后
  const { AI_RESPONSE_MIN_DELAY, AI_RESPONSE_MAX_DELAY } = TIMESTAMP_CONFIG;
  const randomDelay = AI_RESPONSE_MIN_DELAY + 
    Math.random() * (AI_RESPONSE_MAX_DELAY - AI_RESPONSE_MIN_DELAY);
  
  return new Date(baseTime.getTime() + randomDelay);
}

/**
 * 验证用户偏好设置
 * @param {Object} preferences - 用户偏好对象
 * @returns {Object} 验证后的偏好设置
 */
function validateUserPreferences(preferences = {}) {
  const validated = { ...DEFAULT_USER_PREFERENCES };
  
  // 验证语言
  if (preferences.language && SUPPORTED_LANGUAGES.includes(preferences.language)) {
    validated.language = preferences.language;
  }
  
  // 验证主题
  if (preferences.theme && SUPPORTED_THEMES.includes(preferences.theme)) {
    validated.theme = preferences.theme;
  }
  
  // 验证通知设置
  if (typeof preferences.notifications === 'boolean') {
    validated.notifications = preferences.notifications;
  }
  
  // 验证AI个性
  if (preferences.aiPersonality && SUPPORTED_AI_PERSONALITIES.includes(preferences.aiPersonality)) {
    validated.aiPersonality = preferences.aiPersonality;
  }
  
  return validated;
}

module.exports = {
  DEFAULT_USER_PREFERENCES,
  TIMESTAMP_CONFIG,
  SUPPORTED_LANGUAGES,
  SUPPORTED_THEMES,
  SUPPORTED_AI_PERSONALITIES,
  generateTimestamp,
  validateUserPreferences
};