/**
 * 인증 서비스와 캐시 기반 토큰 저장소 실제 조합 (TC-I-003)
 *
 * LoginService + TokenRefreshService + createCacheRefreshTokenStore /
 * createCacheBlacklistChecker + InMemoryCacheManager 실인스턴스를 조합해
 * refresh 토큰 회전·재사용 탐지·family 무효화 계약을 검증한다.
 * 저장소를 Set 페이크로 대체하지 않는다.
 *
 * 회귀 방지 대상: 같은 refresh 토큰으로 refresh() 를 동시에 호출하면
 * isUsed 확인과 markUsed 기록 사이의 await 때문에 두 호출이 모두 성공하던 결함.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { hashSync } from 'bcryptjs';
import { InMemoryCacheManager } from '../../../src/core/cache/inmemory-cache-manager';
import { LoginService } from '../../../src/core/auth/services/login.service';
import { TokenRefreshService } from '../../../src/core/auth/services/token-refresh.service';
import {
  createCacheBlacklistChecker,
  createCacheRefreshTokenStore,
  type TokenStoreCache,
} from '../../../src/core/auth/services/cache-token-stores';
import type { IRefreshTokenStore } from '../../../src/core/auth/services/refresh-token-store';
import { JWTService } from '../../../src/core/auth/jwt';
import { AuthError } from '../../../src/core/auth/errors';
import type { BaseUser, UserRepository } from '../../../src/core/auth/types';

const JWT_SECRET = 'a'.repeat(32);
const EMAIL = 'user-1@example.com';
const PASSWORD = 'correct horse battery staple';
const STORED_HASH = hashSync(PASSWORD, 4);

function makeUserRepository(): UserRepository {
  const users = new Map<string, BaseUser>([
    ['user-1', { id: 'user-1', email: EMAIL, role: 'USER', isActive: true, emailVerified: new Date() }],
  ]);
  return {
    findById: async (id) => users.get(id) ?? null,
    findByEmail: async (email) => [...users.values()].find((u) => u.email === email) ?? null,
    create: async () => { throw new Error('unused'); },
    update: async () => { throw new Error('unused'); },
    delete: async () => {},
    updateLastLoginAt: async () => {},
    verifyEmail: async () => {},
  };
}

/** AuthError 의 code 를 꺼낸다. AuthError 가 아니면 원본을 다시 던진다. */
async function authErrorCode(promise: Promise<unknown>): Promise<{ code: string; statusCode: number }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AuthError) return { code: error.code, statusCode: error.statusCode };
    throw error;
  }
  throw new Error('expected AuthError but promise resolved');
}

