/**
 * JWT Access/Refresh Token Confusion (J-1)
 *
 * 감사(harness Evaluator) High 발견:
 * verifyAccessToken 이 tokenType 을 검증하지 않아, access 용 클레임
 * (userId/email/role)을 가진 비-access 토큰(예: tokenType:'refresh')이
 * access 경로를 통과한다. 또한 createAccessToken 이 tokenType:'access'
 * 를 부여하지 않는다.
 *
 * 계약:
 * - createAccessToken 은 tokenType:'access' 를 부여해야 한다.
 * - verifyAccessToken 은 tokenType 이 명시되고 'access' 가 아니면 거부.
 * - 단, tokenType 부재(레거시 토큰)는 access 로 간주(하위호환 — 업그레이드
 *   시 기존 발급 토큰 대량 무효화 방지).
 */
import { SignJWT, decodeJwt } from 'jose';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { JWTError } from '@withwiz/toolkit/core/auth/errors';
import type { JWTConfig } from '@withwiz/toolkit/core/auth/types';

const testConfig: JWTConfig = {
  secret: 'test-secret-key-that-is-at-least-32-characters-long',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  algorithm: 'HS256',
};

const secretKey = new TextEncoder().encode(testConfig.secret);

describe('J-1: JWT access/refresh token confusion', () => {
  const jwt = new JWTService(testConfig);

  it('createAccessToken stamps tokenType:"access"', async () => {
    const token = await jwt.createAccessToken({
      id: 'u1',
      userId: 'u1',
      email: 'a@example.com',
      role: 'user',
    });
    expect(decodeJwt(token).tokenType).toBe('access');
  });

  it('verifyAccessToken rejects a non-access token that carries access-like claims', async () => {
    // 공격자: 같은 시크릿으로 access 클레임 + tokenType:'refresh' 토큰 위조
    const confusedToken = await new SignJWT({
      id: 'u1',
      userId: 'u1',
      email: 'a@example.com',
      role: 'admin',
      tokenType: 'refresh',
    })
      .setProtectedHeader({ alg: testConfig.algorithm })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secretKey);

    await expect(jwt.verifyAccessToken(confusedToken)).rejects.toThrow(
      JWTError,
    );
  });

  it('verifyAccessToken still accepts legacy tokens with no tokenType (back-compat)', async () => {
    const legacyToken = await new SignJWT({
      id: 'u1',
      userId: 'u1',
      email: 'a@example.com',
      role: 'user',
      // tokenType 의도적으로 부재 (0.7 이전 발급 토큰)
    })
      .setProtectedHeader({ alg: testConfig.algorithm })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secretKey);

    const verified = await jwt.verifyAccessToken(legacyToken);
    expect(verified.userId).toBe('u1');
  });
});
