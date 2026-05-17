/**
 * Microsoft OAuth Provider 단위 테스트
 *
 * - getLoginUrl(): common 테넌트 authorize URL 생성
 * - exchangeCodeForToken(): id_token을 access_token 필드에 담아 반환
 * - getUserInfo(): id_token JWT 디코딩 + iss/aud/exp/oid 검증
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

// 테스트용 RSA 키쌍 — Microsoft JWKS 를 이 키로 모킹한다(네트워크 차단).
const cryptoFixture = vi.hoisted(async () => {
  // 실물 jose 사용 — import('jose') 는 아래 mock 을 트리거해 데드락이 된다.
  const { generateKeyPair } = await vi.importActual<typeof import('jose')>('jose');
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  return { publicKey, privateKey };
});

vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  const { publicKey } = await cryptoFixture;
  return {
    ...actual,
    // createRemoteJWKSet 만 테스트 공개키 리졸버로 대체. 나머지 jose 는 실물.
    createRemoteJWKSet: () => () => publicKey,
  };
});

import { SignJWT } from 'jose';
import { MicrosoftOAuthProvider } from '@withwiz/core/auth/oauth/providers/microsoft';
import { OAuthError } from '@withwiz/core/auth/errors';
import type { OAuthProviderConfig } from '@withwiz/core/auth/types';

/** 테스트 키로 실제 RS256 서명된 Microsoft id_token */
async function signIdToken(claims: Record<string, unknown>): Promise<string> {
  const { privateKey } = await cryptoFixture;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKey);
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function makeIdToken(claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  return `${header}.${payload}.fake-signature`;
}

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600;
const PAST_EXP = Math.floor(Date.now() / 1000) - 3600;