describe('TC-I-003: 인증 서비스와 캐시 기반 토큰 저장소 실제 조합', () => {
  let cache: InMemoryCacheManager;
  let store: IRefreshTokenStore;
  let userRepository: UserRepository;
  let login: LoginService;
  let refreshService: TokenRefreshService;
  const jwt = new JWTService({ secret: JWT_SECRET, accessTokenExpiry: '15m', refreshTokenExpiry: '30d', algorithm: 'HS256' });

  beforeEach(() => {
    cache = new InMemoryCacheManager('it-auth');
    store = createCacheRefreshTokenStore(cache);
    userRepository = makeUserRepository();
    login = new LoginService({ userRepository, jwtSecret: JWT_SECRET });
    refreshService = new TokenRefreshService({ userRepository, jwtSecret: JWT_SECRET, refreshTokenStore: store });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('로그인 refresh 토큰은 jti·familyId 를 가진다', async () => {
    const { tokens } = await login.login(EMAIL, PASSWORD, STORED_HASH);
    const payload = await jwt.verifyRefreshToken(tokens.refreshToken);

    expect(payload.userId).toBe('user-1');
    expect(payload.jti).toEqual(expect.any(String));
    expect(payload.familyId).toEqual(expect.any(String));
  });

  it('회전: 새 refresh 토큰은 같은 family 이고 구 jti 는 사용됨으로 기록된다', async () => {
    const { tokens } = await login.login(EMAIL, PASSWORD, STORED_HASH);
    const before = await jwt.verifyRefreshToken(tokens.refreshToken);

    const rotated = await refreshService.refresh(tokens.refreshToken);
    const after = await jwt.verifyRefreshToken(rotated.refreshToken!);

    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);
    expect(after.familyId).toBe(before.familyId);
    expect(after.jti).not.toBe(before.jti);
    expect(await store.isUsed(before.jti!)).toBe(true);
  });

  it('재사용: 회전된 토큰 재제출은 TOKEN_REUSE_DETECTED 이고 family 가 무효화된다', async () => {
    const { tokens } = await login.login(EMAIL, PASSWORD, STORED_HASH);
    const { familyId } = await jwt.verifyRefreshToken(tokens.refreshToken);
    const rotated = await refreshService.refresh(tokens.refreshToken);

    expect(await authErrorCode(refreshService.refresh(tokens.refreshToken))).toEqual({
      code: 'TOKEN_REUSE_DETECTED',
      statusCode: 401,
    });
    expect(await store.isFamilyRevoked(familyId!)).toBe(true);
    expect((await authErrorCode(refreshService.refresh(rotated.refreshToken!))).code).toBe('TOKEN_REVOKED');
  });

  it('로그아웃: revokeByToken 후 그 토큰으로 갱신하면 TOKEN_REVOKED', async () => {
    const { tokens } = await login.login(EMAIL, PASSWORD, STORED_HASH);

    await refreshService.revokeByToken(tokens.refreshToken);

    expect((await authErrorCode(refreshService.refresh(tokens.refreshToken))).code).toBe('TOKEN_REVOKED');
  });

  it('access 토큰 blacklist: revoke 후 조회가 true 이고 캐시 키에 원문 토큰이 없다', async () => {
    const { tokens } = await login.login(EMAIL, PASSWORD, STORED_HASH);
    const keys: string[] = [];
    const recordingCache: TokenStoreCache = {
      set: async (key, value, ttl) => { keys.push(key); await cache.set(key, value, ttl); },
      delete: (key) => cache.delete(key),
      exists: (key) => cache.exists(key),
    };
    const blacklist = createCacheBlacklistChecker(recordingCache);

    await blacklist.revokeAccessToken(tokens.accessToken, 60);

    expect(await blacklist.isAccessTokenRevoked(tokens.accessToken)).toBe(true);
    expect(keys).toEqual([`revoked:at:${createHash('sha256').update(tokens.accessToken).digest('hex')}`]);
    expect(keys[0]).not.toContain(tokens.accessToken);
  });

  describe('동시 갱신 경쟁', () => {
    it('같은 refresh 토큰으로 동시에 두 번 갱신하면 하나만 성공하고 나머지는 재사용으로 거부된다', async () => {
      const { tokens } = await login.login(EMAIL, PASSWORD, STORED_HASH);
      const { familyId } = await jwt.verifyRefreshToken(tokens.refreshToken);

      const results = await Promise.allSettled([
        refreshService.refresh(tokens.refreshToken),
        refreshService.refresh(tokens.refreshToken),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(AuthError);
      expect((rejected[0].reason as AuthError).code).toBe('TOKEN_REUSE_DETECTED');

      // 재사용으로 판정되었으므로 family 전체가 무효화되어 승자의 새 토큰도 쓸 수 없다.
      expect(await store.isFamilyRevoked(familyId!)).toBe(true);
      const winner = (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<TokenRefreshService['refresh']>>>).value;
      expect((await authErrorCode(refreshService.refresh(winner.refreshToken!))).code).toBe('TOKEN_REVOKED');
    });

    it('같은 저장소를 공유하는 서비스 인스턴스 둘이 동시에 갱신해도 하나만 성공한다', async () => {
      const otherService = new TokenRefreshService({ userRepository, jwtSecret: JWT_SECRET, refreshTokenStore: store });
      const { tokens } = await login.login(EMAIL, PASSWORD, STORED_HASH);

      const results = await Promise.allSettled([
        refreshService.refresh(tokens.refreshToken),
        otherService.refresh(tokens.refreshToken),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });

    it('동시 갱신 5건 중 정확히 1건만 새 토큰을 받는다', async () => {
      const { tokens } = await login.login(EMAIL, PASSWORD, STORED_HASH);

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => refreshService.refresh(tokens.refreshToken)),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const r of results) {
        if (r.status === 'rejected') expect((r.reason as AuthError).code).toBe('TOKEN_REUSE_DETECTED');
      }
    });
  });
});
