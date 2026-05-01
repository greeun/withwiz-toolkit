/**
 * OAuthManager Registry 패턴 단위 테스트
 *
 * OAuthManager의 프로바이더 레지스트리 패턴을 검증합니다.
 * - 빌트인 프로바이더 자동 등록 (Google, GitHub, Kakao)
 * - registerProvider()를 통한 커스텀 프로바이더 등록
 * - 미등록/미설정 프로바이더 에러 처리
 * - OAuthConfig 새 구조 (providers: Record<string, ...>)
 */

import { OAuthManager } from '@withwiz/auth/core/oauth';
import { OAuthError } from '@withwiz/auth/errors';
import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthTokenResponse, OAuthUserInfo, OAuthConfig } from '@withwiz/auth/types';

// ============================================================================
// 공통 설정
// ============================================================================

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const fullConfig: OAuthConfig = {
  providers: {
    google: {
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      redirectUri: 'http://localhost:3000/api/auth/callback/google',
    },
    github: {
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
      redirectUri: 'http://localhost:3000/api/auth/callback/github',
    },
    kakao: {
      clientId: 'kakao-client-id',
      clientSecret: 'kakao-client-secret',
      redirectUri: 'http://localhost:3000/api/auth/callback/kakao',
    },
  },
};

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ============================================================================
// 빌트인 프로바이더 자동 등록
// ============================================================================

describe('OAuthManager 빌트인 프로바이더', () => {
  it('생성 시 Google, GitHub, Kakao 프로바이더가 자동 등록되어야 한다', () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    // 각 프로바이더의 debug 로그가 호출되었는지 확인
    expect(mockLogger.debug).toHaveBeenCalledWith('OAuth provider registered: google');
    expect(mockLogger.debug).toHaveBeenCalledWith('OAuth provider registered: github');
    expect(mockLogger.debug).toHaveBeenCalledWith('OAuth provider registered: kakao');
  });

  it('수동 등록 없이 getLoginUrl("google", state)가 동작해야 한다', () => {
    const manager = new OAuthManager(fullConfig, mockLogger);
    const url = manager.getLoginUrl('google', 'state-123');

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=google-client-id');
    expect(url).toContain('state=state-123');
  });

  it('수동 등록 없이 getLoginUrl("github", state)가 동작해야 한다', () => {
    const manager = new OAuthManager(fullConfig, mockLogger);
    const url = manager.getLoginUrl('github', 'state-456');

    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain('client_id=github-client-id');
    expect(url).toContain('state=state-456');
  });

  it('수동 등록 없이 getLoginUrl("kakao", state)가 동작해야 한다', () => {
    const manager = new OAuthManager(fullConfig, mockLogger);
    const url = manager.getLoginUrl('kakao', 'state-789');

    expect(url).toContain('https://kauth.kakao.com/oauth/authorize');
    expect(url).toContain('client_id=kakao-client-id');
    expect(url).toContain('state=state-789');
  });
});

// ============================================================================
// 커스텀 프로바이더 등록
// ============================================================================