const mockConfig: OAuthProviderConfig = {
  clientId: 'test-ms-app-id',
  clientSecret: 'test-ms-app-secret',
  redirectUri: 'http://localhost:3000/api/auth/callback/microsoft',
};

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('MicrosoftOAuthProvider', () => {
  const provider = new MicrosoftOAuthProvider();

  it('프로바이더 이름이 "microsoft"이어야 한다', () => {
    expect(provider.name).toBe('microsoft');
  });

  describe('getLoginUrl()', () => {
    it('common 테넌트 authorize URL을 생성해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(parsed.searchParams.get('client_id')).toBe('test-ms-app-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/microsoft');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('response_mode')).toBe('query');
      expect(parsed.searchParams.get('scope')).toBe('openid profile email');
    });

    it('state 파라미터가 제공되면 URL에 포함', () => {
      const url = provider.getLoginUrl(mockConfig, 'csrf-ms-state');
      expect(new URL(url).searchParams.get('state')).toBe('csrf-ms-state');
    });

    it('state가 없으면 state 파라미터 미포함', () => {
      const url = provider.getLoginUrl(mockConfig);
      expect(new URL(url).searchParams.has('state')).toBe(false);
    });
  });

  describe('exchangeCodeForToken()', () => {
    it('POST + form-urlencoded로 token 엔드포인트를 호출하고 id_token을 access_token 자리에 반환한다', async () => {
      const validIss = 'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0';
      const idToken = await signIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        oid: 'ms-oid-12345',
        email: 'user@contoso.com',
        email_verified: true,
      });

      const mockTokenResponse = {
        access_token: 'real-ms-access-token-xyz',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await provider.exchangeCodeForToken(mockConfig, 'ms-auth-code');

      // 어댑터의 의도된 동작: id_token 값을 access_token 필드에 담아 반환
      expect(result.access_token).toBe(idToken);

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });

      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-ms-app-id');
      expect(body.get('client_secret')).toBe('test-ms-app-secret');
      expect(body.get('code')).toBe('ms-auth-code');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/microsoft');
      expect(body.get('scope')).toBe('openid profile email');
    });

    it('id_token이 누락된 응답이면 OAuthError(INVALID_RESPONSE)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'only-access', token_type: 'Bearer' }),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'code'),
      ).rejects.toMatchObject({ name: 'OAuthError', message: expect.stringContaining('Missing id_token') });
    });

    it('HTTP 오류 시 OAuthError(TOKEN_EXCHANGE_FAILED)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"invalid_grant"}'),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'bad'),
      ).rejects.toThrow('Microsoft token exchange failed');
    });

    it('응답 본문에 error 필드가 있으면 메시지에 포함하여 OAuthError', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'AADSTS70008: refresh token expired',
        }),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'code'),
      ).rejects.toThrow('invalid_grant - AADSTS70008: refresh token expired');
    });

    it('id_token의 aud가 clientId와 불일치하면 OAuthError(INVALID_RESPONSE)', async () => {
      const badToken = await signIdToken({
        iss: 'https://login.microsoftonline.com/tid/v2.0',
        aud: 'wrong-aud',
        exp: FUTURE_EXP,
        oid: 'x',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id_token: badToken, token_type: 'Bearer' }),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'code'),
      ).rejects.toThrow('Invalid Microsoft id_token');
    });
  });

  describe('getUserInfo()', () => {
    const validIss = 'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0';

    it('정상 claims를 매핑하여 OAuthUserInfo를 반환한다', async () => {
      const token = await signIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        oid: 'ms-oid-12345',
        name: 'Test MS User',
        email: 'user@contoso.com',
        email_verified: true,
      });

      const result = await provider.getUserInfo(token);

      expect(result).toEqual({
        id: 'ms-oid-12345',
        email: 'user@contoso.com',
        name: 'Test MS User',
        image: null,
        emailVerified: true,
      });
    });

    it('email이 없으면 preferred_username으로 폴백', async () => {
      const token = await signIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        oid: 'oid-1',
        preferred_username: 'user@tenant.onmicrosoft.com',
      });

      const result = await provider.getUserInfo(token);
      expect(result.email).toBe('user@tenant.onmicrosoft.com');
    });

    it('email_verified가 false면 emailVerified: false', async () => {
      const token = await signIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        oid: 'oid-2',
        email: 'a@b.com',
        email_verified: false,
      });
      const result = await provider.getUserInfo(token);
      expect(result.emailVerified).toBe(false);
    });

    it('email_verified가 누락되면 emailVerified: false', async () => {
      const token = await signIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        oid: 'oid-3',
        email: 'a@b.com',
      });
      const result = await provider.getUserInfo(token);
      expect(result.emailVerified).toBe(false);
    });

    it('name이 누락되면 name: null', async () => {
      const token = await signIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        oid: 'oid-4',
        email: 'a@b.com',
      });
      const result = await provider.getUserInfo(token);
      expect(result.name).toBeNull();
    });

    it('iss 형식이 Microsoft 형식이 아니면 OAuthError(INVALID_RESPONSE)', async () => {
      const token = await signIdToken({
        iss: 'https://accounts.google.com',
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        oid: 'oid-6',
      });
      await expect(provider.getUserInfo(token)).rejects.toThrow('Invalid Microsoft id_token');
    });

    it('exp 만료 시 OAuthError(INVALID_RESPONSE)', async () => {
      const token = await signIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: PAST_EXP,
        oid: 'oid-7',
      });
      await expect(provider.getUserInfo(token)).rejects.toThrow('Invalid Microsoft id_token');
    });

    it('oid 누락 시 OAuthError(INVALID_RESPONSE) — sub 폴백 안 함', async () => {
      const token = await signIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        sub: 'sub-only-no-oid',
        email: 'a@b.com',
      });
      await expect(provider.getUserInfo(token)).rejects.toThrow('Invalid Microsoft id_token');
    });

    it('형식이 깨진 JWT는 OAuthError(INVALID_RESPONSE)', async () => {
      await expect(provider.getUserInfo('not.a.jwt')).rejects.toThrow('Invalid Microsoft id_token');
    });

    it('Microsoft 서명이 없는(위조) id_token 은 거부한다 (O-2)', async () => {
      // 공격자가 유효한 클레임을 채워도 Microsoft 개인키로 서명할 수 없다.
      const forged = makeIdToken({
        iss: validIss,
        aud: 'test-ms-app-id',
        exp: FUTURE_EXP,
        oid: 'attacker-oid',
        email: 'attacker@evil.com',
        email_verified: true,
      });
      await expect(provider.getUserInfo(forged)).rejects.toThrow(
        'Invalid Microsoft id_token',
      );
    });
  });
});
