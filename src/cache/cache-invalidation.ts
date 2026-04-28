/**
 * Cache Invalidation - 범용 캐시 무효화 유틸리티
 *
 * 프로젝트에 독립적인 범용 캐시 무효화 헬퍼 함수들입니다.
 * 도메인 특화 캐시 무효화는 소비 프로젝트의 extension 영역에서 정의하세요.
 */
import { cache, geoCache } from "./cache-factory";
import type {
  RedisCacheManager,
  HybridCacheManager,
  InMemoryCacheManager,
  NoopCacheManager,
} from "./index";

type CacheManager =
  | RedisCacheManager
  | HybridCacheManager
  | InMemoryCacheManager
  | NoopCacheManager;

// ============================================================================
// 범용 캐시 무효화 유틸리티
// ============================================================================

/**
 * 범용 캐시 무효화 헬퍼 함수들
 *
 * @example
 * ```typescript
 * import { invalidateCache } from '@withwiz/cache';
 *
 * // 기본 캐시에서 단일 키 삭제
 * await invalidateCache.byKey('my-key');
 *
 * // 기본 캐시에서 패턴으로 삭제
 * await invalidateCache.byPattern('user:*');
 *
 * // 모든 캐시 삭제
 * await invalidateCache.all();
 * ```
 */
export const invalidateCache = {
  /**
   * 기본 캐시에서 단일 키 삭제
   * @param key - 삭제할 캐시 키
   */
  byKey: async (key: string): Promise<void> => {
    await cache.delete(key);
  },

  /**
   * 기본 캐시에서 패턴으로 삭제
   * @param pattern - 삭제할 캐시 키 패턴 (예: "user:*")
   */
  byPattern: async (pattern: string): Promise<void> => {
    await cache.deletePattern(pattern);
  },

  /**
   * GeoIP 캐시에서 단일 키 삭제
   * @param key - 삭제할 캐시 키
   */
  geoByKey: async (key: string): Promise<void> => {
    await geoCache.delete(key);
  },

  /**
   * GeoIP 캐시에서 패턴으로 삭제
   * @param pattern - 삭제할 캐시 키 패턴
   */
  geoByPattern: async (pattern: string): Promise<void> => {
    await geoCache.deletePattern(pattern);
  },

  /**
   * 기본 캐시 전체 삭제
   */
  all: async (): Promise<void> => {
    await cache.deletePattern("*");
  },

  /**
   * GeoIP 캐시 전체 삭제
   */
  allGeo: async (): Promise<void> => {
    await geoCache.deletePattern("*");
  },
};

// ============================================================================
// 캐시 매니저 유틸리티 함수들 (프로젝트에서 직접 사용)
// ============================================================================

/**
 * 주어진 캐시 매니저에서 키 삭제
 *
 * @example
 * ```typescript
 * import { getCacheManager } from '@withwiz/cache';
 * import { deleteFromCache } from '@withwiz/cache/cache-invalidation';
 *
 * const myCache = getCacheManager('my-prefix');
 * await deleteFromCache(myCache, 'my-key');
 * ```
 */
export async function deleteFromCache(
  cacheManager: CacheManager,
  key: string,
): Promise<void> {
  await cacheManager.delete(key);
}

/**
 * 주어진 캐시 매니저에서 패턴으로 삭제
 *
 * @example
 * ```typescript
 * import { getCacheManager } from '@withwiz/cache';
 * import { deletePatternFromCache } from '@withwiz/cache/cache-invalidation';
 *
 * const myCache = getCacheManager('my-prefix');
 * await deletePatternFromCache(myCache, 'user:*');
 * ```
 */
export async function deletePatternFromCache(
  cacheManager: CacheManager,
  pattern: string,
): Promise<void> {
  await cacheManager.deletePattern(pattern);
}

/**
 * 여러 캐시 매니저에서 동시에 패턴 삭제
 *
 * @example
 * ```typescript
 * import { getCacheManager } from '@withwiz/cache';
 * import { deletePatternFromMultipleCaches } from '@withwiz/cache/cache-invalidation';
 *
 * const cache1 = getCacheManager('prefix1');
 * const cache2 = getCacheManager('prefix2');
 * await deletePatternFromMultipleCaches([cache1, cache2], 'user:*');
 * ```
 */
export async function deletePatternFromMultipleCaches(
  cacheManagers: CacheManager[],
  pattern: string,
): Promise<void> {
  await Promise.all(cacheManagers.map((cm) => cm.deletePattern(pattern)));
}
