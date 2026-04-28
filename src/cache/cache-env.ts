/**
 * Cache Environment Configuration
 *
 * 캐시 모듈의 환경 설정 관리
 * - getResolvedCacheConfig()에서 설정을 읽어 ISharedEnvConfig 호환 레이어 제공
 * - process.env 의존성 없음
 */
import type { ISharedEnvConfig, IRawEnv } from '@withwiz/types/env';
import { getResolvedCacheConfig } from './config';
import { getCommonConfig } from '../config/common';

// ============================================================================
// 내부 헬퍼
// ============================================================================

function _getNodeEnv(): 'development' | 'production' | 'test' {
  try {
    return getCommonConfig().nodeEnv;
  } catch {
    return 'development';
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 현재 캐시 설정을 ISharedEnvConfig 형태로 반환 (하위 호환 레이어)
 */
export function getConfig(): ISharedEnvConfig {
  const cc = getResolvedCacheConfig();
  const nodeEnv = _getNodeEnv();

  return {
    env: {
      NODE_ENV: nodeEnv,
      UPSTASH_REDIS_REST_URL: cc.redis?.url,
      UPSTASH_REDIS_REST_TOKEN: cc.redis?.token,
      CACHE_ENABLED: cc.enabled,
    },
    ENV: {
      REDIS: {
        URL: cc.redis?.url,
        TOKEN: cc.redis?.token,
        IS_AVAILABLE: !!cc.redis?.url && !!cc.redis?.token,
        ENABLED: cc.redis?.enabled ?? false,
      },
      CACHE: {
        ENABLED: cc.enabled,
        REDIS: { ENABLED: cc.redis?.enabled ?? false },
        INMEMORY: {
          ENABLED: cc.inmemory.enabled,
          MAX_SIZE: cc.inmemory.maxSize,
          MAX_MB: cc.inmemory.maxMb,
          EVICTION: cc.inmemory.eviction,
          CLEANUP_INTERVAL: cc.inmemory.cleanupInterval,
        },
        TTL: cc.ttl,
        ANALYTICS: {
          ENABLED: cc.categories.ANALYTICS?.enabled ?? true,
          DURATION: cc.categories.ANALYTICS?.duration ?? 1800,
        },
        USER: {
          ENABLED: cc.categories.USER?.enabled ?? true,
          DURATION: cc.categories.USER?.duration ?? 600,
        },
        GEOIP: {
          ENABLED: cc.categories.GEOIP?.enabled ?? true,
          DURATION: cc.categories.GEOIP?.duration ?? 2592000,
        },
        SETTINGS: {
          ENABLED: cc.categories.SETTINGS?.enabled ?? true,
          DURATION: cc.categories.SETTINGS?.duration ?? 1800,
        },
        RATE_LIMIT: {
          ENABLED: true,
          DURATION: cc.categories.RATE_LIMIT?.duration ?? 60,
        },
      },
    },
    isCacheEnabled: () => cc.enabled,
    isRedisAvailable: () => !!cc.redis?.url && !!cc.redis?.token,
  };
}

// 편의를 위한 getter 함수들
export const getEnv = (): IRawEnv => getConfig().env;
export const getENV = () => getConfig().ENV;

// 캐시 활성화 여부 확인 함수
export const isCacheEnabled = (): boolean => getResolvedCacheConfig().enabled;

// 환경 변수 검증 함수
export function validateRedisEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const cc = getResolvedCacheConfig();
  const redisUrl = cc.redis?.url;
  const redisToken = cc.redis?.token;

  if (!redisUrl) {
    errors.push('UPSTASH_REDIS_REST_URL is not configured.');
  } else if (redisUrl.trim() === '') {
    errors.push('UPSTASH_REDIS_REST_URL is an empty string.');
  }

  if (!redisToken) {
    errors.push('UPSTASH_REDIS_REST_TOKEN is not configured.');
  } else if (redisToken.trim() === '') {
    errors.push('UPSTASH_REDIS_REST_TOKEN is an empty string.');
  }

  return {
    isValid: errors.length === 0,
    errors,
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
  const fallback = getResolvedCacheConfig().fallback;
  return {
    redisErrorThresholdGlobal: fallback.redisErrorThresholdGlobal,
    redisErrorThresholdLocal: fallback.redisErrorThresholdLocal,
    redisReconnectInterval: fallback.redisReconnectInterval,
    fallbackOnRedisError: fallback.fallbackOnRedisError,
    writeToMemory: fallback.writeToMemory,
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
  const health = getResolvedCacheConfig().health;
  return {
    errorRateThreshold: health.errorRateThreshold,
    hitRateThreshold: health.hitRateThreshold,
    reportHitRateThreshold: health.reportHitRateThreshold,
    reportResponseTimeThreshold: health.reportResponseTimeThreshold,
    reportInvalidationThreshold: health.reportInvalidationThreshold,
    reportMinRequests: health.reportMinRequests,
  };
}

/**
 * 캐시 리포트 설정 인터페이스 (CacheHealthConfig의 리포트 관련 항목)
 */
export type CacheReportConfig = Pick<
  CacheHealthConfig,
  | 'reportHitRateThreshold'
  | 'reportResponseTimeThreshold'
  | 'reportInvalidationThreshold'
  | 'reportMinRequests'
>;
