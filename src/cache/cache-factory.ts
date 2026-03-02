/**
 * Cache Factory
 *
 * 캐시 매니저 인스턴스 팩토리 및 기본 인스턴스
 * - 전역 Redis 상태와 연동
 */
import { logger } from '@withwiz/logger/logger';
import type { CacheBackendType } from '@withwiz/types/env';
import { getENV, isCacheEnabled } from './cache-env';
import { isRedisAvailableNow, isRedisGloballyDisabled, getRedisGlobalStatus } from './cache-redis';
import { getCacheConfig } from './cache-config';
import { RedisCacheManager } from './redis-cache-manager';
import { NoopCacheManager } from './noop-cache-manager';
import { InMemoryCacheManager } from './inmemory-cache-manager';
import { HybridCacheManager } from './hybrid-cache-manager';
import type { InMemoryCacheConfig } from './cache-types';

// Re-export 전역 Redis 상태 함수
export { isRedisGloballyDisabled, getRedisGlobalStatus } from './cache-redis';

// ============================================================================
// 인메모리 캐시 설정
// ============================================================================

/**
 * 인메모리 캐시 설정 가져오기
 */
function getInMemoryConfig(): Partial<InMemoryCacheConfig> {
  const ENV = getENV();
  return {
    maxSize: ENV.CACHE.INMEMORY.MAX_SIZE,
    maxMemoryMB: ENV.CACHE.INMEMORY.MAX_MB,
    evictionPolicy: ENV.CACHE.INMEMORY.EVICTION,
    cleanupInterval: ENV.CACHE.INMEMORY.CLEANUP_INTERVAL,
  };
}

// ============================================================================
// 캐시 백엔드 결정
// ============================================================================

/**
 * 효과적인 캐시 백엔드 결정
 *
 * CACHE_REDIS_ENABLED + CACHE_INMEMORY_ENABLED 조합으로 백엔드 결정:
 * - true + true → 'hybrid' (Redis 기본, InMemory 폴백)
 * - true + false → 'redis' (Redis만 사용)
 * - false + true → 'memory' (InMemory만 사용)
 * - false + false → 'none' (NoopCache, 경고 로그)
 *
 * 전역적으로 Redis가 비활성화된 경우:
 * - 'hybrid' → 'memory'로 폴백
 * - 'redis' → 'memory'로 폴백 (inmemory가 활성화된 경우)
 *
 * @returns 'hybrid' | 'redis' | 'memory' | 'none'
 */
export function getEffectiveCacheBackend(): CacheBackendType | 'none' {
  const cache = getENV().CACHE;
  const redisEnabled = cache.REDIS?.ENABLED ?? true;
  const inmemoryEnabled = cache.INMEMORY?.ENABLED ?? true;

  // 전역적으로 Redis가 비활성화된 경우
  if (isRedisGloballyDisabled()) {
    if (inmemoryEnabled) {
      return 'memory';
    }
    return 'none';
  }

  if (redisEnabled && inmemoryEnabled) {
    return 'hybrid';
  } else if (redisEnabled && !inmemoryEnabled) {
    return 'redis';
  } else if (!redisEnabled && inmemoryEnabled) {
    return 'memory';
  } else {
    return 'none';
  }
}

// 백엔드 없는 경우 경고 로그 출력 여부 (중복 방지)
let _noBackendWarningLogged = false;

// ============================================================================
// 캐시 매니저 팩토리
// ============================================================================

/**
 * 캐시 매니저 인스턴스 생성 함수 (지연 초기화)
 */
export function getCacheManager(prefix: string): RedisCacheManager | HybridCacheManager | InMemoryCacheManager | NoopCacheManager {
  // 새로운 통일된 캐시 설정 확인
  const cacheConfig = getCacheConfig[prefix as keyof typeof getCacheConfig];
  if (cacheConfig && !cacheConfig.enabled()) {
    return new NoopCacheManager(prefix);
  }

  // 기존 전역 캐시 설정 확인 (fallback)
  if (!isCacheEnabled()) {
    return new NoopCacheManager(prefix);
  }

  // 효과적인 백엔드 결정 (새로운 환경 변수 체계 사용)
  const effectiveBackend = getEffectiveCacheBackend();
  const inmemoryConfig = getInMemoryConfig();

  // 백엔드가 없는 경우 (CACHE_REDIS_ENABLED=false && CACHE_INMEMORY_ENABLED=false)
  if (effectiveBackend === 'none') {
    if (!_noBackendWarningLogged) {
      logger.warn(
        '[Cache] CACHE_ENABLED=true이지만 사용 가능한 백엔드가 없습니다. ' +
        '캐시가 실질적으로 비활성화됩니다. ' +
        'CACHE_REDIS_ENABLED 또는 CACHE_INMEMORY_ENABLED를 true로 설정하세요.',
        {
          CACHE_ENABLED: true,
          CACHE_REDIS_ENABLED: getENV().CACHE.REDIS?.ENABLED ?? false,
          CACHE_INMEMORY_ENABLED: getENV().CACHE.INMEMORY?.ENABLED ?? false,
        }
      );
      _noBackendWarningLogged = true;
    }
    return new NoopCacheManager(prefix);
  }

  switch (effectiveBackend) {
    case 'memory':
      // 인메모리 전용 모드
      return InMemoryCacheManager.getInstance(prefix, inmemoryConfig);

    case 'hybrid':
      // 하이브리드 모드: Redis + 인메모리 폴백
      return HybridCacheManager.getInstance(prefix, {
        backend: 'hybrid',
        redisManager: isRedisAvailableNow() ? RedisCacheManager.getInstance(prefix) : null,
        inmemoryConfig,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

    case 'redis':
    default:
      // Redis 전용 모드 (기존 동작)
      return RedisCacheManager.getInstance(prefix);
  }
}

// ============================================================================
// 범용 캐시 매니저 인스턴스들 (지연 초기화)
// ============================================================================

/**
 * 기본 범용 캐시
 */
export const cache = getCacheManager('default');

/**
 * GeoIP 캐시 (범용)
 */
export const geoCache = getCacheManager('geo');
