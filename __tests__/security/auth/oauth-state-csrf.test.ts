/**
 * OAuth 로그인 CSRF — state 쿠키 바인딩 (O-1)
 *
 * 핸들러는 state-cookie 를 서브모듈 경로에서 import 하므로 여기서는
 * OAuthManager / OAuthCallbackService / jwt cookie 만 mock 한다.
 */
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

const mockGetLoginUrl = vi.fn();
const mockExchangeCodeForToken = vi.fn();
const mockGetUserInfo = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/oauth', () => ({
  OAuthManager: vi.fn().mockImplementation(function (this: any) {
    this.getLoginUrl = mockGetLoginUrl;
    this.exchangeCodeForToken = mockExchangeCodeForToken;
    this.getUserInfo = mockGetUserInfo;
  }),
}));

const mockHandleCallback = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/services/oauth-callback.service', () => ({
  OAuthCallbackService: vi.fn().mockImplementation(function (this: any) {
    this.handleCallback = mockHandleCallback;
  }),
}));

const mockSetTokenCookies = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/jwt/cookie', () => ({
  setTokenCookies: (...a: any[]) => mockSetTokenCookies(...a),
  clearTokenCookies: vi.fn(),
}));

import { createOAuthAuthorizeHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-authorize.handler';
import { createOAuthCallbackHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-callback.handler';

function options(overrides: Partial<AuthHandlerOptions> = {}): AuthHandlerOptions {
  return {
    dependencies: {
      userRepository: {} as any,
      oauthAccountRepository: {} as any,
      emailTokenRepository: {} as any,
    },
    oauth: {
      google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/cb' },
    },
    jwt: { secret: 'a'.repeat(32) },
    urls: { baseUrl: 'http://localhost:3000' },
    ...overrides,
  };
}

function callbackReq(url: string, cookies: Record<string, string>): any {
  const req = new Request(url, { method: 'GET' }) as any;
  req.cookies = {
    get: (name: string) =>
      cookies[name] !== undefined ? { name, value: cookies[name] } : undefined,
  };
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('O-1 authorize: sets oauth_state HttpOnly cookie', () => {
  it('sets oauth_state cookie equal to the state returned in the body', async () => {
    mockGetLoginUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?x=1');
    const handler = createOAuthAuthorizeHandler(options());
    const req = new Request('http://localhost/api/auth/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google' }),
    }) as any;

    const res = await handler(req);
    const body = await res.json();
    const setCookie = res.headers.get('set-cookie') ?? '';

    expect(body.state).toBeTruthy();
    expect(setCookie).toContain(`oauth_state=${body.state}`);
    expect(setCookie.toLowerCase()).toContain('httponly');
  });
});

describe('O-1 callback: state validation (always strict)', () => {
  it('rejects with 400 and does NOT exchange code when state cookie is absent', async () => {
    const handler = createOAuthCallbackHandler(options());
    const req = callbackReq(
      'http://localhost/api/auth/oauth/callback?code=abc&provider=google&state=S1',
      {}, // no oauth_state cookie
    );
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid OAuth state');
    expect(mockExchangeCodeForToken).not.toHaveBeenCalled();
  });

  it('rejects with 400 when cookie and query state mismatch', async () => {
    const handler = createOAuthCallbackHandler(options());
    const req = callbackReq(
      'http://localhost/api/auth/oauth/callback?code=abc&provider=google&state=S1',
      { oauth_state: 'S2' },
    );
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid OAuth state');
    expect(mockExchangeCodeForToken).not.toHaveBeenCalled();
  });

  it('proceeds when cookie matches query state', async () => {
    mockExchangeCodeForToken.mockResolvedValue('tok');
    mockGetUserInfo.mockResolvedValue({
      id: 'gid', email: 'u@example.com', name: 'U', image: null,
    });
    mockHandleCallback.mockResolvedValue({
      user: { id: 'u1', email: 'u@example.com', name: 'U', role: 'USER' },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
      isNewUser: false,
    });
    const handler = createOAuthCallbackHandler(options());
    const req = callbackReq(
      'http://localhost/api/auth/oauth/callback?code=abc&provider=google&state=S1',
      { oauth_state: 'S1' },
    );
    const res = await handler(req);
    expect(res.status).toBe(307);
    expect(mockExchangeCodeForToken).toHaveBeenCalledWith('google', 'abc');
    // single-use: state 쿠키는 성공 경로에서도 소거된다
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('oauth_state=');
    expect(setCookie.toLowerCase()).toContain('max-age=0');
  });
});
