/**
 * Cache Environment Configuration
 *
 * 캐시 모듈의 환경 설정 주입 및 관리
 * - 외부에서 initializeCache()를 통해 환경 설정 주입
 * - 기본값은 process.env에서 직접 읽음
 */
import { logger } from '@withwiz/logger/logger';
import type { ISharedEnvConfig, IRawEnv } from '@withwiz/types/env';
import {
  INMEMORY_CACHE_DEFAULTS,
  CACHE_TTL_DEFAULTS,
  CACHE_DURATION_DEFAULTS,
  CACHE_FALLBACK_DEFAULTS,
  CACHE_HEALTH_DEFAULTS,
} from './cache-defaults';

// ============================================================================
// 환경 변수 체크 헬퍼 함수
// ============================================================================

/**
 * Redis 캐시 활성화 여부 확인 (CACHE_REDIS_ENABLED)
 * @returns CACHE_REDIS_ENABLED 환경변수가 'false'가 아니면 true
 */
function _isRedisCacheEnabled(): boolean {
  return process.env.CACHE_REDIS_ENABLED !== 'false';
}

/**
 * 인메모리 캐시 활성화 여부 확인 (CACHE_INMEMORY_ENABLED)
 * @returns CACHE_INMEMORY_ENABLED 환경변수가 'false'가 아니면 true
 */
function _isInmemoryCacheEnabled(): boolean {
  return process.env.CACHE_INMEMORY_ENABLED !== 'false';
}

/**
 * Redis 환경변수 설정 여부 확인
 * @returns Redis URL/Token이 설정되어 있는지 여부
 */
function _isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Redis 사용 가능 여부 확인 (활성화 + 환경변수 설정)
 * @returns CACHE_REDIS_ENABLED=true이고 Redis 환경변수가 설정되어 있으면 true
 */
function _isRedisAvailable(): boolean {
  return _isRedisCacheEnabled() && _isRedisConfigured();
}

// ============================================================================
// 환경 설정 주입 관리
// ============================================================================

/**
 * 주입된 환경 설정 (초기화 전까지 null)
 */
let _injectedConfig: ISharedEnvConfig | null = null;

/**
 * 기본 환경 설정 (fallback용)
 * process.env에서 직접 읽되, 타입 안전하게 처리
 */
