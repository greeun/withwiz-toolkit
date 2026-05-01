/**
 * OAuth Provider Adapter 단위 테스트
 *
 * 각 프로바이더 어댑터(Google, GitHub, Kakao)의 독립적인 동작을 검증합니다.
 * - getLoginUrl(): 올바른 인증 URL 생성
 * - exchangeCodeForToken(): 코드 → 토큰 교환
 * - getUserInfo(): 사용자 정보 조회 및 필드 매핑
 */

import { GoogleOAuthProvider } from '@withwiz/auth/core/oauth/providers/google';
import { GitHubOAuthProvider } from '@withwiz/auth/core/oauth/providers/github';
import { KakaoOAuthProvider } from '@withwiz/auth/core/oauth/providers/kakao';
import { OAuthError } from '@withwiz/auth/errors';
import type { OAuthProviderConfig } from '@withwiz/auth/types';

// ============================================================================
// 공통 설정
// ============================================================================

const mockConfig: OAuthProviderConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/api/auth/callback',
};

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

// ============================================================================
// Google OAuth Provider
// ============================================================================

describe('GoogleOAuthProvider', () => {
  const provider = new GoogleOAuthProvider();

  it('프로바이더 이름이 "google"이어야 한다', () => {
    expect(provider.name).toBe('google');
  });

  describe('getLoginUrl()', () => {
    it('올바른 Google OAuth 인증 URL을 생성해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('openid email profile');
      expect(parsed.searchParams.get('access_type')).toBe('offline');
      expect(parsed.searchParams.get('prompt')).toBe('select_account consent');
    });

    it('state 파라미터가 제공되면 URL에 포함해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig, 'csrf-state-123');
      const parsed = new URL(url);

      expect(parsed.searchParams.get('state')).toBe('csrf-state-123');
    });

    it('state 파라미터가 없으면 URL에 state가 포함되지 않아야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);

      expect(parsed.searchParams.has('state')).toBe(false);
    });
  });

  describe('exchangeCodeForToken()', () => {
    it('성공 시 OAuthTokenResponse를 반환해야 한다', async () => {
      const mockTokenResponse = {
        access_token: 'google-access-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'google-refresh-token',
        scope: 'openid email profile',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await provider.exchangeCodeForToken(mockConfig, 'auth-code-123');

      expect(result).toEqual(mockTokenResponse);
      expect(result.access_token).toBe('google-access-token-123');
      expect(fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      // 요청 본문에 필수 파라미터가 포함되어 있는지 확인
      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('code')).toBe('auth-code-123');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback');
    });

    it('HTTP 오류 시 OAuthError를 던져야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid grant'),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'invalid-code'),
      ).rejects.toThrow(OAuthError);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'invalid-code'),
      ).rejects.toThrow('Google token exchange failed');
    });
  });

  describe('getUserInfo()', () => {
    it('성공 시 올바르게 매핑된 OAuthUserInfo를 반환해야 한다', async () => {
      const mockGoogleUser = {
        id: 'google-uid-123',
        email: 'user@gmail.com',
        name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/avatar.jpg',
        verified_email: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoogleUser),
      } as Response);

      const userInfo = await provider.getUserInfo('access-token');

      expect(userInfo).toEqual({
        id: 'google-uid-123',
        email: 'user@gmail.com',
        name: 'Test User',
        image: 'https://lh3.googleusercontent.com/avatar.jpg',
        emailVerified: true,
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer access-token' },
        }),
      );
    });

    it('picture → image, verified_email → emailVerified 필드 매핑이 올바라야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'uid-1',
          email: 'a@b.com',
          picture: 'https://pic.url/img.png',
          verified_email: true,
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.image).toBe('https://pic.url/img.png');
      expect(result.emailVerified).toBe(true);
    });

    it('선택 필드가 없으면 null/false로 반환해야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'uid-2',
          email: 'minimal@example.com',
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.name).toBeNull();
      expect(result.image).toBeNull();
      expect(result.emailVerified).toBe(false);
    });

    it('HTTP 오류 시 OAuthError를 던져야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(provider.getUserInfo('invalid-token')).rejects.toThrow(OAuthError);
      await expect(provider.getUserInfo('invalid-token')).rejects.toThrow('Failed to get Google user info');
    });
  });
});

// ============================================================================
// GitHub OAuth Provider
// ============================================================================

