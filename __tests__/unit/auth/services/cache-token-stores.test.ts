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

  it('IRefreshTokenStore 계약(4개 필수 메서드)을 만족한다', async () => {
    const store = createCacheRefreshTokenStore(makeCache('rt5'));
    expect(typeof store.isUsed).toBe('function');
    expect(typeof store.markUsed).toBe('function');
    expect(typeof store.isFamilyRevoked).toBe('function');
    expect(typeof store.revokeFamily).toBe('function');
  });
});