export function getDefaultConfig(): ISharedEnvConfig {
  const nodeEnv = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
  const cacheEnabled = process.env.CACHE_ENABLED !== 'false';
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisEnabled = _isRedisCacheEnabled();
  const inmemoryEnabled = _isInmemoryCacheEnabled();
  const redisAvailable = _isRedisAvailable();

  const defaultCategoryConfig = (enabled: boolean, duration: number) => ({
    ENABLED: enabled,
    DURATION: duration,
  });

  return {
    env: {
      NODE_ENV: nodeEnv,
      UPSTASH_REDIS_REST_URL: redisUrl,
      UPSTASH_REDIS_REST_TOKEN: redisToken,
      CACHE_ENABLED: cacheEnabled,
    },
    ENV: {
      REDIS: {
        URL: redisUrl,
        TOKEN: redisToken,
        IS_AVAILABLE: redisAvailable,
        ENABLED: redisEnabled,
      },
      CACHE: {
        ENABLED: cacheEnabled,
        REDIS: {
          ENABLED: redisEnabled,
        },
        INMEMORY: {
          ENABLED: inmemoryEnabled,
          MAX_SIZE: parseInt(process.env.CACHE_INMEMORY_MAX_SIZE || String(INMEMORY_CACHE_DEFAULTS.MAX_SIZE), 10),
          MAX_MB: parseInt(process.env.CACHE_INMEMORY_MAX_MB || String(INMEMORY_CACHE_DEFAULTS.MAX_MB), 10),
          EVICTION: (process.env.CACHE_INMEMORY_EVICTION as 'lru' | 'fifo' | 'ttl') || INMEMORY_CACHE_DEFAULTS.EVICTION,
          CLEANUP_INTERVAL: parseInt(process.env.CACHE_INMEMORY_CLEANUP_INTERVAL || String(INMEMORY_CACHE_DEFAULTS.CLEANUP_INTERVAL), 10),
        },
        TTL: {
          DEFAULT: parseInt(process.env.CACHE_TTL_DEFAULT || String(CACHE_TTL_DEFAULTS.DEFAULT), 10),
          SHORT: parseInt(process.env.CACHE_TTL_SHORT || String(CACHE_TTL_DEFAULTS.SHORT), 10),
          LONG: parseInt(process.env.CACHE_TTL_LONG || String(CACHE_TTL_DEFAULTS.LONG), 10),
          GEOIP: parseInt(process.env.CACHE_TTL_GEOIP || String(CACHE_TTL_DEFAULTS.GEOIP), 10),
          SETTINGS: parseInt(process.env.CACHE_TTL_SETTINGS || String(CACHE_TTL_DEFAULTS.SETTINGS), 10),
          ANALYTICS: parseInt(process.env.CACHE_TTL_ANALYTICS || String(CACHE_TTL_DEFAULTS.ANALYTICS), 10),
          USER: parseInt(process.env.CACHE_TTL_USER || String(CACHE_TTL_DEFAULTS.USER), 10),
          LINK: parseInt(process.env.CACHE_TTL_LINK || String(CACHE_TTL_DEFAULTS.LINK), 10),
          ALIAS: parseInt(process.env.CACHE_TTL_ALIAS || String(CACHE_TTL_DEFAULTS.ALIAS), 10),
          COMMUNITY: parseInt(process.env.CACHE_TTL_COMMUNITY || String(CACHE_TTL_DEFAULTS.COMMUNITY), 10),
          RESERVED_WORDS: parseInt(process.env.CACHE_TTL_RESERVED_WORDS || String(CACHE_TTL_DEFAULTS.RESERVED_WORDS), 10),
        },
        ANALYTICS: defaultCategoryConfig(process.env.CACHE_ANALYTICS_ENABLED !== 'false', parseInt(process.env.CACHE_ANALYTICS_DURATION || String(CACHE_DURATION_DEFAULTS.ANALYTICS), 10)),
        USER: defaultCategoryConfig(process.env.CACHE_USER_ENABLED !== 'false', parseInt(process.env.CACHE_USER_DURATION || String(CACHE_DURATION_DEFAULTS.USER), 10)),
        GEOIP: defaultCategoryConfig(process.env.CACHE_GEOIP_ENABLED !== 'false', parseInt(process.env.CACHE_GEOIP_DURATION || String(CACHE_DURATION_DEFAULTS.GEOIP), 10)),
        SETTINGS: defaultCategoryConfig(process.env.CACHE_SETTINGS_ENABLED !== 'false', parseInt(process.env.CACHE_SETTINGS_DURATION || String(CACHE_DURATION_DEFAULTS.SETTINGS), 10)),
        RESERVED_WORDS: defaultCategoryConfig(process.env.CACHE_RESERVED_WORDS_ENABLED !== 'false', parseInt(process.env.CACHE_RESERVED_WORDS_DURATION || String(CACHE_DURATION_DEFAULTS.RESERVED_WORDS), 10)),
        ALIAS: defaultCategoryConfig(process.env.CACHE_ALIAS_ENABLED !== 'false', parseInt(process.env.CACHE_ALIAS_DURATION || String(CACHE_DURATION_DEFAULTS.ALIAS), 10)),
        COMMUNITY: defaultCategoryConfig(process.env.CACHE_COMMUNITY_ENABLED !== 'false', parseInt(process.env.CACHE_COMMUNITY_DURATION || String(CACHE_DURATION_DEFAULTS.COMMUNITY), 10)),
        LINK: defaultCategoryConfig(process.env.CACHE_LINK_ENABLED !== 'false', parseInt(process.env.CACHE_LINK_DURATION || process.env.CACHE_TTL_LINK || String(CACHE_DURATION_DEFAULTS.LINK), 10)),
        // RATE_LIMIT: ENABLED 제거됨 - Rate Limiting은 RATE_LIMIT_ENABLED로 제어, CACHE_ENABLED로 Redis 사용 여부 결정
        RATE_LIMIT: defaultCategoryConfig(true, parseInt(process.env.CACHE_RATE_LIMIT_DURATION || String(CACHE_DURATION_DEFAULTS.RATE_LIMIT), 10)),
        URL_TOKEN: defaultCategoryConfig(process.env.CACHE_URL_TOKEN_ENABLED !== 'false', parseInt(process.env.CACHE_URL_TOKEN_DURATION || String(CACHE_DURATION_DEFAULTS.URL_TOKEN), 10)),
        API_KEY: defaultCategoryConfig(process.env.CACHE_API_KEY_ENABLED !== 'false', parseInt(process.env.CACHE_API_KEY_DURATION || String(CACHE_DURATION_DEFAULTS.API_KEY), 10)),
        API_CONFIG: defaultCategoryConfig(process.env.CACHE_API_CONFIG_ENABLED !== 'false', parseInt(process.env.CACHE_API_CONFIG_DURATION || String(CACHE_DURATION_DEFAULTS.API_CONFIG), 10)),
      },
    },
    isCacheEnabled: () => cacheEnabled,
    isRedisAvailable: () => redisAvailable,
  };
}

