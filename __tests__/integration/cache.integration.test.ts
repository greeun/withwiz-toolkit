/**
 * 캐시 계층 실제 조합 통합 테스트 (TC-I-002)
 *
 * initializeCache() → cache-env/cache-config → cache-factory → InMemoryCacheManager /
 * HybridCacheManager → withCache() → cache-invalidation 을 실제 모듈로 조합한다.
 * logger(winston 파일 I/O)만 목으로 대체한다.
 *
 * 이전 판은 toolkit 소스를 import 하지 않고 테스트 안의 mockRedis·Map 에 넣은 값을
 * 다시 단언하는 허위 양성이었다. 원래 의도(링크 캐시 저장·TTL·무효화·Redis 장애 시
 * 인메모리 폴백)는 실제 모듈 기준으로 옮겼다.
 *
 * 캐시 설정과 매니저 싱글턴은 globalThis 에 저장되므로 테스트마다 전역 상태를
 * 지우고 모듈을 다시 import 한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CacheConfigInput } from '../../src/core/cache/config';

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

type CacheModules = Awaited<ReturnType<typeof loadCacheModules>>;

async function loadCacheModules(input: CacheConfigInput) {
  const config = await import('@withwiz/toolkit/core/cache/config');
  config.initializeCache(input);
  const [factory, wrapper, invalidation, inmemory, hybrid, noop, redisState] = await Promise.all([
    import('@withwiz/toolkit/core/cache/cache-factory'),
    import('@withwiz/toolkit/core/cache/cache-wrapper'),
    import('@withwiz/toolkit/core/cache/cache-invalidation'),
    import('@withwiz/toolkit/core/cache/inmemory-cache-manager'),
    import('@withwiz/toolkit/core/cache/hybrid-cache-manager'),
    import('@withwiz/toolkit/core/cache/noop-cache-manager'),
    import('@withwiz/toolkit/core/cache/cache-redis'),
  ]);
  return { ...factory, ...wrapper, ...invalidation, ...inmemory, ...hybrid, ...noop, ...redisState };
}

function resetGlobalCacheState(): void {
  delete (globalThis as Record<string, unknown>).__withwiz_config;
  delete (globalThis as Record<string, unknown>).__inMemoryCacheManagerInstances;
  delete (globalThis as Record<string, unknown>).__hybridCacheManagerInstances;
  delete (globalThis as Record<string, unknown>).__globalRedisState;
}

describe('TC-I-002: 캐시 계층 실제 조합', () => {
  let m: CacheModules;

  beforeEach(() => {
    resetGlobalCacheState();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Redis 전역 비활성화가 예약한 재연결 타이머와 인메모리 정리 타이머를 해제한다.
    m?.resetRedisGlobalState();
    m?.InMemoryCacheManager.destroyAll();
    resetGlobalCacheState();
  });

  describe('initializeCache({ enabled: true }) — Redis 미지정, 인메모리 기본 활성', () => {
    beforeEach(async () => {
      m = await loadCacheModules({ enabled: true });
    });

    it('유효 백엔드는 memory 이고 접두사별 InMemoryCacheManager 싱글턴을 반환한다', () => {
      const first = m.getCacheManager('link');

      expect(m.getEffectiveCacheBackend()).toBe('memory');
      expect(first).toBeInstanceOf(m.InMemoryCacheManager);
      expect(m.getCacheManager('link')).toBe(first);
      expect(m.getCacheBackendLabel()).toBe('M');
    });

    it('withCache 를 두 번 호출하면 fetch 는 1회이고 값은 접두사 매니저에 저장된다', async () => {
      const link = { id: '1', shortCode: 'abc', originalUrl: 'https://example.com' };
      const fetch = vi.fn(async () => link);

      await expect(m.withCache('link:abc', fetch)).resolves.toEqual(link);
      await expect(m.withCache('link:abc', fetch)).resolves.toEqual(link);

      expect(fetch).toHaveBeenCalledTimes(1);
      await expect(m.getCacheManager('link').get('abc')).resolves.toEqual(link);
    });

    it('deleteFromCache 로 키를 지우면 다음 withCache 가 fetch 를 다시 실행한다', async () => {
      const fetch = vi.fn(async () => ({ originalUrl: 'https://example.com' }));
      await m.withCache('link:abc', fetch);

      await m.deleteFromCache(m.getCacheManager('link'), 'abc');
      await m.withCache('link:abc', fetch);

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('TTL 이 지나면 만료되어 fetch 를 다시 실행한다', async () => {
      vi.useFakeTimers();
      const fetch = vi.fn(async () => 'data');

      await m.withCache('link:t', fetch, { ttl: 1 });
      vi.advanceTimersByTime(900);
      await m.withCache('link:t', fetch, { ttl: 1 });
      expect(fetch).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(200);
      await m.withCache('link:t', fetch, { ttl: 1 });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('null 결과도 캐시되어 두 번째 호출은 fetch 없이 null 을 반환한다', async () => {
      const fetch = vi.fn(async () => null);

      await expect(m.withCache('link:missing', fetch)).resolves.toBeNull();
      await expect(m.withCache('link:missing', fetch)).resolves.toBeNull();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('초기화 뒤에 import 한 invalidateCache 는 default 캐시 키를 실제로 무효화한다', async () => {
      const fetch = vi.fn(async () => 'hello');
      await m.withCache('greeting', fetch);

      await m.invalidateCache.byKey('greeting');
      await m.withCache('greeting', fetch);

      expect(m.cache).toBe(m.getCacheManager('default'));
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('deletePatternFromMultipleCaches 는 여러 접두사 매니저의 패턴 키를 모두 지운다', async () => {
      await m.withCache('link:user:1', async () => 'l1');
      await m.withCache('geo:user:1', async () => 'g1');
      await m.withCache('link:keep', async () => 'k');

      await m.deletePatternFromMultipleCaches([m.getCacheManager('link'), m.getCacheManager('geo')], 'user:*');

      await expect(m.getCacheManager('link').get('user:1')).resolves.toBeNull();
      await expect(m.getCacheManager('geo').get('user:1')).resolves.toBeNull();
      await expect(m.getCacheManager('link').get('keep')).resolves.toBe('k');
    });
  });

  describe('캐시 비활성 설정', () => {
    it('enabled: false 이면 Noop 매니저를 쓰고 withCache 는 호출마다 fetch 를 실행한다', async () => {
      m = await loadCacheModules({ enabled: false });
      const fetch = vi.fn(async () => 'v');

      await m.withCache('link:abc', fetch);
      await m.withCache('link:abc', fetch);

      expect(m.getCacheManager('link')).toBeInstanceOf(m.NoopCacheManager);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('카테고리 USER 만 비활성이면 user 접두사는 매번 fetch 하고 다른 접두사는 캐시한다', async () => {
      m = await loadCacheModules({ enabled: true, categories: { USER: { enabled: false } } });
      const userFetch = vi.fn(async () => ({ id: 'u1' }));
      const linkFetch = vi.fn(async () => ({ id: 'l1' }));

      await m.withCache('user:u1', userFetch);
      await m.withCache('user:u1', userFetch);
      await m.withCache('link:l1', linkFetch);
      await m.withCache('link:l1', linkFetch);

      expect(userFetch).toHaveBeenCalledTimes(2);
      expect(linkFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('HybridCacheManager — Redis 장애 시 인메모리 폴백', () => {
    function makeFailingRedis() {
      const fail = async () => {
        throw new Error('Redis connection failed');
      };
      return {
        get: vi.fn(fail),
        set: vi.fn(fail),
        delete: vi.fn(fail),
        deletePattern: vi.fn(fail),
        exists: vi.fn(fail),
        increment: vi.fn(fail),
        expire: vi.fn(fail),
        getMetrics: () => ({}),
        getConnectionStatus: () => ({}),
        checkConnection: async () => false,
      };
    }

    it('Redis get 이 실패하면 fallbackOnRedisError 에 따라 인메모리 값을 반환한다', async () => {
      m = await loadCacheModules({ enabled: true, fallback: { redisErrorThresholdGlobal: 100 } });
      const redis = makeFailingRedis();
      const hybrid = new m.HybridCacheManager('link-fallback', {
        backend: 'hybrid',
        redisManager: redis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 100,
      });
      const value = { originalUrl: 'https://example.com' };

      await hybrid.set('abc', value, 60);
      await expect(hybrid.get('abc')).resolves.toEqual(value);

      expect(redis.set).toHaveBeenCalledWith('abc', value, 60);
      expect(redis.get).toHaveBeenCalledWith('abc');
      expect(m.isRedisGloballyDisabled()).toBe(false);
    });

    it('기본 전역 임계값(1)에서는 첫 Redis 오류로 Redis 가 전역 비활성화되고 인메모리만 사용한다', async () => {
      m = await loadCacheModules({ enabled: true });
      const redis = makeFailingRedis();
      const hybrid = new m.HybridCacheManager('link-disabled', {
        backend: 'hybrid',
        redisManager: redis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await hybrid.set('abc', 'v', 60);

      expect(m.isRedisGloballyDisabled()).toBe(true);
      await expect(hybrid.get('abc')).resolves.toBe('v');
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('Redis 가 미스(null)를 반환하면 hybrid 모드는 인메모리에서 조회한다', async () => {
      m = await loadCacheModules({ enabled: true });
      const redis = { ...makeFailingRedis(), get: vi.fn(async () => null), set: vi.fn(async () => {}) };
      const hybrid = new m.HybridCacheManager('link-miss', {
        backend: 'hybrid',
        redisManager: redis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await hybrid.set('abc', 'memory-value', 60);

      await expect(hybrid.get('abc')).resolves.toBe('memory-value');
    });
  });
});
