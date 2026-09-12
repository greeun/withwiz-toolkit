/**
 * InMemoryCacheManager — 용량 경계 동작
 *
 * set() 의 eviction 루프는 캐시가 비어도 needsEviction 이 true 인 경우
 * (단일 항목이 maxMemoryMB 초과, maxSize <= 0) 무한 반복하여 이벤트 루프를
 * 정지시켰다. 이런 항목은 저장을 건너뛰고 정상 종료해야 한다.
 */
import { describe, it, expect, afterEach } from 'vitest';
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