describe('OAuthManager 커스텀 프로바이더 등록', () => {
  const customProviderConfig: OAuthProviderConfig = {
    clientId: 'custom-client-id',
    clientSecret: 'custom-client-secret',
    redirectUri: 'http://localhost:3000/api/auth/callback/custom',
  };

  const configWithCustom: OAuthConfig = {
    providers: {
      ...fullConfig.providers,
      custom: customProviderConfig,
    },
  };

  function createCustomProvider(): IOAuthProviderAdapter {
    return {
      name: 'custom',
      getLoginUrl: vi.fn((config: OAuthProviderConfig, state?: string) => {
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
        });
        if (state) params.set('state', state);
        return `https://custom-oauth.example.com/auth?${params.toString()}`;
      }),
      exchangeCodeForToken: vi.fn(async (_config: OAuthProviderConfig, _code: string): Promise<OAuthTokenResponse> => ({
        access_token: 'custom-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })),
      getUserInfo: vi.fn(async (_accessToken: string): Promise<OAuthUserInfo> => ({
        id: 'custom-user-1',
        email: 'user@custom.com',
        name: 'Custom User',
        image: 'https://custom.com/avatar.png',
        emailVerified: true,
      })),
    };
  }

  it('registerProvider()로 커스텀 프로바이더를 추가할 수 있어야 한다', () => {
    const manager = new OAuthManager(configWithCustom, mockLogger);
    const customProvider = createCustomProvider();

    manager.registerProvider(customProvider);

    expect(mockLogger.debug).toHaveBeenCalledWith('OAuth provider registered: custom');
  });

  it('커스텀 프로바이더의 getLoginUrl()이 호출되어야 한다', () => {
    const manager = new OAuthManager(configWithCustom, mockLogger);
    const customProvider = createCustomProvider();
    manager.registerProvider(customProvider);

    const url = manager.getLoginUrl('custom', 'custom-state');

    expect(customProvider.getLoginUrl).toHaveBeenCalledWith(customProviderConfig, 'custom-state');
    expect(url).toContain('https://custom-oauth.example.com/auth');
    expect(url).toContain('client_id=custom-client-id');
    expect(url).toContain('state=custom-state');
  });

  it('커스텀 프로바이더의 exchangeCodeForToken()이 호출되어야 한다', async () => {
    const manager = new OAuthManager(configWithCustom, mockLogger);
    const customProvider = createCustomProvider();
    manager.registerProvider(customProvider);

    const token = await manager.exchangeCodeForToken('custom', 'custom-code');

    expect(customProvider.exchangeCodeForToken).toHaveBeenCalledWith(customProviderConfig, 'custom-code');
    expect(token).toBe('custom-access-token');
  });

  it('커스텀 프로바이더의 getUserInfo()가 호출되어야 한다', async () => {
    const manager = new OAuthManager(configWithCustom, mockLogger);
    const customProvider = createCustomProvider();
    manager.registerProvider(customProvider);

    const userInfo = await manager.getUserInfo('custom', 'custom-access-token');

    expect(customProvider.getUserInfo).toHaveBeenCalledWith('custom-access-token');
    expect(userInfo).toEqual({
      id: 'custom-user-1',
      email: 'user@custom.com',
      name: 'Custom User',
      image: 'https://custom.com/avatar.png',
      emailVerified: true,
    });
  });

  it('registerProvider()로 빌트인 프로바이더를 오버라이드할 수 있어야 한다', () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    const overriddenGoogle: IOAuthProviderAdapter = {
      name: 'google',
      getLoginUrl: vi.fn(() => 'https://custom-google.example.com/auth'),
      exchangeCodeForToken: vi.fn(async () => ({ access_token: 'overridden', token_type: 'Bearer' })),
      getUserInfo: vi.fn(async () => ({
        id: 'overridden-id',
        email: 'overridden@google.com',
        name: 'Overridden',
        image: null,
        emailVerified: true,
      })),
    };

    manager.registerProvider(overriddenGoogle);

    const url = manager.getLoginUrl('google', 'state');
    expect(url).toBe('https://custom-google.example.com/auth');
    expect(overriddenGoogle.getLoginUrl).toHaveBeenCalled();
  });
});

// ============================================================================
// 에러 케이스
// ============================================================================

describe('OAuthManager 에러 처리', () => {
  it('등록되지 않은 프로바이더 이름 사용 시 OAuthError를 던져야 한다', () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    expect(() => {
      manager.getLoginUrl('naver', 'state');
    }).toThrow(OAuthError);

    expect(() => {
      manager.getLoginUrl('naver', 'state');
    }).toThrow('Unsupported OAuth provider: naver');
  });

  it('프로바이더는 등록되어 있지만 config가 없으면 OAuthError를 던져야 한다', () => {
    const partialConfig: OAuthConfig = {
      providers: {
        google: {
          clientId: 'google-id',
          clientSecret: 'google-secret',
          redirectUri: 'http://localhost:3000/callback/google',
        },
        // github, kakao config 없음
      },
    };

    const manager = new OAuthManager(partialConfig, mockLogger);

    // github 프로바이더는 자동 등록되지만 config가 없음
    expect(() => {
      manager.getLoginUrl('github', 'state');
    }).toThrow(OAuthError);

    expect(() => {
      manager.getLoginUrl('github', 'state');
    }).toThrow('github OAuth not configured');
  });

  it('exchangeCodeForToken에서 미등록 프로바이더 사용 시 OAuthError를 던져야 한다', async () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    await expect(
      manager.exchangeCodeForToken('twitter', 'code'),
    ).rejects.toThrow(OAuthError);

    await expect(
      manager.exchangeCodeForToken('twitter', 'code'),
    ).rejects.toThrow('Unsupported OAuth provider: twitter');
  });

  it('getUserInfo에서 미등록 프로바이더 사용 시 OAuthError를 던져야 한다', async () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    await expect(
      manager.getUserInfo('twitter', 'token'),
    ).rejects.toThrow(OAuthError);

    await expect(
      manager.getUserInfo('twitter', 'token'),
    ).rejects.toThrow('Unsupported OAuth provider: twitter');
  });

  it('exchangeCodeForToken에서 config 누락 시 OAuthError를 던져야 한다', async () => {
    const manager = new OAuthManager({ providers: {} }, mockLogger);

    await expect(
      manager.exchangeCodeForToken('google', 'code'),
    ).rejects.toThrow('google OAuth not configured');
  });

  it('exchangeCodeForToken에서 네트워크 에러 시 OAuthError로 래핑되어야 한다', async () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      manager.exchangeCodeForToken('google', 'code'),
    ).rejects.toThrow('token exchange failed');

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('getUserInfo에서 네트워크 에러 시 OAuthError로 래핑되어야 한다', async () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      manager.getUserInfo('google', 'token'),
    ).rejects.toThrow('user info');

    expect(mockLogger.error).toHaveBeenCalled();
  });
});

