/**
 * Cache Config
 *
 * 코드 기반 캐시 설정 초기화 모듈 (process.env 의존성 제거)
 */

import {
  INMEMORY_CACHE_DEFAULTS,
  CACHE_TTL_DEFAULTS,
  CACHE_DURATION_DEFAULTS,
  CACHE_FALLBACK_DEFAULTS,
  CACHE_HEALTH_DEFAULTS,
} from './cache-defaults';
import { ConfigurationError } from '../config/errors';

// ============================================================================
// Input Interface
// ============================================================================

export interface CacheConfigInput {
  enabled?: boolean;
  redis?: {
    url: string;
    token: string;
    enabled?: boolean;
  };
  inmemory?: {
    enabled?: boolean;
    maxSize?: number;
    maxMb?: number;
    eviction?: 'lru' | 'fifo' | 'ttl';
    cleanupInterval?: number;
  };
  ttl?: Partial<{
    DEFAULT: number;
    SHORT: number;
    LONG: number;
    GEOIP: number;
    SETTINGS: number;
    ANALYTICS: number;
    USER: number;
  }>;
  categories?: Partial<Record<string, { enabled?: boolean; duration?: number }>>;
  fallback?: {
    redisErrorThresholdGlobal?: number;
    redisErrorThresholdLocal?: number;
    redisReconnectInterval?: number;
    fallbackOnRedisError?: boolean;
    writeToMemory?: boolean;
  };
  health?: {
    errorRateThreshold?: number;
    hitRateThreshold?: number;
    reportHitRateThreshold?: number;
    reportResponseTimeThreshold?: number;
    reportInvalidationThreshold?: number;
    reportMinRequests?: number;
  };
}

// ============================================================================
// Resolved Interface
// ============================================================================

export interface ResolvedCacheConfig {
  enabled: boolean;
  redis?: {
    url: string;
    token: string;
    enabled: boolean;
  };
  inmemory: {
    enabled: boolean;
    maxSize: number;
    maxMb: number;
    eviction: 'lru' | 'fifo' | 'ttl';
    cleanupInterval: number;
  };
  ttl: {
    DEFAULT: number;
    SHORT: number;
    LONG: number;
    GEOIP: number;
    SETTINGS: number;
    ANALYTICS: number;
    USER: number;
  };
  categories: Record<string, { enabled: boolean; duration: number }>;
  fallback: {
    redisErrorThresholdGlobal: number;
    redisErrorThresholdLocal: number;
    redisReconnectInterval: number;
    fallbackOnRedisError: boolean;
    writeToMemory: boolean;
  };
  health: {
    errorRateThreshold: number;
    hitRateThreshold: number;
    reportHitRateThreshold: number;
    reportResponseTimeThreshold: number;
    reportInvalidationThreshold: number;
    reportMinRequests: number;
  };
}

// ============================================================================
// Public API
// ============================================================================

