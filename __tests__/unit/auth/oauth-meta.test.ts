/**
 * Meta(Facebook) OAuth Provider 단위 테스트
 *
 * - getLoginUrl(): 올바른 Meta 인증 URL 생성
 * - exchangeCodeForToken(): GET + query string 방식 토큰 교환
 * - getUserInfo(): Graph /me 응답 매핑
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { MetaOAuthProvider } from '@withwiz/auth/core/oauth/providers/meta';
import type { OAuthProviderConfig } from '@withwiz/auth/types';
import { OAuthError } from '@withwiz/auth/errors';

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
  });
});
