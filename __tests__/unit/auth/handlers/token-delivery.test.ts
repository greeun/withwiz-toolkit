/**
 * auth 핸들러의 tokenDelivery 모드 분기 검증 (login / refresh / me)
 */
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { initializeAuth, resetAuth } from '@withwiz/toolkit/core/auth/config';

const mockCompare = vi.fn();
vi.mock('bcryptjs', () => ({
  compare: (...args: any[]) => mockCompare(...args),
}));

const mockCreateTokenPair = vi.fn();
const mockVerifyAccessToken = vi.fn();
const mockExtractTokenFromHeader = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/jwt', () => ({
  JWTService: vi.fn().mockImplementation(function (this: any) {
    this.createTokenPair = mockCreateTokenPair;
    this.verifyAccessToken = mockVerifyAccessToken;
    this.extractTokenFromHeader = mockExtractTokenFromHeader;
  }),
}));

const mockSetTokenCookies = vi.fn();
const mockClearTokenCookies = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/jwt/cookie', () => ({
  setTokenCookies: (...args: any[]) => mockSetTokenCookies(...args),
  clearTokenCookies: (...args: any[]) => mockClearTokenCookies(...args),
}));

const mockRefresh = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/services/token-refresh.service', () => ({
  TokenRefreshService: vi.fn().mockImplementation(function (this: any) {
    this.refresh = mockRefresh;
  }),
}));

import { createLoginHandler } from '@withwiz/toolkit/next/auth-handlers/login.handler';
import { createRefreshHandler } from '@withwiz/toolkit/next/auth-handlers/refresh.handler';
import { createMeHandler } from '@withwiz/toolkit/next/auth-handlers/me.handler';

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

const testUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'User One',
  role: 'USER',
  emailVerified: new Date(),
  isActive: true,
  password: 'hashed',
};

const tokenPair = { accessToken: 'at-123', refreshToken: 'rt-456' };

function createMockOptions(overrides: Partial<AuthHandlerOptions> = {}): AuthHandlerOptions {
  return {
    dependencies: {
      userRepository: {
        findById: vi.fn().mockResolvedValue(testUser),
        findByEmail: vi.fn().mockResolvedValue(testUser),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateLastLoginAt: vi.fn(),
        verifyEmail: vi.fn(),
      } as any,
      oauthAccountRepository: {} as any,
      emailTokenRepository: {} as any,
    },
    jwt: { secret: SECRET },
    urls: { baseUrl: 'http://localhost:3000' },
    ...overrides,
  };
}

function createMockRequest(init: {
  body?: unknown;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): any {
  return {
    json: async () => {
      if (init.body === undefined) throw new Error('no body');
      return init.body;
    },
    cookies: {
      get: (name: string) =>
        init.cookies?.[name] !== undefined
          ? { name, value: init.cookies[name] }
          : undefined,
    },
    headers: new Headers(init.headers ?? {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAuth();
  mockCompare.mockResolvedValue(true);
  mockCreateTokenPair.mockResolvedValue(tokenPair);
  mockRefresh.mockResolvedValue({ accessToken: 'new-at', user: { id: 'u1' } });
  mockVerifyAccessToken.mockResolvedValue({ userId: 'u1', email: 'u1@example.com' });
  mockExtractTokenFromHeader.mockImplementation((h?: string) =>
    h?.startsWith('Bearer ') ? h.slice(7) : null,
  );
});

afterEach(() => resetAuth());

const loginRequest = () =>
  createMockRequest({ body: { email: 'u1@example.com', password: 'pw123456' } });

describe('login 핸들러 tokenDelivery', () => {
  it('cookie 모드: body 에 tokens 없음 + 쿠키 설정', async () => {
    const handler = createLoginHandler(createMockOptions({ tokenDelivery: 'cookie' }));
    const res = await handler(loginRequest());
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tokens).toBeUndefined();
    expect(mockSetTokenCookies).toHaveBeenCalledTimes(1);
  });

  it('header 모드: body 에 tokens 포함 + 쿠키 미설정', async () => {
    const handler = createLoginHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(loginRequest());
    const body = await res.json();
    expect(body.tokens).toEqual(tokenPair);
    expect(mockSetTokenCookies).not.toHaveBeenCalled();
  });

  it('기본(hybrid): body tokens + 쿠키 둘 다', async () => {
    const handler = createLoginHandler(createMockOptions());
    const res = await handler(loginRequest());
    const body = await res.json();
    expect(body.tokens).toEqual(tokenPair);
    expect(mockSetTokenCookies).toHaveBeenCalledTimes(1);
  });

  it('전역 config 의 cookie 모드를 따른다 (옵션 미지정 시)', async () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'cookie' });
    const handler = createLoginHandler(createMockOptions());
    const res = await handler(loginRequest());
    const body = await res.json();
    expect(body.tokens).toBeUndefined();
    expect(mockSetTokenCookies).toHaveBeenCalledTimes(1);
  });
});

describe('refresh 핸들러 tokenDelivery', () => {
  it('cookie 모드: 쿠키 입력 + body 에 accessToken 없음 + 쿠키 재설정', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'cookie' }));
    const res = await handler(createMockRequest({ cookies: { refresh_token: 'rt-456' } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.accessToken).toBeUndefined();
    expect(mockSetTokenCookies).toHaveBeenCalledTimes(1);
  });

  it('header 모드: body {refreshToken} 입력 + body accessToken 반환 + 쿠키 미설정', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(createMockRequest({ body: { refreshToken: 'rt-456' } }));
    const body = await res.json();
    expect(body.accessToken).toBe('new-at');
    expect(mockSetTokenCookies).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledWith('rt-456');
  });

  it('header 모드: 쿠키는 무시한다', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(createMockRequest({ cookies: { refresh_token: 'rt-456' } }));
    expect(res.status).toBe(401);
  });

  it('hybrid 모드: 쿠키 없으면 body 로 폴백한다 (신규 동작)', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'hybrid' }));
    const res = await handler(createMockRequest({ body: { refreshToken: 'rt-456' } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.accessToken).toBe('new-at');
  });

  it('hybrid 모드: 쿠키가 body 보다 우선한다', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'hybrid' }));
    await handler(
      createMockRequest({
        cookies: { refresh_token: 'rt-cookie' },
        body: { refreshToken: 'rt-body' },
      }),
    );
    expect(mockRefresh).toHaveBeenCalledWith('rt-cookie');
  });

  it('토큰이 어디에도 없으면 401', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'hybrid' }));
    const res = await handler(createMockRequest({}));
    expect(res.status).toBe(401);
  });
});

describe('me 핸들러 tokenDelivery', () => {
  it('cookie 모드: 쿠키 토큰으로 조회된다', async () => {
    const handler = createMeHandler(createMockOptions({ tokenDelivery: 'cookie' }));
    const res = await handler(createMockRequest({ cookies: { access_token: 'at-123' } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.id).toBe('u1');
  });

  it('cookie 모드: Authorization 헤더는 무시된다', async () => {
    const handler = createMeHandler(createMockOptions({ tokenDelivery: 'cookie' }));
    const res = await handler(
      createMockRequest({ headers: { authorization: 'Bearer at-123' } }),
    );
    expect(res.status).toBe(401);
  });

  it('header 모드: 헤더 토큰으로 조회된다', async () => {
    const handler = createMeHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(
      createMockRequest({ headers: { authorization: 'Bearer at-123' } }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('header 모드: 쿠키는 무시된다', async () => {
    const handler = createMeHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(createMockRequest({ cookies: { access_token: 'at-123' } }));
    expect(res.status).toBe(401);
  });
});
