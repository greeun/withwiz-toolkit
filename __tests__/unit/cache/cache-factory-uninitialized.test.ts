/**
 * Cache Factory — uninitialized import safety (P0-7)
 *
 * 회귀 방지: initializeCache() 를 호출하지 않은 상태로 cache 모듈을
 * import 해도 (1) import-time 에 throw 하지 않고, (2) noop 으로 graceful
 * degrade 하며, (3) 미초기화 사실을 1회 warn 해야 한다.
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

  it('warns once that cache is not initialized', async () => {
    await import('@withwiz/toolkit/core/cache/cache-factory');
    expect(warnSpy).toHaveBeenCalled();
    const combined = warnSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
    expect(combined).toMatch(/cache/i);
    expect(combined).toMatch(/initiali/i);
  });
});
