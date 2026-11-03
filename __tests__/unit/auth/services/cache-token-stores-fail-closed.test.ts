/**
 * 토큰 store 의 failClosed 옵션
 *
 * 기본값에서는 기존처럼 캐시 오류를 삼켜 "폐기되지 않음"으로 본다. failClosed 를 켜면 폐기 확인에
 * throwOnError 를 전달해 장애 시 예외가 호출자까지 전파된다.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createCacheBlacklistChecker,
  createCacheRefreshTokenStore,
} from '@withwiz/toolkit/core/auth/services/cache-token-stores';

/** Redis 장애 상황의 캐시: throwOnError 일 때만 던지고, 아니면 RedisCacheManager 처럼 false 를 돌려준다. */
const brokenCache = () => ({
  set: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
  exists: vi.fn(async (_key: string, options?: { throwOnError?: boolean }) => {
    if (options?.throwOnError) throw new Error('redis down');
    return false;
  }),
});

describe('createCacheBlacklistChecker failClosed', () => {
  it('기본값은 장애를 폐기되지 않음으로 처리한다', async () => {
    const bl = createCacheBlacklistChecker(brokenCache());
    await expect(bl.isAccessTokenRevoked('t')).resolves.toBe(false);
  });

  it('켜면 장애를 호출자에게 전파한다', async () => {
    const bl = createCacheBlacklistChecker(brokenCache(), { failClosed: true });
    await expect(bl.isAccessTokenRevoked('t')).rejects.toThrow('redis down');
  });
});

describe('createCacheRefreshTokenStore failClosed', () => {
  it('기본값은 isUsed·isFamilyRevoked 장애를 false 로 처리한다', async () => {
    const store = createCacheRefreshTokenStore(brokenCache());
    await expect(store.isUsed('j')).resolves.toBe(false);
    await expect(store.isFamilyRevoked('f')).resolves.toBe(false);
  });

  it('켜면 isUsed·isFamilyRevoked 장애를 전파한다', async () => {
    const store = createCacheRefreshTokenStore(brokenCache(), { failClosed: true });
    await expect(store.isUsed('j')).rejects.toThrow('redis down');
    await expect(store.isFamilyRevoked('f')).rejects.toThrow('redis down');
  });

  it('켜면 setIfNotExists 없는 캐시의 markUsedIfUnused 도 장애를 전파한다', async () => {
    const cache = brokenCache();
    const store = createCacheRefreshTokenStore(cache, { failClosed: true });
    await expect(store.markUsedIfUnused!('j')).rejects.toThrow('redis down');
    expect(cache.set).not.toHaveBeenCalled();
  });
});
