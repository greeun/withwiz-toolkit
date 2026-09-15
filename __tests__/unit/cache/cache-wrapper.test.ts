/**
 * withCache 래퍼와 캐시 무효화 헬퍼 테스트 (TC-U-029)
 *
 * 회귀 방지 대상: 캐시 미스 경로에서 fetch 또는 set 이 실패하면 catch 블록이
 * 원본 함수를 한 번 더 실행해, 부수 효과가 있는 fetch 가 두 번 실행되던 결함.
 * 원본 함수는 호출당 최대 한 번만 실행되어야 한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const manager = { get: vi.fn(), set: vi.fn() };
  return {
    manager,
    getCacheManager: vi.fn(() => manager),
    getEffectiveCacheBackend: vi.fn(() => 'memory'),
    isCacheEnabled: vi.fn(() => true),
    defaultCache: { delete: vi.fn(), deletePattern: vi.fn() },
    geoCache: { delete: vi.fn(), deletePattern: vi.fn() },
  };
});

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@withwiz/toolkit/core/cache/cache-factory', () => ({
  getCacheManager: h.getCacheManager,
  getEffectiveCacheBackend: h.getEffectiveCacheBackend,
  cache: h.defaultCache,
  geoCache: h.geoCache,
}));

vi.mock('@withwiz/toolkit/core/cache/cache-env', () => ({
  isCacheEnabled: h.isCacheEnabled,
}));

vi.mock('@withwiz/toolkit/core/cache/cache-config', () => ({
  getCacheConfig: {},
  getCacheTTL: { default: () => 600 },
}));

import { withCache, getCacheBackendLabel } from '@withwiz/toolkit/core/cache/cache-wrapper';
import {
  invalidateCache,
  deleteFromCache,
  deletePatternFromCache,
  deletePatternFromMultipleCaches,
} from '@withwiz/toolkit/core/cache/cache-invalidation';
import { logger } from '@withwiz/toolkit/core/logger/logger';

beforeEach(() => {
  vi.clearAllMocks();
  h.manager.get.mockResolvedValue(null);
  h.manager.set.mockResolvedValue(undefined);
  h.getEffectiveCacheBackend.mockReturnValue('memory');
  h.isCacheEnabled.mockReturnValue(true);
});

describe('withCache: 정상 경로', () => {
  it('캐시 미스이면 접두사 매니저에서 조회하고 fetch 1회 후 저장한다', async () => {
    const fetch = vi.fn().mockResolvedValue({ id: 1 });

    const result = await withCache('community:recent', fetch);

    expect(result).toEqual({ id: 1 });
    expect(h.getCacheManager).toHaveBeenCalledWith('community');
    expect(h.manager.get).toHaveBeenCalledWith('recent');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(h.manager.set).toHaveBeenCalledWith('recent', { id: 1 }, 600);
  });

  it('캐시 적중이면 fetch 를 실행하지 않고 캐시 값을 반환한다', async () => {
    h.manager.get.mockResolvedValue('cached');
    const fetch = vi.fn().mockResolvedValue('fresh');

    await expect(withCache('community:recent', fetch)).resolves.toBe('cached');
    expect(fetch).not.toHaveBeenCalled();
    expect(h.manager.set).not.toHaveBeenCalled();
  });

  it('null 결과는 래퍼로 저장하고, 적중 시 fetch 없이 null 을 반환한다', async () => {
    const fetch = vi.fn().mockResolvedValue(null);

    await expect(withCache('k', fetch, { ttl: 5 })).resolves.toBeNull();
    expect(h.manager.set).toHaveBeenCalledWith('k', { __nullValue__: true }, 5);

    h.manager.get.mockResolvedValue({ __nullValue__: true });
    await expect(withCache('k', fetch, { ttl: 5 })).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('접두사가 없는 키는 default 매니저를 사용한다', async () => {
    await withCache('plain', vi.fn().mockResolvedValue(1));

    expect(h.getCacheManager).toHaveBeenCalledWith('default');
    expect(h.manager.get).toHaveBeenCalledWith('plain');
  });

  it('options.prefix 가 있으면 그 접두사 매니저와 원래 키를 사용한다', async () => {
    await withCache('recent-links:1:10', vi.fn().mockResolvedValue(1), { prefix: 'community' });

    expect(h.getCacheManager).toHaveBeenCalledWith('community');
    expect(h.manager.get).toHaveBeenCalledWith('recent-links:1:10');
  });

  it('전역 캐시가 비활성이면 매니저 없이 fetch 만 1회 실행한다', async () => {
    h.isCacheEnabled.mockReturnValue(false);
    const fetch = vi.fn().mockResolvedValue('v');

    await expect(withCache('community:recent', fetch)).resolves.toBe('v');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(h.getCacheManager).not.toHaveBeenCalled();
  });
});

describe('withCache: 실패 경로에서 원본 함수는 한 번만 실행된다', () => {
  it('fetch 가 throw 하면 fetch 1회 후 같은 오류로 reject 한다', async () => {
    const failure = new Error('db down');
    const fetch = vi.fn().mockRejectedValue(failure);

    await expect(withCache('community:recent', fetch)).rejects.toBe(failure);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(h.manager.set).not.toHaveBeenCalled();
  });

  it('첫 실행만 실패하는 fetch 도 재실행하지 않는다 (부수 효과 중복 방지)', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('first call failed'))
      .mockResolvedValueOnce('second call value');

    await expect(withCache('community:recent', fetch)).rejects.toThrow('first call failed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetch 성공 후 set 이 throw 하면 fetch 1회 결과를 반환한다', async () => {
    h.manager.set.mockRejectedValue(new Error('cache write failed'));
    const fetch = vi.fn().mockResolvedValueOnce('fresh').mockResolvedValueOnce('refetched');

    await expect(withCache('community:recent', fetch)).resolves.toBe('fresh');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('저장 로그용 직렬화가 실패해도 fetch 1회 결과를 반환한다', async () => {
    const value = { big: BigInt(1) };
    const fetch = vi.fn().mockResolvedValueOnce(value).mockResolvedValueOnce({ big: BigInt(2) });

    await expect(withCache('community:recent', fetch)).resolves.toBe(value);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('캐시 조회(get)가 throw 하면 원본 함수를 1회 실행해 결과를 반환한다 (degrade)', async () => {
    h.manager.get.mockRejectedValue(new Error('redis down'));
    const fetch = vi.fn().mockResolvedValue('fresh');

    await expect(withCache('community:recent', fetch)).resolves.toBe('fresh');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('캐시 조회 실패 후 fetch 도 실패하면 fetch 1회 후 fetch 오류로 reject 한다', async () => {
    h.manager.get.mockRejectedValue(new Error('redis down'));
    const fetch = vi.fn().mockRejectedValue(new Error('db down'));

    await expect(withCache('community:recent', fetch)).rejects.toThrow('db down');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('getCacheBackendLabel', () => {
  it.each([
    ['redis', 'R'],
    ['memory', 'M'],
    ['hybrid', 'H'],
    ['none', 'N'],
  ])('%s → %s', (backend, label) => {
    h.getEffectiveCacheBackend.mockReturnValue(backend);
    expect(getCacheBackendLabel()).toBe(label);
  });
});

describe('캐시 무효화 헬퍼', () => {
  it('deletePatternFromMultipleCaches 는 각 매니저의 deletePattern 을 1회씩 호출한다', async () => {
    const m1 = { deletePattern: vi.fn().mockResolvedValue(undefined) };
    const m2 = { deletePattern: vi.fn().mockResolvedValue(undefined) };

    await deletePatternFromMultipleCaches([m1, m2] as never, 'user:*');

    expect(m1.deletePattern).toHaveBeenCalledWith('user:*');
    expect(m2.deletePattern).toHaveBeenCalledWith('user:*');
  });

  it('deleteFromCache·deletePatternFromCache 는 주어진 매니저에 위임한다', async () => {
    const m = { delete: vi.fn(), deletePattern: vi.fn() };

    await deleteFromCache(m as never, 'abc');
    await deletePatternFromCache(m as never, 'user:*');

    expect(m.delete).toHaveBeenCalledWith('abc');
    expect(m.deletePattern).toHaveBeenCalledWith('user:*');
  });

  it('invalidateCache 는 기본 캐시와 GeoIP 캐시 상수에 위임한다', async () => {
    await invalidateCache.byKey('k');
    await invalidateCache.byPattern('user:*');
    await invalidateCache.all();
    await invalidateCache.geoByKey('ip');
    await invalidateCache.allGeo();

    expect(h.defaultCache.delete).toHaveBeenCalledWith('k');
    expect(h.defaultCache.deletePattern).toHaveBeenCalledWith('user:*');
    expect(h.defaultCache.deletePattern).toHaveBeenCalledWith('*');
    expect(h.geoCache.delete).toHaveBeenCalledWith('ip');
    expect(h.geoCache.deletePattern).toHaveBeenCalledWith('*');
  });
});