describe('GitHubOAuthProvider', () => {
  const provider = new GitHubOAuthProvider();

  it('프로바이더 이름이 "github"이어야 한다', () => {
    expect(provider.name).toBe('github');
  });

  describe('getLoginUrl()', () => {
    it('올바른 GitHub OAuth 인증 URL을 생성해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe('https://github.com/login/oauth/authorize');
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback');
      expect(parsed.searchParams.get('scope')).toBe('read:user user:email');
    });

    it('state 파라미터가 제공되면 URL에 포함해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig, 'github-csrf-token');
      const parsed = new URL(url);

      expect(parsed.searchParams.get('state')).toBe('github-csrf-token');
    });

    it('state 파라미터가 없으면 URL에 state가 포함되지 않아야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);

      expect(parsed.searchParams.has('state')).toBe(false);
    });

    it('Google과 다른 OAuth 엔드포인트를 사용해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);

      expect(url).not.toContain('accounts.google.com');
      expect(url).toContain('github.com/login/oauth/authorize');
    });
  });

  describe('exchangeCodeForToken()', () => {
    it('성공 시 OAuthTokenResponse를 반환해야 한다', async () => {
      const mockTokenResponse = {
        access_token: 'gho_github-token-abc',
        token_type: 'bearer',
        scope: 'read:user,user:email',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await provider.exchangeCodeForToken(mockConfig, 'gh-code-456');

      expect(result).toEqual(mockTokenResponse);
      expect(result.access_token).toBe('gho_github-token-abc');
      expect(fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      );

      // GitHub는 JSON body를 사용
      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.client_id).toBe('test-client-id');
      expect(body.client_secret).toBe('test-client-secret');
      expect(body.code).toBe('gh-code-456');
      expect(body.redirect_uri).toBe('http://localhost:3000/api/auth/callback');
    });

    it('JSON body와 Accept: application/json 헤더를 전송해야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' }),
      } as Response);

      await provider.exchangeCodeForToken(mockConfig, 'code');

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toEqual({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
    });

    it('HTTP 오류 시 OAuthError를 던져야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad verification code'),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'invalid-code'),
      ).rejects.toThrow(OAuthError);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'invalid-code'),
      ).rejects.toThrow('GitHub token exchange failed');
    });
  });

  describe('getUserInfo()', () => {
    it('성공 시 올바르게 매핑된 OAuthUserInfo를 반환해야 한다', async () => {
      const mockGitHubUser = {
        id: 12345,
        login: 'octocat',
        email: 'octocat@github.com',
        name: 'The Octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGitHubUser),
      } as Response);

      const userInfo = await provider.getUserInfo('gh-access-token');

      expect(userInfo).toEqual({
        id: '12345',
        email: 'octocat@github.com',
        name: 'The Octocat',
        image: 'https://avatars.githubusercontent.com/u/12345',
        emailVerified: true,
      });

      // User-Agent 헤더 포함 확인
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer gh-access-token',
            'User-Agent': 'Auth-Module',
          },
        }),
      );
    });

    it('id를 number에서 string으로 변환해야 한다 (data.id.toString())', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 99999, login: 'user' }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.id).toBe('99999');
      expect(typeof result.id).toBe('string');
    });

    it('avatar_url → image 필드 매핑이 올바라야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          login: 'user',
          avatar_url: 'https://avatars.url/pic.png',
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.image).toBe('https://avatars.url/pic.png');
    });

    it('email이 있으면 emailVerified가 true여야 한다 (!!data.email)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          login: 'user',
          email: 'user@example.com',
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.emailVerified).toBe(true);
    });

    it('email이 없으면 emailVerified가 false여야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          login: 'user',
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.emailVerified).toBe(false);
    });

    it('선택 필드가 없으면 null로 반환해야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          login: 'minimal-user',
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.name).toBeNull();
      expect(result.image).toBeNull();
    });

    it('HTTP 오류 시 OAuthError를 던져야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(provider.getUserInfo('invalid-token')).rejects.toThrow(OAuthError);
      await expect(provider.getUserInfo('invalid-token')).rejects.toThrow('Failed to get GitHub user info');
    });
  });
});

// ============================================================================
// Kakao OAuth Provider
// ============================================================================

