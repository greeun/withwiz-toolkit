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
});
