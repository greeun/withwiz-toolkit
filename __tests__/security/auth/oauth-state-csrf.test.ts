/**
 * OAuth 로그인 CSRF — state 쿠키 바인딩 (O-1)
 *
 * 핸들러는 state-cookie 를 서브모듈 경로에서 import 하므로 여기서는
 * OAuthManager / OAuthCallbackService / jwt cookie 만 mock 한다.
 */
import type { AuthHandlerOptions } from '../../../src/next/auth-types/handler-types';

const mockGetLoginUrl = vi.fn();
const mockExchangeCodeForToken = vi.fn();
const mockGetUserInfo = vi.fn();
vi.mock('../../../src/core/auth/oauth', () => ({
  OAuthManager: vi.fn().mockImplementation(function (this: any) {
    this.getLoginUrl = mockGetLoginUrl;
    this.exchangeCodeForToken = mockExchangeCodeForToken;
    this.getUserInfo = mockGetUserInfo;
  }),
}));

const mockHandleCallback = vi.fn();
vi.mock('../../../src/core/auth/services/oauth-callback.service', () => ({
  OAuthCallbackService: vi.fn().mockImplementation(function (this: any) {
    this.handleCallback = mockHandleCallback;
  }),
}));

const mockSetTokenCookies = vi.fn();
vi.mock('../../../src/core/auth/jwt/cookie', () => ({
  setTokenCookies: (...a: any[]) => mockSetTokenCookies(...a),
  clearTokenCookies: vi.fn(),
}));

import { createOAuthAuthorizeHandler } from '../../../src/next/auth-handlers/oauth-authorize.handler';
import { createOAuthCallbackHandler } from '../../../src/next/auth-handlers/oauth-callback.handler';

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
