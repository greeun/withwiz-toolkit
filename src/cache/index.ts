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
  initializeCache,
  isCacheEnabled,
  getEnv,
  getENV,
  getConfig,
  getDefaultConfig,
  validateRedisEnvironment,
} from './cache-env';

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
} from './cache-redis';
export type { CacheMetrics, RedisConnectionStatus } from './cache-redis';

// ============================================================================
// Cache Configuration
// ============================================================================
export { getCacheConfig, getCacheTTL } from './cache-config';
export type { CacheOptions } from './cache-config';

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
} from './cache-defaults';

// ============================================================================
// Cache Managers
// ============================================================================
export { RedisCacheManager } from './redis-cache-manager';
export { NoopCacheManager } from './noop-cache-manager';

// ============================================================================
// Cache Factory and Instances (범용만)
// ============================================================================
export {
  getCacheManager,
  getEffectiveCacheBackend,
  cache,
  geoCache,
} from './cache-factory';

// ============================================================================
// Cache Keys (Legacy)
// ============================================================================
export { cacheKeys } from './cache-keys-legacy';

// ============================================================================
// Cache Invalidation
// ============================================================================
export { invalidateCache } from './cache-invalidation';

// ============================================================================
// Cache Wrapper and Metrics
// ============================================================================
export { withCache, cacheMetrics } from './cache-wrapper';

// ============================================================================
// Sub-modules Re-exports
// ============================================================================
export { InMemoryCacheManager } from './inmemory-cache-manager';
export { HybridCacheManager } from './hybrid-cache-manager';
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
} from './cache-types';
