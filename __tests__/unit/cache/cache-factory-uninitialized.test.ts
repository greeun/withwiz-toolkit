/**
 * Cache Factory — uninitialized import safety (P0-7)
 *
 * 회귀 방지: initializeCache() 를 호출하지 않은 상태로 cache 모듈을
 * import 해도 (1) import-time 에 throw 하지 않고, (2) noop 으로 graceful
 * degrade 하며, (3) 미초기화 사실을 사용 시점에 1회 warn 해야 한다.
 * (4) initializeCache() 보다 먼저 import 한 cache·geoCache 도 초기화 뒤
 * 호출부터는 실제 백엔드를 써야 한다(import 시점에 noop 으로 고정되지 않음).
 * (5) 초기화 전 withCache() 는 예외 없이 원본 함수를 실행하고, 미초기화 경고는
 * 1회만 낸다.
 *
 * 주의: 실제 import-time throw 를 재현해야 하므로 단위 대상인
 * config / cache-env 는 절대 mock 하지 않는다. logger 만 winston(파일 I/O)
 * 인프라이므로 부작용 차단을 위해 mock 한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('cache-factory: uninitialized import', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete (globalThis as any).__withwiz_config;
    vi.resetModules();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete (globalThis as any).__withwiz_config;
  });

  it('does not throw at import time when initializeCache() was never called', async () => {
    await expect(
      import('@withwiz/toolkit/core/cache/cache-factory'),
    ).resolves.toBeDefined();
  });

  it('degrades to a usable no-op cache (get returns null, set is a no-op, no throw)', async () => {
    const mod = await import('@withwiz/toolkit/core/cache/cache-factory');
    expect(mod.cache).toBeDefined();
    expect(mod.geoCache).toBeDefined();
    await expect(mod.cache.get('any-key')).resolves.toBeNull();
    await expect(mod.cache.set('any-key', 'value')).resolves.toBeUndefined();
  });

  it('does not resolve a backend (or warn) at import time', async () => {
    await import('@withwiz/toolkit/core/cache/cache-factory');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns once that cache is not initialized on first use', async () => {
    const mod = await import('@withwiz/toolkit/core/cache/cache-factory');
    await mod.cache.get('a');
    await mod.cache.get('b');
    await mod.geoCache.get('c');
    const cacheWarnings = warnSpy.mock.calls.filter((c: unknown[]) =>
      /not initialized/i.test(String(c[0])),
    );
    expect(cacheWarnings).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
    const combined = warnSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
    expect(combined).toMatch(/cache/i);
    expect(combined).toMatch(/initiali/i);
  });

  it('cache and geoCache imported before initializeCache() use the real backend afterwards', async () => {
    const mod = await import('@withwiz/toolkit/core/cache/cache-factory');
    const { initializeCache } = await import('@withwiz/toolkit/core/cache/config');

    // 초기화 전: noop
    await mod.cache.set('before', 'x');
    await expect(mod.cache.get('before')).resolves.toBeNull();

    initializeCache({ enabled: true, inmemory: { enabled: true } });

    // 초기화 뒤: 같은 상수가 인메모리 백엔드에 저장·조회한다
    await mod.cache.set('after', 'value');
    await expect(mod.cache.get('after')).resolves.toBe('value');
    await mod.geoCache.set('geo-key', { country: 'KR' });
    await expect(mod.geoCache.get('geo-key')).resolves.toEqual({ country: 'KR' });

    // 같은 prefix 의 getCacheManager() 와 저장소를 공유한다
    await expect(mod.getCacheManager('default').get('after')).resolves.toBe('value');
  });

  it('withCache() before initializeCache() runs the original function without throwing', async () => {
    const { withCache } = await import('@withwiz/toolkit/core/cache/cache-wrapper');
    const fetch = vi.fn(async () => 'original');

    await expect(withCache('k', fetch)).resolves.toBe('original');
    await expect(withCache('link:k', fetch, { ttl: 60 })).resolves.toBe('original');

    expect(fetch).toHaveBeenCalledTimes(2);
    const cacheWarnings = warnSpy.mock.calls.filter((c: unknown[]) =>
      /not initialized/i.test(String(c[0])),
    );
    expect(cacheWarnings).toHaveLength(1);
  });

  it('withCache() caches normally once initializeCache() is called', async () => {
    const { withCache } = await import('@withwiz/toolkit/core/cache/cache-wrapper');
    const { initializeCache } = await import('@withwiz/toolkit/core/cache/config');
    initializeCache({ enabled: true, inmemory: { enabled: true } });
    const fetch = vi.fn(async () => 'value');

    await withCache('k', fetch);
    await withCache('k', fetch);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
