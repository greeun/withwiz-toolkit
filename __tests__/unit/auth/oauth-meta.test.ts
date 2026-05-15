/**
 * Meta(Facebook) OAuth Provider 단위 테스트
 *
 * - getLoginUrl(): 올바른 Meta 인증 URL 생성
 * - exchangeCodeForToken(): GET + query string 방식 토큰 교환
 * - getUserInfo(): Graph /me 응답 매핑
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { MetaOAuthProvider } from '@withwiz/core/auth/oauth/providers/meta';
import type { OAuthProviderConfig } from '@withwiz/core/auth/types';
import { OAuthError } from '@withwiz/core/auth/errors';

const mockConfig: OAuthProviderConfig = {
  clientId: 'test-meta-app-id',
  clientSecret: 'test-meta-app-secret',
  redirectUri: 'http://localhost:3000/api/auth/callback/meta',
};

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('MetaOAuthProvider', () => {
  const provider = new MetaOAuthProvider();

  it('프로바이더 이름이 "meta"이어야 한다', () => {
    expect(provider.name).toBe('meta');
  });

  describe('getLoginUrl()', () => {
    it('올바른 Meta OAuth 인증 URL을 생성해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe('https://www.facebook.com/v25.0/dialog/oauth');
      expect(parsed.searchParams.get('client_id')).toBe('test-meta-app-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/meta');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('email,public_profile');
    });

    it('state 파라미터가 제공되면 URL에 포함해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig, 'csrf-meta-state');
      const parsed = new URL(url);
      expect(parsed.searchParams.get('state')).toBe('csrf-meta-state');
    });

    it('state가 없으면 URL에 state가 포함되지 않아야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);
      expect(parsed.searchParams.has('state')).toBe(false);
    });
  });

  describe('exchangeCodeForToken()', () => {
    it('GET + query string으로 토큰 엔드포인트를 호출해야 한다', async () => {
      const mockTokenResponse = {
        access_token: 'meta-access-token-xyz',
        token_type: 'bearer',
        expires_in: 5183999,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await provider.exchangeCodeForToken(mockConfig, 'meta-auth-code');

      expect(result).toEqual(mockTokenResponse);

      // fetch 호출 URL 검증 - GET 메서드 + 쿼리 파라미터 4개
      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const calledUrl = new URL(callArgs[0]);
      expect(calledUrl.origin + calledUrl.pathname).toBe('https://graph.facebook.com/v25.0/oauth/access_token');
      expect(calledUrl.searchParams.get('client_id')).toBe('test-meta-app-id');
      expect(calledUrl.searchParams.get('client_secret')).toBe('test-meta-app-secret');
      expect(calledUrl.searchParams.get('code')).toBe('meta-auth-code');
      expect(calledUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/meta');

      // grant_type, scope은 Meta에서 불필요
      expect(calledUrl.searchParams.has('grant_type')).toBe(false);
      expect(calledUrl.searchParams.has('scope')).toBe(false);

      // fetch는 옵션 없이 호출되어야 한다 (기본 메서드 GET)
      expect(callArgs[1]).toBeUndefined();
    });

    it('HTTP 오류 시 OAuthError(TOKEN_EXCHANGE_FAILED)를 던져야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":{"message":"Invalid verification code"}}'),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'invalid-code'),
      ).rejects.toThrow(OAuthError);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'invalid-code'),
      ).rejects.toThrow('Meta token exchange failed');
    });

    it('HTTP 200이어도 access_token이 없으면 OAuthError(INVALID_RESPONSE)를 던져야 한다', async () => {
      // Meta는 오류를 HTTP 200 + { error: {...} } 형태로 반환할 수 있다
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ error: { message: 'This authorization code has expired.' } }),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'expired-code'),
      ).rejects.toThrow(OAuthError);
      await expect(
        provider.exchangeCodeForToken(mockConfig, 'expired-code'),
      ).rejects.toThrow('Invalid Meta response');
    });
  });

  describe('getUserInfo()', () => {
    it('성공 시 매핑된 OAuthUserInfo를 반환해야 한다', async () => {
      const mockMetaUser = {
        id: '10001234567890',
        name: 'Test User',
        email: 'user@example.com',
        picture: {
          data: {
            url: 'https://platform-lookaside.fbsbx.com/abc.jpg',
            width: 50,
            height: 50,
            is_silhouette: false,
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMetaUser),
      } as Response);

      const userInfo = await provider.getUserInfo('meta-token');

      expect(userInfo).toEqual({
        id: '10001234567890',
        email: 'user@example.com',
        name: 'Test User',
        image: 'https://platform-lookaside.fbsbx.com/abc.jpg',
        emailVerified: true,
      });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const calledUrl = new URL(callArgs[0]);
      expect(calledUrl.origin + calledUrl.pathname).toBe('https://graph.facebook.com/v25.0/me');
      expect(calledUrl.searchParams.get('fields')).toBe('id,name,email,picture');
      expect(callArgs[1].headers).toEqual({ Authorization: 'Bearer meta-token' });
    });

    it('email이 없으면 emailVerified가 false이어야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '777', name: 'No Email User' }),
      } as Response);

      const result = await provider.getUserInfo('token');
      expect(result.email).toBeUndefined();
      expect(result.emailVerified).toBe(false);
    });

    it('picture가 없으면 image: null', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '888', email: 'a@b.com' }),
      } as Response);

      const result = await provider.getUserInfo('token');
      expect(result.image).toBeNull();
    });

    it('name이 없으면 name: null', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '999', email: 'x@y.com' }),
      } as Response);

      const result = await provider.getUserInfo('token');
      expect(result.name).toBeNull();
    });

    it('data.id가 누락되면 OAuthError(INVALID_RESPONSE)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'No ID' }),
      } as Response);

      await expect(provider.getUserInfo('token')).rejects.toThrow(OAuthError);
      await expect(provider.getUserInfo('token')).rejects.toThrow('Invalid Meta response');
    });

    it('HTTP 오류 시 OAuthError(USER_INFO_FAILED)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(provider.getUserInfo('bad-token')).rejects.toThrow(OAuthError);
      await expect(provider.getUserInfo('bad-token')).rejects.toThrow('Failed to get Meta user info');
    });
  });
});
