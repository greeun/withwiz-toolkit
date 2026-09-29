/**
 * InMemoryCacheManager — 용량 경계 동작
 *
 * set() 의 eviction 루프는 캐시가 비어도 needsEviction 이 true 인 경우
 * (단일 항목이 maxMemoryMB 초과, maxSize <= 0) 무한 반복하여 이벤트 루프를
 * 정지시켰다. 이런 항목은 저장을 건너뛰고 정상 종료해야 한다.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { InMemoryCacheManager } from '@withwiz/toolkit/core/cache/inmemory-cache-manager';

const baseConfig = { evictionPolicy: 'lru' as const, cleanupInterval: 999_999_999, defaultTTL: 3600 };

describe('InMemoryCacheManager capacity guards', () => {
  afterEach(() => {
    InMemoryCacheManager.destroyAll();
  });

  it('단일 항목이 maxMemoryMB 를 초과하면 저장을 건너뛰고 즉시 반환한다 (무한 루프 방지)', async () => {
    // maxMemoryMB 0.001 → 약 1048 bytes. estimateSize = json*2 + 100 이므로 2KB 문자열은 초과.
    const cache = new InMemoryCacheManager('cap-test', { ...baseConfig, maxSize: 100, maxMemoryMB: 0.001 });
    await cache.set('small', 'ok');
    const big = 'x'.repeat(2048);

    await expect(
      Promise.race([
        cache.set('big', big),
        new Promise((_, reject) => setTimeout(() => reject(new Error('set() did not return')), 2000)),
      ]),
    ).resolves.toBeUndefined();

    expect(await cache.get('big')).toBeNull();
    // 기존 항목은 불필요하게 제거되지 않는다
    expect(await cache.get('small')).toBe('ok');
  });

  it('maxSize 가 0 이면 저장을 건너뛰고 즉시 반환한다', async () => {
    const cache = new InMemoryCacheManager('zero-size', { ...baseConfig, maxSize: 0, maxMemoryMB: 10 });
    await expect(
      Promise.race([
        cache.set('k', 'v'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('set() did not return')), 2000)),
      ]),
    ).resolves.toBeUndefined();
    expect(await cache.get('k')).toBeNull();
  });

  it('상한 이내 항목은 정상 저장되고 초과 항목 이후에도 캐시는 계속 동작한다', async () => {
    const cache = new InMemoryCacheManager('mixed', { ...baseConfig, maxSize: 2, maxMemoryMB: 0.001 });
    await cache.set('a', 'x'.repeat(2048));
    await cache.set('b', 'v1');
    await cache.set('c', 'v2');
    await cache.set('d', 'v3'); // maxSize 2 → LRU eviction 으로 b 제거
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
    expect(await cache.get('c')).toBe('v2');
    expect(await cache.get('d')).toBe('v3');
  });
});

/**
 * InMemoryCacheManager.setIfNotExists — 한 프로세스 안의 원자적 "없을 때만 저장"
 *
 * 저장했으면 true, 만료되지 않은 키가 이미 있으면 false. 존재 확인과 저장 사이에
 * await 가 없어야 같은 키의 동시 호출 중 정확히 1건만 true 가 된다.
 */
describe('InMemoryCacheManager.setIfNotExists', () => {
  afterEach(() => {
    vi.useRealTimers();
    InMemoryCacheManager.destroyAll();
  });

  it('키가 없으면 저장하고 true, 이미 있으면 기존 값을 유지하고 false 를 반환한다', async () => {
    const cache = new InMemoryCacheManager('sinx-basic', baseConfig);

    await expect(cache.setIfNotExists('k', 'first', 60)).resolves.toBe(true);
    await expect(cache.setIfNotExists('k', 'second', 60)).resolves.toBe(false);
    expect(await cache.get('k')).toBe('first');
  });

  it('set 으로 이미 저장된 키에도 false 를 반환한다', async () => {
    const cache = new InMemoryCacheManager('sinx-existing', baseConfig);
    await cache.set('k', 'v', 60);

    await expect(cache.setIfNotExists('k', 'other', 60)).resolves.toBe(false);
    expect(await cache.get('k')).toBe('v');
  });

  it('같은 키에 동시 10건을 호출하면 true 는 정확히 1건이다', async () => {
    const cache = new InMemoryCacheManager('sinx-race', baseConfig);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => cache.setIfNotExists('race', i, 60)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await cache.get('race')).toBe(results.indexOf(true));
  });

  it('TTL(초)이 지나 만료된 키는 없는 것으로 보고 다시 true 를 반환한다', async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCacheManager('sinx-ttl', baseConfig);

    await expect(cache.setIfNotExists('k', 1, 10)).resolves.toBe(true);
    vi.advanceTimersByTime(9_000);
    await expect(cache.setIfNotExists('k', 2, 10)).resolves.toBe(false);
    vi.advanceTimersByTime(2_000);
    await expect(cache.setIfNotExists('k', 3, 10)).resolves.toBe(true);
    expect(await cache.get('k')).toBe(3);
  });

  it('ttl 을 생략하면 set 과 같이 defaultTTL 을 쓴다', async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCacheManager('sinx-default-ttl', { ...baseConfig, defaultTTL: 5 });

    await expect(cache.setIfNotExists('k', 'v')).resolves.toBe(true);
    vi.advanceTimersByTime(4_000);
    expect(await cache.exists('k')).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(await cache.exists('k')).toBe(false);
  });

  it('prefix 가 다른 매니저의 같은 키는 서로 막지 않는다', async () => {
    const a = new InMemoryCacheManager('sinx-a', baseConfig);
    const b = new InMemoryCacheManager('sinx-b', baseConfig);

    await expect(a.setIfNotExists('k', 1, 60)).resolves.toBe(true);
    await expect(b.setIfNotExists('k', 1, 60)).resolves.toBe(true);
  });
});
