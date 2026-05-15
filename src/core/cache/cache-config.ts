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

  // Rate Limiter 캐시 설정
  rateLimit: {
    enabled: () => getENV().CACHE.RATE_LIMIT.ENABLED && isCacheEnabled(),
    duration: () => getENV().CACHE.RATE_LIMIT.DURATION,
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
  user: () => getCacheConfig.user.duration(),
  analytics: () => getCacheConfig.analytics.duration(),
  geoip: () => getCacheConfig.geoip.duration(),
  default: () => getCacheConfig.analytics.duration(),
};
