/**
 * Cache Module Entry Point
 *
 * 캐시 모듈의 통합 진입점
 * - 모든 캐시 관련 기능을 re-export
 */

// ============================================================================
// Environment Configuration
// ============================================================================
export {
  isCacheEnabled,
  getEnv,
  getENV,
  getConfig,
  validateRedisEnvironment,
} from '@withwiz/toolkit/core/cache/cache-env';

// initializeCache는 config.ts에서 export (새로운 코드 기반 DI 패턴)
export { initializeCache, getResolvedCacheConfig, resetCache } from '@withwiz/toolkit/core/cache/config';

// ============================================================================
// Redis Client Management
// ============================================================================
export {
  checkRedisConnection,
  isRedisAvailableNow,
  getRedisClient,
  logRedisInitialization,
  // 전역 Redis 상태 관리
  isRedisGloballyDisabled,
  notifyRedisError,
  resetRedisGlobalState,
  getRedisGlobalStatus,
} from '@withwiz/toolkit/core/cache/cache-redis';
export type { CacheMetrics, RedisConnectionStatus } from '@withwiz/toolkit/core/cache/cache-redis';

// ============================================================================
// Cache Configuration
// ============================================================================
export { getCacheConfig, getCacheTTL } from '@withwiz/toolkit/core/cache/cache-config';
export type { CacheOptions } from '@withwiz/toolkit/core/cache/cache-config';

// ============================================================================
// Cache Defaults
// ============================================================================
export {
  INMEMORY_CACHE_DEFAULTS,
  CACHE_TTL_DEFAULTS,
  CACHE_DURATION_DEFAULTS,
  CACHE_ENV_VARS,
  ONE_MINUTE,
  FIVE_MINUTES,
  TEN_MINUTES,
  FIFTEEN_MINUTES,
  THIRTY_MINUTES,
  ONE_HOUR,
  ONE_DAY,
  THIRTY_DAYS,
} from '@withwiz/toolkit/core/cache/cache-defaults';

// ============================================================================
// Cache Managers
// ============================================================================
export { RedisCacheManager } from '@withwiz/toolkit/core/cache/redis-cache-manager';
export { NoopCacheManager } from '@withwiz/toolkit/core/cache/noop-cache-manager';

// ============================================================================
// Cache Factory and Instances (범용만)
// ============================================================================
export {
  getCacheManager,
  getEffectiveCacheBackend,
  cache,
  geoCache,
} from '@withwiz/toolkit/core/cache/cache-factory';

// ============================================================================
// Cache Invalidation
// ============================================================================
export { invalidateCache } from '@withwiz/toolkit/core/cache/cache-invalidation';

// ============================================================================
// Cache Wrapper and Metrics
// ============================================================================
export { withCache, cacheMetrics } from '@withwiz/toolkit/core/cache/cache-wrapper';

// ============================================================================
// Sub-modules Re-exports
// ============================================================================
export { InMemoryCacheManager } from '@withwiz/toolkit/core/cache/inmemory-cache-manager';
export { HybridCacheManager } from '@withwiz/toolkit/core/cache/hybrid-cache-manager';
export type {
  InMemoryCacheConfig,
  CacheBackendType,
  HybridCacheMetrics,
  CacheEntry,
  InMemoryCacheMetrics,
  InMemoryCacheStats,
  HybridCacheConfig,
  HybridConnectionStatus,
  IUnifiedCacheManager,
} from '@withwiz/toolkit/core/cache/cache-types';