// ============================================================================
// OAuthConfig 새 구조
// ============================================================================

describe('OAuthConfig 새 구조', () => {
  it('providers: Record<string, OAuthProviderConfig> 형태를 수용해야 한다', () => {
    const config: OAuthConfig = {
      providers: {
        google: {
          clientId: 'g-id',
          clientSecret: 'g-secret',
          redirectUri: 'http://localhost/cb/google',
        },
        github: {
          clientId: 'gh-id',
          clientSecret: 'gh-secret',
          redirectUri: 'http://localhost/cb/github',
        },
      },
    };

    const manager = new OAuthManager(config, mockLogger);

    // google과 github 모두 정상 동작
    const googleUrl = manager.getLoginUrl('google', 'state');
    expect(googleUrl).toContain('client_id=g-id');

    const githubUrl = manager.getLoginUrl('github', 'state');
    expect(githubUrl).toContain('client_id=gh-id');
  });

  it('일부 프로바이더만 설정해도 동작해야 한다 (부분 설정)', () => {
    const partialConfig: OAuthConfig = {
      providers: {
        kakao: {
          clientId: 'kakao-only-id',
          clientSecret: 'kakao-only-secret',
          redirectUri: 'http://localhost/cb/kakao',
        },
      },
    };

    const manager = new OAuthManager(partialConfig, mockLogger);

    // kakao만 설정됨 — 정상 동작
    const kakaoUrl = manager.getLoginUrl('kakao', 'state');
    expect(kakaoUrl).toContain('client_id=kakao-only-id');

    // google은 프로바이더는 등록되어 있지만 config가 없음
    expect(() => {
      manager.getLoginUrl('google', 'state');
    }).toThrow('google OAuth not configured');
  });

  it('빈 providers 객체로도 Manager를 생성할 수 있어야 한다', () => {
    const emptyConfig: OAuthConfig = {
      providers: {},
    };

    const manager = new OAuthManager(emptyConfig, mockLogger);

    // 프로바이더는 등록되어 있지만 config가 없으므로 에러
    expect(() => {
      manager.getLoginUrl('google', 'state');
    }).toThrow('google OAuth not configured');
  });
});

// ============================================================================
// OAuthManager exchangeCodeForToken 반환값 테스트
// ============================================================================

describe('OAuthManager.exchangeCodeForToken() 반환값', () => {
  it('프로바이더의 OAuthTokenResponse에서 access_token만 추출하여 string으로 반환해야 한다', async () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'extracted-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'this-should-not-be-returned',
        scope: 'openid email profile',
      }),
    } as Response);

    const result = await manager.exchangeCodeForToken('google', 'code');

    expect(result).toBe('extracted-access-token');
    expect(typeof result).toBe('string');
  });

  it('성공 시 logger.debug가 호출되어야 한다', async () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'token', token_type: 'Bearer' }),
    } as Response);

    await manager.exchangeCodeForToken('github', 'code');

    expect(mockLogger.debug).toHaveBeenCalledWith('github token exchange successful');
  });
});

// ============================================================================
// OAuthManager.getUserInfo() 로깅 테스트
// ============================================================================

describe('OAuthManager.getUserInfo() 로깅', () => {
  it('성공 시 userId와 email이 포함된 debug 로그를 출력해야 한다', async () => {
    const manager = new OAuthManager(fullConfig, mockLogger);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        verified_email: true,
      }),
    } as Response);

    await manager.getUserInfo('google', 'token');

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'google user info retrieved',
      expect.objectContaining({
        userId: 'user-123',
        email: 'test@example.com',
      }),
    );
  });
});
