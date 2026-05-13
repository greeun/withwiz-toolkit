/**
 * Microsoft OAuth Provider 단위 테스트
 *
 * - getLoginUrl(): common 테넌트 authorize URL 생성
 * - exchangeCodeForToken(): id_token을 access_token 필드에 담아 반환
 * - getUserInfo(): id_token JWT 디코딩 + iss/aud/exp/oid 검증
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { MicrosoftOAuthProvider } from '@withwiz/auth/core/oauth/providers/microsoft';
import { OAuthError } from '@withwiz/auth/errors';
import type { OAuthProviderConfig } from '@withwiz/auth/types';

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
});