export function initializeCache(input: CacheConfigInput): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.cache) return;
  // Redis 유효성 검사
  if (input.redis !== undefined) {
    if (!input.redis.url) {
      throw new ConfigurationError('cache', 'redis.url is required');
    }
    if (!input.redis.token) {
      throw new ConfigurationError('cache', 'redis.token is required');
    }
  }

  // 기본 카테고리 생성 (CACHE_DURATION_DEFAULTS 키 기반)
  const defaultCategories: Record<string, { enabled: boolean; duration: number }> = {};
  for (const [key, duration] of Object.entries(CACHE_DURATION_DEFAULTS)) {
    defaultCategories[key] = { enabled: true, duration };
  }

  // 사용자 카테고리 병합
  const mergedCategories = { ...defaultCategories };
  if (input.categories) {
    for (const [key, value] of Object.entries(input.categories)) {
      if (value !== undefined) {
        mergedCategories[key] = {
          enabled: value.enabled ?? true,
          duration: value.duration ?? defaultCategories[key]?.duration ?? CACHE_TTL_DEFAULTS.DEFAULT,
        };
      }
    }
  }

  globalThis.__withwiz_config.cache = {
    enabled: input.enabled ?? true,
    redis: input.redis
      ? {
          url: input.redis.url,
          token: input.redis.token,
          enabled: input.redis.enabled ?? true,
        }
      : undefined,
    inmemory: {
      enabled: input.inmemory?.enabled ?? true,
      maxSize: input.inmemory?.maxSize ?? INMEMORY_CACHE_DEFAULTS.MAX_SIZE,
      maxMb: input.inmemory?.maxMb ?? INMEMORY_CACHE_DEFAULTS.MAX_MB,
      eviction: input.inmemory?.eviction ?? INMEMORY_CACHE_DEFAULTS.EVICTION,
      cleanupInterval: input.inmemory?.cleanupInterval ?? INMEMORY_CACHE_DEFAULTS.CLEANUP_INTERVAL,
    },
    ttl: {
      DEFAULT: input.ttl?.DEFAULT ?? CACHE_TTL_DEFAULTS.DEFAULT,
      SHORT: input.ttl?.SHORT ?? CACHE_TTL_DEFAULTS.SHORT,
      LONG: input.ttl?.LONG ?? CACHE_TTL_DEFAULTS.LONG,
      GEOIP: input.ttl?.GEOIP ?? CACHE_TTL_DEFAULTS.GEOIP,
      SETTINGS: input.ttl?.SETTINGS ?? CACHE_TTL_DEFAULTS.SETTINGS,
      ANALYTICS: input.ttl?.ANALYTICS ?? CACHE_TTL_DEFAULTS.ANALYTICS,
      USER: input.ttl?.USER ?? CACHE_TTL_DEFAULTS.USER,
    },
    categories: mergedCategories,
    fallback: {
      redisErrorThresholdGlobal:
        input.fallback?.redisErrorThresholdGlobal ?? CACHE_FALLBACK_DEFAULTS.REDIS_ERROR_THRESHOLD_GLOBAL,
      redisErrorThresholdLocal:
        input.fallback?.redisErrorThresholdLocal ?? CACHE_FALLBACK_DEFAULTS.REDIS_ERROR_THRESHOLD_LOCAL,
      redisReconnectInterval:
        input.fallback?.redisReconnectInterval ?? CACHE_FALLBACK_DEFAULTS.REDIS_RECONNECT_INTERVAL,
      fallbackOnRedisError:
        input.fallback?.fallbackOnRedisError ?? CACHE_FALLBACK_DEFAULTS.FALLBACK_ON_REDIS_ERROR,
      writeToMemory: input.fallback?.writeToMemory ?? CACHE_FALLBACK_DEFAULTS.WRITE_TO_MEMORY,
    },
    health: {
      errorRateThreshold:
        input.health?.errorRateThreshold ?? CACHE_HEALTH_DEFAULTS.ERROR_RATE_THRESHOLD,
      hitRateThreshold:
        input.health?.hitRateThreshold ?? CACHE_HEALTH_DEFAULTS.HIT_RATE_THRESHOLD,
      reportHitRateThreshold:
        input.health?.reportHitRateThreshold ?? CACHE_HEALTH_DEFAULTS.REPORT_HIT_RATE_THRESHOLD,
      reportResponseTimeThreshold:
        input.health?.reportResponseTimeThreshold ?? CACHE_HEALTH_DEFAULTS.REPORT_RESPONSE_TIME_THRESHOLD,
      reportInvalidationThreshold:
        input.health?.reportInvalidationThreshold ?? CACHE_HEALTH_DEFAULTS.REPORT_INVALIDATION_THRESHOLD,
      reportMinRequests:
        input.health?.reportMinRequests ?? CACHE_HEALTH_DEFAULTS.REPORT_MIN_REQUESTS,
    },
  };
}

export function getResolvedCacheConfig(): ResolvedCacheConfig {
  const cache = globalThis.__withwiz_config?.cache;
  if (!cache) {
    throw new ConfigurationError('cache', 'Cache config not initialized. Call initializeCache() first.');
  }
  return cache;
}

export function resetCache(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.cache;
}