describe('KakaoOAuthProvider', () => {
  const provider = new KakaoOAuthProvider();

  it('프로바이더 이름이 "kakao"여야 한다', () => {
    expect(provider.name).toBe('kakao');
  });

  describe('getLoginUrl()', () => {
    it('올바른 Kakao OAuth 인증 URL을 생성해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe('https://kauth.kakao.com/oauth/authorize');
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('profile_nickname profile_image account_email');
    });

    it('state 파라미터가 제공되면 URL에 포함해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig, 'kakao-csrf-state');
      const parsed = new URL(url);

      expect(parsed.searchParams.get('state')).toBe('kakao-csrf-state');
    });

    it('state 파라미터가 없으면 URL에 state가 포함되지 않아야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);
      const parsed = new URL(url);

      expect(parsed.searchParams.has('state')).toBe(false);
    });

    it('Kakao 전용 OAuth 엔드포인트를 사용해야 한다', () => {
      const url = provider.getLoginUrl(mockConfig);

      expect(url).toContain('kauth.kakao.com');
      expect(url).not.toContain('google.com');
      expect(url).not.toContain('github.com');
    });
  });

  describe('exchangeCodeForToken()', () => {
    it('성공 시 OAuthTokenResponse를 반환해야 한다', async () => {
      const mockTokenResponse = {
        access_token: 'kakao-access-token-xyz',
        token_type: 'bearer',
        expires_in: 21599,
        refresh_token: 'kakao-refresh-token',
        scope: 'profile_nickname profile_image account_email',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await provider.exchangeCodeForToken(mockConfig, 'kakao-code-789');

      expect(result).toEqual(mockTokenResponse);
      expect(result.access_token).toBe('kakao-access-token-xyz');
      expect(fetch).toHaveBeenCalledWith(
        'https://kauth.kakao.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      // 요청 본문에 필수 파라미터가 포함되어 있는지 확인
      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('code')).toBe('kakao-code-789');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback');
    });

    it('HTTP 오류 시 OAuthError를 던져야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid grant'),
      } as Response);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'invalid-code'),
      ).rejects.toThrow(OAuthError);

      await expect(
        provider.exchangeCodeForToken(mockConfig, 'invalid-code'),
      ).rejects.toThrow('Kakao token exchange failed');
    });
  });

  describe('getUserInfo()', () => {
    it('성공 시 올바르게 매핑된 OAuthUserInfo를 반환해야 한다', async () => {
      const mockKakaoUser = {
        id: 1234567890,
        kakao_account: {
          email: 'user@kakao.com',
          is_email_verified: true,
          profile: {
            nickname: '카카오유저',
            profile_image_url: 'https://k.kakaocdn.net/avatar.jpg',
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockKakaoUser),
      } as Response);

      const userInfo = await provider.getUserInfo('kakao-access-token');

      expect(userInfo).toEqual({
        id: '1234567890',
        email: 'user@kakao.com',
        name: '카카오유저',
        image: 'https://k.kakaocdn.net/avatar.jpg',
        emailVerified: true,
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://kapi.kakao.com/v2/user/me',
        expect.objectContaining({
          headers: { Authorization: 'Bearer kakao-access-token' },
        }),
      );
    });

    it('id를 number에서 string으로 변환해야 한다 (data.id.toString())', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 9876543210,
          kakao_account: {},
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.id).toBe('9876543210');
      expect(typeof result.id).toBe('string');
    });

    it('kakao_account.profile.nickname → name 매핑이 올바라야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          kakao_account: {
            profile: { nickname: '테스트닉네임' },
          },
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.name).toBe('테스트닉네임');
    });

    it('kakao_account.profile.profile_image_url → image 매핑이 올바라야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          kakao_account: {
            profile: { profile_image_url: 'https://k.kakaocdn.net/img.jpg' },
          },
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.image).toBe('https://k.kakaocdn.net/img.jpg');
    });

    it('kakao_account가 없으면 name/image는 null, emailVerified는 false여야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1111111111 }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.id).toBe('1111111111');
      expect(result.name).toBeNull();
      expect(result.image).toBeNull();
      expect(result.emailVerified).toBe(false);
    });

    it('kakao_account.profile이 없으면 name/image는 null이어야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          kakao_account: { email: 'user@kakao.com' },
        }),
      } as Response);

      const result = await provider.getUserInfo('token');

      expect(result.name).toBeNull();
      expect(result.image).toBeNull();
    });

    it('HTTP 오류 시 OAuthError를 던져야 한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(provider.getUserInfo('invalid-token')).rejects.toThrow(OAuthError);
      await expect(provider.getUserInfo('invalid-token')).rejects.toThrow('Failed to get Kakao user info');
    });
  });
});
