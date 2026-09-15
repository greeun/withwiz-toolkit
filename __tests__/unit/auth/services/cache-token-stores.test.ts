/**
 * Unit Tests: Cache 기반 토큰 store (C-3)
 *
 * createCacheBlacklistChecker(access revoke) /
 * createCacheRefreshTokenStore(회전·재사용탐지·family revoke) 를
 * 실제 InMemoryCacheManager 로 round-trip 검증한다.
 */
import { InMemoryCacheManager } from '@withwiz/toolkit/core/cache/inmemory-cache-manager';
import {
  createCacheBlacklistChecker,
  createCacheRefreshTokenStore,
} from '@withwiz/toolkit/core/auth/services/cache-token-stores';

const makeCache = (prefix: string) => new InMemoryCacheManager(prefix);

describe('createCacheBlacklistChecker (access revoke)', () => {
  beforeEach(() => InMemoryCacheManager.clearInstances());

  it('revoke 하지 않은 토큰은 미revoke 로 본다', async () => {
    const bl = createCacheBlacklistChecker(makeCache('bl1'));
    expect(await bl.isAccessTokenRevoked('tok-a')).toBe(false);
  });

  it('revokeAccessToken 후 isAccessTokenRevoked 가 true (다른 토큰은 무영향)', async () => {
    const bl = createCacheBlacklistChecker(makeCache('bl2'));
    await bl.revokeAccessToken('tok-a', 3600);
    expect(await bl.isAccessTokenRevoked('tok-a')).toBe(true);
    expect(await bl.isAccessTokenRevoked('tok-b')).toBe(false);
  });

  it('원문 토큰을 키로 저장하지 않는다 (sha256 식별자)', async () => {
    const seen: string[] = [];
    const spyCache = {
      set: async (k: string) => {
        seen.push(k);
      },
      delete: async () => {},
      exists: async () => false,
    };
    const bl = createCacheBlacklistChecker(spyCache);
    await bl.revokeAccessToken('super-secret-token', 60);
    expect(seen[0]).not.toContain('super-secret-token');
    expect(seen[0]).toMatch(/^revoked:at:[0-9a-f]{64}$/);
  });

  it('ttlSec 이 0 이하여도 최소 TTL 로 저장된다 (즉시 만료 방지)', async () => {
    const bl = createCacheBlacklistChecker(makeCache('bl-ttl0'));
    await bl.revokeAccessToken('tok-a', 0);
    expect(await bl.isAccessTokenRevoked('tok-a')).toBe(true);
  });

  it('TTL 만료 후에는 미revoke (초 단위 정렬)', async () => {
    vi.useFakeTimers();
    try {
      const bl = createCacheBlacklistChecker(makeCache('bl3'));
      await bl.revokeAccessToken('tok-a', 10);
      expect(await bl.isAccessTokenRevoked('tok-a')).toBe(true);
      vi.advanceTimersByTime(11_000);
      expect(await bl.isAccessTokenRevoked('tok-a')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('커스텀 prefix 를 키에 반영한다', async () => {
    const seen: string[] = [];
    const spyCache = {
      set: async (k: string) => {
        seen.push(k);
      },
      delete: async () => {},
      exists: async () => false,
    };
    const bl = createCacheBlacklistChecker(spyCache, { prefix: 'blk:' });
    await bl.revokeAccessToken('tok-a', 60);
    expect(seen[0]).toMatch(/^blk:[0-9a-f]{64}$/);
  });
});

describe('createCacheRefreshTokenStore (rotation/reuse/family)', () => {
  beforeEach(() => InMemoryCacheManager.clearInstances());

  it('markUsed 전에는 미사용, 후에는 사용됨 (재사용 탐지)', async () => {
    const store = createCacheRefreshTokenStore(makeCache('rt1'));
    expect(await store.isUsed('jti-1')).toBe(false);
    await store.markUsed('jti-1', { familyId: 'fam-1', userId: 'u1' });
    expect(await store.isUsed('jti-1')).toBe(true);
    expect(await store.isUsed('jti-2')).toBe(false);
  });

  it('revokeFamily 후 isFamilyRevoked true (로그아웃/탈취 대응)', async () => {
    const store = createCacheRefreshTokenStore(makeCache('rt2'));
    expect(await store.isFamilyRevoked('fam-1')).toBe(false);
    await store.revokeFamily('fam-1');
    expect(await store.isFamilyRevoked('fam-1')).toBe(true);
    expect(await store.isFamilyRevoked('fam-2')).toBe(false);
  });

  it('markUsed TTL 은 meta.expiresAt 잔여시간에 정렬', async () => {
    vi.useFakeTimers();
    try {
      const store = createCacheRefreshTokenStore(makeCache('rt3'));
      const expiresAt = new Date(Date.now() + 5_000);
      await store.markUsed('jti-x', { familyId: 'f', userId: 'u', expiresAt });
      expect(await store.isUsed('jti-x')).toBe(true);
      vi.advanceTimersByTime(6_000);
      expect(await store.isUsed('jti-x')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('register 는 used 키공간과 분리되어 isUsed 를 오염시키지 않는다', async () => {
    const store = createCacheRefreshTokenStore(makeCache('rt4'));
    await store.register!({ jti: 'jti-9', familyId: 'f', userId: 'u' });
    expect(await store.isUsed('jti-9')).toBe(false);
  });

  describe('markUsedIfUnused (원자적 사용 표시)', () => {
    it('처음 표시하면 true, 이미 사용된 jti 는 false 를 반환한다', async () => {
      const store = createCacheRefreshTokenStore(makeCache('rt-claim1'));

      expect(await store.markUsedIfUnused!('jti-1', { familyId: 'f', userId: 'u' })).toBe(true);
      expect(await store.isUsed('jti-1')).toBe(true);
      expect(await store.markUsedIfUnused!('jti-1', { familyId: 'f', userId: 'u' })).toBe(false);
    });

    it('markUsed 로 이미 기록된 jti 도 false 를 반환한다', async () => {
      const store = createCacheRefreshTokenStore(makeCache('rt-claim2'));
      await store.markUsed('jti-1', { familyId: 'f', userId: 'u' });

      expect(await store.markUsedIfUnused!('jti-1', { familyId: 'f', userId: 'u' })).toBe(false);
    });

    it('원자 연산이 없는 캐시에서도 같은 jti 동시 호출 10건 중 1건만 true 이다', async () => {
      const store = createCacheRefreshTokenStore(makeCache('rt-claim3'));

      const results = await Promise.all(
        Array.from({ length: 10 }, () => store.markUsedIfUnused!('jti-race', { familyId: 'f', userId: 'u' })),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('서로 다른 jti 는 서로를 막지 않는다', async () => {
      const store = createCacheRefreshTokenStore(makeCache('rt-claim4'));

      const results = await Promise.all([
        store.markUsedIfUnused!('jti-a', { familyId: 'f', userId: 'u' }),
        store.markUsedIfUnused!('jti-b', { familyId: 'f', userId: 'u' }),
      ]);

      expect(results).toEqual([true, true]);
    });

    it('캐시가 setIfNotExists 를 제공하면 그 결과를 사용하고 exists·set 을 호출하지 않는다', async () => {
      const calls: Array<[string, unknown, number | undefined]> = [];
      const atomicCache = {
        set: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
        exists: vi.fn(async () => false),
        setIfNotExists: vi.fn(async (key: string, value: unknown, ttl?: number) => {
          calls.push([key, value, ttl]);
          return calls.length === 1;
        }),
      };
      const storeA = createCacheRefreshTokenStore(atomicCache, { defaultTtlSec: 120 });
      const storeB = createCacheRefreshTokenStore(atomicCache, { defaultTtlSec: 120 });

      expect(await storeA.markUsedIfUnused!('jti-1', { familyId: 'f', userId: 'u' })).toBe(true);
      expect(await storeB.markUsedIfUnused!('jti-1', { familyId: 'f', userId: 'u' })).toBe(false);
      expect(calls[0]).toEqual(['rt:used:jti-1', 1, 120]);
      expect(atomicCache.exists).not.toHaveBeenCalled();
      expect(atomicCache.set).not.toHaveBeenCalled();
    });

    it('TTL 은 meta.expiresAt 잔여시간에 정렬된다', async () => {
      vi.useFakeTimers();
      try {
        const store = createCacheRefreshTokenStore(makeCache('rt-claim5'));
        const expiresAt = new Date(Date.now() + 5_000);

        expect(await store.markUsedIfUnused!('jti-x', { familyId: 'f', userId: 'u', expiresAt })).toBe(true);
        vi.advanceTimersByTime(6_000);
        expect(await store.isUsed('jti-x')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('기록 중 캐시 오류가 나면 reject 하고, 다음 호출은 대기 없이 다시 시도한다', async () => {
      const inner = makeCache('rt-claim6');
      let failNextSet = true;
      const flakyCache = {
        set: async <T,>(key: string, value: T, ttl?: number) => {
          if (failNextSet) {
            failNextSet = false;
            throw new Error('cache down');
          }
          await inner.set(key, value, ttl);
        },
        delete: (key: string) => inner.delete(key),
        exists: (key: string) => inner.exists(key),
      };
      const store = createCacheRefreshTokenStore(flakyCache);

      await expect(store.markUsedIfUnused!('jti-1', { familyId: 'f', userId: 'u' })).rejects.toThrow('cache down');
      expect(await store.markUsedIfUnused!('jti-1', { familyId: 'f', userId: 'u' })).toBe(true);
    });
  });

  it('IRefreshTokenStore 계약(4개 필수 메서드)을 만족한다', async () => {
    const store = createCacheRefreshTokenStore(makeCache('rt5'));
    expect(typeof store.isUsed).toBe('function');
    expect(typeof store.markUsed).toBe('function');
    expect(typeof store.isFamilyRevoked).toBe('function');
    expect(typeof store.revokeFamily).toBe('function');
  });
});