/**
 * 현재 환경 설정 가져오기 (주입된 설정 또는 기본값)
 */
export function getConfig(): ISharedEnvConfig {
  if (_injectedConfig) {
    return _injectedConfig;
  }
  return getDefaultConfig();
}

// 편의를 위한 getter 함수들
export const getEnv = (): IRawEnv => getConfig().env;
export const getENV = () => getConfig().ENV;

// Next.js 개발 모드(Turbopack 포함)에서 중복 초기화 방지를 위한 전역 플래그
declare global {
  // eslint-disable-next-line no-var
  var __cacheInitialized: boolean | undefined;
}

/**
 * 캐시 모듈 초기화 (외부에서 환경 설정 주입)
 *
 * @example
 * ```typescript
 * import { initializeCache } from '@withwiz/cache/cache';
 * import { env, ENV, isCacheEnabled, isRedisAvailable } from '<your-project>/env';
 *
 * initializeCache({ env, ENV, isCacheEnabled, isRedisAvailable });
 * ```
 */
export function initializeCache(config: ISharedEnvConfig): void {
  // 이미 초기화된 경우 건너뛰기 (Next.js 개발 모드에서 중복 로그 방지)
  if (global.__cacheInitialized) {
    return;
  }

  _injectedConfig = config;
  global.__cacheInitialized = true;

  // 프로덕션 런타임에서만 로그 출력 (빌드 시 및 개발 모드 HMR 시 로그 방지)
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_BUILD_TIME !== 'true') {
    logger.info('[Cache] Environment configuration injection complete', {
      cacheEnabled: config.isCacheEnabled(),
      redisAvailable: config.isRedisAvailable(),
    });
  }
}

// 캐시 활성화 여부 확인 함수
export const isCacheEnabled = (): boolean => getConfig().isCacheEnabled();

