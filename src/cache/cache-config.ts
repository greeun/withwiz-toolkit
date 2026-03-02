/**
 * Cache Configuration
 *
 * 캐시 설정 유틸리티 및 TTL 관리
 */
import { getENV, isCacheEnabled } from './cache-env';

// ============================================================================
// 캐시 옵션 인터페이스
// ============================================================================

export interface CacheOptions {
  ttl?: number; // 초 단위
  prefix?: string;
}

// ============================================================================
// 통일된 캐시 설정 유틸리티
// ============================================================================

/**
 * 통일된 캐시 설정 유틸리티
 * getENV().CACHE를 통해 중앙화된 환경변수에서 값을 가져옴
 */
export const getCacheConfig = {
  // Analytics 캐시 설정
  analytics: {
    enabled: () => getENV().CACHE.ANALYTICS.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.ANALYTICS.DURATION,
  },

  // User 캐시 설정
  user: {
    enabled: () => getENV().CACHE.USER.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.USER.DURATION,
  },

  // GeoIP 캐시 설정
  geoip: {
    enabled: () => getENV().CACHE.GEOIP.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.GEOIP.DURATION,
  },

  // Settings 캐시 설정
  settings: {
    enabled: () => getENV().CACHE.SETTINGS.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.SETTINGS.DURATION,
  },

  // Reserved Words 캐시 설정
  reservedWords: {
    enabled: () => getENV().CACHE.RESERVED_WORDS.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.RESERVED_WORDS.DURATION,
  },

  // Alias 캐시 설정
  alias: {
    enabled: () => getENV().CACHE.ALIAS.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.ALIAS.DURATION,
  },

  // Community 캐시 설정
  community: {
    enabled: () => getENV().CACHE.COMMUNITY.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.COMMUNITY.DURATION,
  },

  // Link 캐시 설정
  link: {
    enabled: () => getENV().CACHE.LINK.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.LINK.DURATION,
  },

  // Rate Limiter 캐시 설정
  rateLimit: {
    enabled: () => getENV().CACHE.RATE_LIMIT.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.RATE_LIMIT.DURATION,
  },

  // URL Shortener Token 캐시 설정
  urlToken: {
    enabled: () => getENV().CACHE.URL_TOKEN.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.URL_TOKEN.DURATION,
  },

  // API Key 캐시 설정
  apiKey: {
    enabled: () => getENV().CACHE.API_KEY.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.API_KEY.DURATION,
  },

  // API Config 캐시 설정
  apiConfig: {
    enabled: () => getENV().CACHE.API_CONFIG.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.API_CONFIG.DURATION,
  },
};

// ============================================================================
// 기존 호환성을 위한 TTL 함수들 (deprecated)
// ============================================================================

/**
 * @deprecated getCacheConfig.xxx.duration()을 사용하세요.
 * 예: getCacheConfig.analytics.duration()
 */
export const getCacheTTL = {
  settings: () => getCacheConfig.settings.duration(),
  reservedWords: () => getCacheConfig.reservedWords.duration(),
  alias: () => getCacheConfig.alias.duration(),
  user: () => getCacheConfig.user.duration(),
  analytics: () => getCacheConfig.analytics.duration(),
  geoip: () => getCacheConfig.geoip.duration(),
  community: () => getCacheConfig.community.duration(),
  link: () => getCacheConfig.link.duration(),
  default: () => getCacheConfig.analytics.duration(),
};