// 환경 변수 검증 함수
export function validateRedisEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const env = getEnv();

  if (!env.UPSTASH_REDIS_REST_URL) {
    errors.push('UPSTASH_REDIS_REST_URL is not configured.');
  } else if (env.UPSTASH_REDIS_REST_URL.trim() === '') {
    errors.push('UPSTASH_REDIS_REST_URL is an empty string.');
  }

  if (!env.UPSTASH_REDIS_REST_TOKEN) {
    errors.push('UPSTASH_REDIS_REST_TOKEN is not configured.');
  } else if (env.UPSTASH_REDIS_REST_TOKEN.trim() === '') {
    errors.push('UPSTASH_REDIS_REST_TOKEN is an empty string.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// 캐시 폴백 설정 읽기
// ============================================================================

/**
 * 캐시 폴백 설정 인터페이스
 */
export interface CacheFallbackConfig {
  /** 전역 Redis 에러 임계값 */
  redisErrorThresholdGlobal: number;
  /** 인스턴스별 Redis 에러 임계값 */
  redisErrorThresholdLocal: number;
  /** Redis 재연결 간격 (ms) */
  redisReconnectInterval: number;
  /** Redis 에러 시 인메모리 폴백 허용 여부 */
  fallbackOnRedisError: boolean;
  /** hybrid 모드에서 인메모리에도 저장 여부 */
  writeToMemory: boolean;
}

/**
 * 캐시 폴백 설정 가져오기
 */
export function getCacheFallbackConfig(): CacheFallbackConfig {
  return {
    redisErrorThresholdGlobal: parseInt(
      process.env.CACHE_REDIS_ERROR_THRESHOLD_GLOBAL ||
      String(CACHE_FALLBACK_DEFAULTS.REDIS_ERROR_THRESHOLD_GLOBAL),
      10
    ),
    redisErrorThresholdLocal: parseInt(
      process.env.CACHE_REDIS_ERROR_THRESHOLD_LOCAL ||
      String(CACHE_FALLBACK_DEFAULTS.REDIS_ERROR_THRESHOLD_LOCAL),
      10
    ),
    redisReconnectInterval: parseInt(
      process.env.CACHE_REDIS_RECONNECT_INTERVAL ||
      String(CACHE_FALLBACK_DEFAULTS.REDIS_RECONNECT_INTERVAL),
      10
    ),
    fallbackOnRedisError:
      process.env.CACHE_FALLBACK_ON_REDIS_ERROR !== 'false',
    writeToMemory:
      process.env.CACHE_WRITE_TO_MEMORY !== 'false',
  };
}

// ============================================================================
// 캐시 건강상태 평가 설정 읽기
// ============================================================================

/**
 * 캐시 건강상태 설정 인터페이스
 */
export interface CacheHealthConfig {
  /** 건강상태 판단: 에러율 임계값 (%) */
  errorRateThreshold: number;
  /** 건강상태 판단: 히트율 임계값 (%) */
  hitRateThreshold: number;
  /** 성능 리포트: 권장 히트율 (%) */
  reportHitRateThreshold: number;
  /** 성능 리포트: 응답시간 임계값 (ms) */
  reportResponseTimeThreshold: number;
  /** 성능 리포트: 무효화 빈도 임계값 (/분) */
  reportInvalidationThreshold: number;
  /** 성능 리포트: 최소 요청 수 */
  reportMinRequests: number;
}

/**
 * 캐시 건강상태 설정 가져오기
 */
export function getCacheHealthConfig(): CacheHealthConfig {
  return {
    errorRateThreshold: parseInt(
      process.env.CACHE_HEALTH_ERROR_RATE_THRESHOLD ||
      String(CACHE_HEALTH_DEFAULTS.ERROR_RATE_THRESHOLD),
      10
    ),
    hitRateThreshold: parseInt(
      process.env.CACHE_HEALTH_HIT_RATE_THRESHOLD ||
      String(CACHE_HEALTH_DEFAULTS.HIT_RATE_THRESHOLD),
      10
    ),
    reportHitRateThreshold: parseInt(
      process.env.CACHE_REPORT_HIT_RATE_THRESHOLD ||
      String(CACHE_HEALTH_DEFAULTS.REPORT_HIT_RATE_THRESHOLD),
      10
    ),
    reportResponseTimeThreshold: parseInt(
      process.env.CACHE_REPORT_RESPONSE_TIME_THRESHOLD ||
      String(CACHE_HEALTH_DEFAULTS.REPORT_RESPONSE_TIME_THRESHOLD),
      10
    ),
    reportInvalidationThreshold: parseInt(
      process.env.CACHE_REPORT_INVALIDATION_THRESHOLD ||
      String(CACHE_HEALTH_DEFAULTS.REPORT_INVALIDATION_THRESHOLD),
      10
    ),
    reportMinRequests: parseInt(
      process.env.CACHE_REPORT_MIN_REQUESTS ||
      String(CACHE_HEALTH_DEFAULTS.REPORT_MIN_REQUESTS),
      10
    ),
  };
}
