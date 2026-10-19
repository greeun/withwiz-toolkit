import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

// ============================================================================
// Mocks
// ============================================================================

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

const mockRegister = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/services/register.service', () => ({
  RegisterService: vi.fn().mockImplementation(function (this: any) {
    this.register = mockRegister;
  }),
}));

const mockRefresh = vi.fn();
const mockRevokeByToken = vi.fn();
const mockTokenRefreshServiceCtor = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/services/token-refresh.service', () => ({
  TokenRefreshService: vi.fn().mockImplementation(function (this: any, config: unknown) {
    mockTokenRefreshServiceCtor(config);
    this.refresh = mockRefresh;
    this.revokeByToken = mockRevokeByToken;
  }),
}));

const mockRequestReset = vi.fn();
const mockResetPassword = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/services/password-reset.service', () => ({
  PasswordResetService: vi.fn().mockImplementation(function (this: any) {
    this.requestReset = mockRequestReset;
    this.resetPassword = mockResetPassword;
  }),
}));

const mockVerifyEmail = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/services/email-verification.service', () => ({
  EmailVerificationService: vi.fn().mockImplementation(function (this: any) {
    this.verify = mockVerifyEmail;
  }),
}));

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

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { createLoginHandler } from '@withwiz/toolkit/next/auth-handlers/login.handler';
import { createRegisterHandler } from '@withwiz/toolkit/next/auth-handlers/register.handler';
import { createLogoutHandler } from '@withwiz/toolkit/next/auth-handlers/logout.handler';
import { createRefreshHandler } from '@withwiz/toolkit/next/auth-handlers/refresh.handler';
import { createMeHandler } from '@withwiz/toolkit/next/auth-handlers/me.handler';
import { createForgotPasswordHandler } from '@withwiz/toolkit/next/auth-handlers/forgot-password.handler';
import { createResetPasswordHandler } from '@withwiz/toolkit/next/auth-handlers/reset-password.handler';
import { createVerifyEmailHandler } from '@withwiz/toolkit/next/auth-handlers/verify-email.handler';
import { createOAuthAuthorizeHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-authorize.handler';
import { createOAuthCallbackHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-callback.handler';
import { createAuthHandlers } from '@withwiz/toolkit/next/auth-handlers';
import { createSignupHandler } from '@withwiz/toolkit/next/auth-handlers/signup.handler';
import { TokenGenerator } from '@withwiz/toolkit/core/auth/email/token-generator';

// ============================================================================
// Helpers
// ============================================================================

function createMockOptions(overrides: Partial<AuthHandlerOptions> = {}): AuthHandlerOptions {
  return {
    dependencies: {
      userRepository: {
        findById: vi.fn(),
        findByEmail: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateLastLoginAt: vi.fn(),
        verifyEmail: vi.fn(),
      },
      oauthAccountRepository: {
        findByProvider: vi.fn(),
        findByUserId: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      emailTokenRepository: {
        create: vi.fn(),
        findByEmailAndToken: vi.fn(),
        delete: vi.fn(),
        deleteExpired: vi.fn(),
        markAsUsed: vi.fn(),
      },
    },
    jwt: { secret: 'a'.repeat(32) },
    urls: { baseUrl: 'http://localhost:3000' },
    ...overrides,
  };
}

function makeRequest(url: string, options: RequestInit = {}): any {
  return new Request(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
}

function makePostRequest(url: string, body: unknown): any {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeRequestWithCookies(url: string, cookies: Record<string, string>, options: RequestInit = {}): any {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  const req = new Request(url, {
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    ...options,
  }) as any;
  // Simulate Next.js NextRequest cookies API
  req.cookies = {
    get: (name: string) => {
      const value = cookies[name];
      return value !== undefined ? { name, value } : undefined;
    },
  };
  return req;
}

async function parseJsonResponse(response: Response) {
  return response.json();
}

// ============================================================================
// Tests
// ============================================================================


// 0.21 인증 계약: errorFormat · passwordPolicy · findEmailByToken · signup · 훅 ctx
const verifiedUser = { id: 'u1', email: 'test@example.com', name: 'Test', role: 'user', emailVerified: new Date('2026-01-01'), isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
});

describe('errorFormat', () => {
  it('legacy 를 명시하면 0.20 과 같은 문자열형 본문이다', async () => {
    const options = createMockOptions({ errorFormat: 'legacy', features: { emailVerificationRequired: true } });
    (options.dependencies.userRepository.findByEmail as any).mockResolvedValue({ ...verifiedUser, emailVerified: null, password: 'h' });
    mockCompare.mockResolvedValue(true);
    const res = await createLoginHandler(options)(makePostRequest('http://localhost/api/auth/login', { email: 'test@example.com', password: 'pw' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ success: false, error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
  });

  it('기본값(미지정)은 standard(0.22+) — 명시한 standard 와 같은 본문이다', async () => {
    const login = async (overrides: Partial<AuthHandlerOptions>) => {
      const options = createMockOptions({ features: { emailVerificationRequired: true }, ...overrides });
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue({ ...verifiedUser, emailVerified: null, password: 'h' });
      mockCompare.mockResolvedValue(true);
      return createLoginHandler(options)(makePostRequest('http://localhost/api/auth/login', { email: 'test@example.com', password: 'pw' }));
    };
    const res = await login({});
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(typeof json.error).toBe('object');
    expect(json).not.toHaveProperty('code');
    expect(json.error).toEqual(expect.objectContaining({ key: 'EMAIL_NOT_VERIFIED', code: 40305, message: 'Email not verified' }));
    expect(json.error.userMessage).toEqual(expect.objectContaining({ title: expect.any(String), description: expect.any(String) }));
    const { requestId: _a, ...defaultError } = json.error;
    const { requestId: _b, ...standardError } = (await (await login({ errorFormat: 'standard' })).json()).error;
    expect(defaultError).toEqual(standardError);
  });

  it('createAuthHandlers 로 묶은 핸들러도 기본값이 standard 다(검증 실패에 fieldErrors)', async () => {
    const res = await createAuthHandlers(createMockOptions()).login(
      makePostRequest('http://localhost/api/auth/login', { email: 'not-an-email', password: 'x' }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.key).toBe('VALIDATION_ERROR');
    expect(json.error.details.fieldErrors.email).toEqual([expect.any(String)]);
  });

  it('standard 는 key·code·userMessage 를 싣고, legacy 의 code 값이 key 가 된다', async () => {
    const options = createMockOptions({ errorFormat: 'standard', features: { emailVerificationRequired: true } });
    (options.dependencies.userRepository.findByEmail as any).mockResolvedValue({ ...verifiedUser, emailVerified: null, password: 'h' });
    mockCompare.mockResolvedValue(true);
    const res = await createLoginHandler(options)(makePostRequest('http://localhost/api/auth/login', { email: 'test@example.com', password: 'pw' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toEqual(expect.objectContaining({ key: 'EMAIL_NOT_VERIFIED', code: 40305, message: 'Email not verified' }));
    expect(json.error.userMessage.description).toEqual(expect.any(String));
  });

  it('standard 의 검증 실패는 details.fieldErrors 를 싣는다', async () => {
    const res = await createLoginHandler(createMockOptions({ errorFormat: 'standard' }))(
      makePostRequest('http://localhost/api/auth/login', { email: 'not-an-email', password: 'x' }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.key).toBe('VALIDATION_ERROR');
    expect(json.error.details.fieldErrors.email).toEqual([expect.any(String)]);
  });

  it('standard 에서 서비스의 AuthError 는 그 code 를 key 로 쓰고 상태를 유지한다', async () => {
    mockRegister.mockRejectedValue(new AuthError('Email already in use', 'EMAIL_ALREADY_EXISTS', 409));
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'standard' }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'password123' }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toEqual(expect.objectContaining({ key: 'EMAIL_ALREADY_EXISTS', message: 'Email already in use' }));
  });

  it.each(['legacy', 'standard'] as const)('%s: 실패 응답의 HTTP 상태는 같다', async (errorFormat) => {
    const options = createMockOptions({ errorFormat });
    (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(null);
    mockCompare.mockResolvedValue(false);
    const res = await createLoginHandler(options)(makePostRequest('http://localhost/api/auth/login', { email: 'a@b.com', password: 'pw' }));
    expect(res.status).toBe(401);
  });
});

describe('passwordPolicy', () => {
  it('정책이 없으면 0.20 처럼 8자 미만을 Invalid input 으로 거부한다(legacy)', async () => {
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'legacy' }))(makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'short' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid input');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('설정형 정책 위반은 PASSWORD_TOO_WEAK — legacy 도 사유를 error·details 에 싣는다', async () => {
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'legacy', passwordPolicy: { requireUppercase: true } }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'lowercase1' }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('PASSWORD_TOO_WEAK');
    expect(json.error).toMatch(/uppercase/i);
    expect(json.details.fieldErrors.password).toEqual([json.error]);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('함수형 정책은 purpose·locale 을 받고, 사유가 standard 의 description 과 fieldErrors 가 된다', async () => {
    const policy = vi.fn().mockResolvedValue({ ok: false, message: '문자 3종 이상' });
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'standard', passwordPolicy: policy }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'abc' }),
    );
    expect(policy).toHaveBeenCalledWith('abc', expect.objectContaining({ purpose: 'register', locale: expect.any(String) }));
    const json = await res.json();
    expect(json.error.key).toBe('PASSWORD_TOO_WEAK');
    expect(json.error.userMessage.description).toBe('문자 3종 이상');
    expect(json.error.details.fieldErrors).toEqual({ password: ['문자 3종 이상'] });
  });

  it('정책이 있으면 최소 길이는 정책이 정한다(통과하면 8자 미만도 가입)', async () => {
    mockRegister.mockResolvedValue({ user: verifiedUser, verificationSent: false });
    const res = await createRegisterHandler(createMockOptions({ passwordPolicy: () => ({ ok: true }) }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'abc' }),
    );
    expect(res.status).toBe(201);
  });

  it('72바이트 제한은 정책과 별개로 적용된다 — 사유는 요청 로케일 문구로 PASSWORD_TOO_WEAK 에 실린다', async () => {
    const req = (lang: string) =>
      new Request('http://localhost/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'accept-language': lang },
        body: JSON.stringify({ email: 'a@b.com', password: '가'.repeat(25) }),
      }) as any;
    const handler = createRegisterHandler(createMockOptions({ errorFormat: 'standard', passwordPolicy: () => ({ ok: true }) }));

    const ko = await handler(req('ko-KR,ko;q=0.9'));
    expect(ko.status).toBe(400);
    const koJson = await ko.json();
    expect(koJson.error.key).toBe('PASSWORD_TOO_WEAK');
    expect(koJson.error.details.fieldErrors.password[0]).toMatch(/[가-힣]/);
    expect(koJson.error.details.fieldErrors.password[0]).not.toContain('cannot exceed');

    const ja = await (await handler(req('ja-JP,ja;q=0.9'))).json();
    expect(ja.error.userMessage.description).toMatch(/[ぁ-んァ-ン]/);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('소비자 정책이 길이 상한을 직접 판정하면 그 문구가 72바이트 기본 문구보다 우선한다', async () => {
    const res = await createRegisterHandler(
      createMockOptions({ passwordPolicy: (pw: string) => (pw.length > 20 ? { ok: false, message: '앱 문구' } : { ok: true }) }),
    )(makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: '가'.repeat(25) }));
    const json = await res.json();
    expect(json.error.key).toBe('PASSWORD_TOO_WEAK');
    expect(json.error.userMessage.description).toBe('앱 문구');
    expect(json.error.details.fieldErrors).toEqual({ password: ['앱 문구'] });
  });

  it('정책이 없으면 0.21.0 처럼 72바이트 초과는 스키마에서 Invalid input(legacy)', async () => {
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'legacy' }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: '가'.repeat(25) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid input');
  });

  it('reset-password 에도 같은 정책을 purpose reset 으로 적용한다', async () => {
    const policy = vi.fn().mockReturnValue({ ok: false, message: 'weak' });
    const res = await createResetPasswordHandler(createMockOptions({ passwordPolicy: policy }))(
      makePostRequest('http://localhost/api/auth/reset-password', { email: 'a@b.com', token: 't', password: 'abc' }),
    );
    expect(res.status).toBe(400);
    expect(policy).toHaveBeenCalledWith('abc', expect.objectContaining({ purpose: 'reset' }));
    expect(mockResetPassword).not.toHaveBeenCalled();
  });
});

describe('findEmailByToken', () => {
  const withLookup = (email: string | null) => {
    const options = createMockOptions({ dependencies: { ...createMockOptions().dependencies, emailSender: {} as any } });
    (options.dependencies.emailTokenRepository as any).findEmailByToken = vi.fn().mockResolvedValue(email);
    return options;
  };

  it('reset-password: email 이 없으면 토큰 해시로 찾아 서비스에 넘긴다', async () => {
    const options = withLookup('found@b.com');
    mockResetPassword.mockResolvedValue(undefined);
    const res = await createResetPasswordHandler(options)(makePostRequest('http://localhost/api/auth/reset-password', { token: 'plain', password: 'password123' }));
    expect(res.status).toBe(200);
    expect((options.dependencies.emailTokenRepository as any).findEmailByToken).toHaveBeenCalledWith(TokenGenerator.hash('plain'), 'PASSWORD_RESET');
    expect(mockResetPassword).toHaveBeenCalledWith('found@b.com', 'plain', 'password123');
  });

  it('reset-password: 토큰에 해당하는 행이 없으면 400 TOKEN_INVALID(서비스와 같은 key)', async () => {
    const res = await createResetPasswordHandler({ ...withLookup(null), errorFormat: 'standard' })(
      makePostRequest('http://localhost/api/auth/reset-password', { token: 'plain', password: 'password123' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.key).toBe('TOKEN_INVALID');
  });

  it('저장소가 조회를 지원하지 않으면 0.20 처럼 email 이 필수다(legacy)', async () => {
    const res = await createResetPasswordHandler(createMockOptions({ errorFormat: 'legacy' }))(
      makePostRequest('http://localhost/api/auth/reset-password', { token: 'plain', password: 'password123' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Invalid input' });
  });

  it('verify-email(GET): email 없이 토큰만 와도 찾아서 인증한다', async () => {
    const options = withLookup('found@b.com');
    mockVerifyEmail.mockResolvedValue(undefined);
    const res = await createVerifyEmailHandler(options)(makeRequest('http://localhost/api/auth/verify-email?token=plain'));
    expect(res.status).toBe(200);
    expect(mockVerifyEmail).toHaveBeenCalledWith('found@b.com', 'plain');
  });

  it('요청의 email 이 있으면 조회하지 않는다', async () => {
    const options = withLookup('other@b.com');
    mockVerifyEmail.mockResolvedValue(undefined);
    await createVerifyEmailHandler(options)(makePostRequest('http://localhost/api/auth/verify-email', { email: 'given@b.com', token: 'plain' }));
    expect((options.dependencies.emailTokenRepository as any).findEmailByToken).not.toHaveBeenCalled();
    expect(mockVerifyEmail).toHaveBeenCalledWith('given@b.com', 'plain');
  });
});

describe('signup', () => {
  const signupReq = (body: Record<string, unknown> = {}) =>
    makePostRequest('http://localhost/api/auth/signup', { email: 'test@example.com', password: 'password123', name: 'Test', ...body });

  it('createAuthHandlers 에 signup 이 있다', () => {
    expect(typeof createAuthHandlers(createMockOptions()).signup).toBe('function');
  });

  it('바로 로그인할 수 있으면 세션을 발급하고 201 + verificationSent false', async () => {
    mockRegister.mockResolvedValue({ user: verifiedUser, verificationSent: false });
    const options = createMockOptions();
    const res = await createSignupHandler(options)(signupReq());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual(expect.objectContaining({ success: true, verificationSent: false }));
    expect(json.user.id).toBe('u1');
    expect(mockCreateTokenPair).toHaveBeenCalled();
    expect(mockSetTokenCookies).toHaveBeenCalled();
    expect(options.dependencies.userRepository.updateLastLoginAt).toHaveBeenCalledWith('u1');
  });

  it('메일 인증이 필요하면 세션 없이 verificationSent 를 돌려준다', async () => {
    mockRegister.mockResolvedValue({ user: { ...verifiedUser, emailVerified: null }, verificationSent: true });
    const res = await createSignupHandler(createMockOptions())(signupReq());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, user: { id: 'u1', email: 'test@example.com', name: 'Test' }, verificationSent: true });
    expect(mockCreateTokenPair).not.toHaveBeenCalled();
  });

  it('signup.autoLogin false 면 세션을 발급하지 않는다', async () => {
    mockRegister.mockResolvedValue({ user: verifiedUser, verificationSent: false });
    const res = await createSignupHandler(createMockOptions({ signup: { autoLogin: false } }))(signupReq());
    expect(res.status).toBe(201);
    expect(mockCreateTokenPair).not.toHaveBeenCalled();
  });

  it('세션 발급이 실패해도 가입 성공(세션 없음)으로 폴백하고 로그를 남긴다', async () => {
    mockRegister.mockResolvedValue({ user: verifiedUser, verificationSent: false });
    mockCreateTokenPair.mockRejectedValue(new Error('jwt down'));
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const res = await createSignupHandler(createMockOptions({ dependencies: { ...createMockOptions().dependencies, logger } }))(signupReq());
    expect(res.status).toBe(201);
    expect((await res.json()).success).toBe(true);
    expect(mockSetTokenCookies).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it.each(['legacy', 'standard'] as const)('가입 실패는 register 와 같은 응답이다(%s)', async (errorFormat) => {
    mockRegister.mockRejectedValue(new AuthError('Email already in use', 'EMAIL_ALREADY_EXISTS', 409));
    const body = { email: 'test@example.com', password: 'password123', name: 'Test' };
    const res = await createSignupHandler(createMockOptions({ errorFormat }))(signupReq());
    const reg = await createRegisterHandler(createMockOptions({ errorFormat }))(makePostRequest('http://localhost/api/auth/register', body));
    expect(res.status).toBe(409);
    expect(reg.status).toBe(409);
    const strip = (j: any) => (typeof j.error === 'object' ? { ...j, error: { ...j.error, requestId: undefined } } : j);
    const json = await res.json();
    expect(strip(json)).toEqual(strip(await reg.json()));
    if (errorFormat === 'legacy') {
      expect(json).toEqual({ success: false, error: 'Email already in use', code: 'EMAIL_ALREADY_EXISTS' });
    } else {
      expect(json.error).toEqual(expect.objectContaining({ key: 'EMAIL_ALREADY_EXISTS', message: 'Email already in use' }));
    }
  });
});

describe('가입 훅 ctx', () => {
  it('onBeforeRegister 는 검증 전 원본 본문(추가 필드 포함)과 요청을 받고, Response 를 돌려주면 가입을 막는다', async () => {
    const onBeforeRegister = vi.fn().mockResolvedValue(new Response('{"success":false}', { status: 422 }));
    const res = await createSignupHandler(createMockOptions({ hooks: { onBeforeRegister } }))(
      makePostRequest('http://localhost/api/auth/signup', { email: 'a@b.com', password: 'password123', consent: true }),
    );
    expect(res.status).toBe(422);
    expect(onBeforeRegister).toHaveBeenCalledWith(
      { email: 'a@b.com', name: undefined },
      expect.objectContaining({ body: expect.objectContaining({ consent: true }), request: expect.anything() }),
    );
    expect(mockRegister).not.toHaveBeenCalled();
  });
});

describe('리뷰 반영 (0.21)', () => {
  const withLookup = (email: string | null, extra: Partial<AuthHandlerOptions> = {}) => {
    const options = createMockOptions({ dependencies: { ...createMockOptions().dependencies, emailSender: {} as any }, ...extra });
    (options.dependencies.emailTokenRepository as any).findEmailByToken = vi.fn().mockResolvedValue(email);
    return options;
  };

  it('verify-email(POST): 조회를 지원하지 않는 저장소에서 email 이 없으면 0.20 처럼 Invalid input(legacy)', async () => {
    const res = await createVerifyEmailHandler(createMockOptions({ errorFormat: 'legacy' }))(makePostRequest('http://localhost/api/auth/verify-email', { token: 'plain' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Invalid input' });
  });

  it('verify-email(GET): 같은 경우 0.20 처럼 Missing email or token(legacy)', async () => {
    const res = await createVerifyEmailHandler(createMockOptions({ errorFormat: 'legacy' }))(makeRequest('http://localhost/api/auth/verify-email?token=plain'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Missing email or token' });
  });

  it('verify-email 은 EMAIL_VERIFICATION 종류로 조회하고, 못 찾으면 400 TOKEN_INVALID + 링크 문구', async () => {
    const options = withLookup(null, { errorFormat: 'standard' });
    const res = await createVerifyEmailHandler(options)(makePostRequest('http://localhost/api/auth/verify-email', { token: 'plain' }));
    expect((options.dependencies.emailTokenRepository as any).findEmailByToken).toHaveBeenCalledWith(TokenGenerator.hash('plain'), 'EMAIL_VERIFICATION');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toEqual(expect.objectContaining({ key: 'TOKEN_INVALID', code: 40008 }));
    expect(json.error.userMessage.description).toBe('링크가 유효하지 않거나 만료되었습니다.');
  });

  it('서비스가 던진 TOKEN_INVALID 도 같은 key·문구로 응답하고, legacy 는 0.20 과 같다', async () => {
    mockResetPassword.mockRejectedValue(new AuthError('Invalid or expired token', 'TOKEN_INVALID', 400));
    const body = { email: 'a@b.com', token: 't', password: 'password123' };
    const deps = { ...createMockOptions().dependencies, emailSender: {} as any };
    const std = await createResetPasswordHandler(createMockOptions({ dependencies: deps, errorFormat: 'standard' }))(makePostRequest('http://localhost/x', body));
    expect((await std.json()).error).toEqual(expect.objectContaining({ key: 'TOKEN_INVALID', code: 40008 }));
    const legacy = await createResetPasswordHandler(createMockOptions({ dependencies: deps, errorFormat: 'legacy' }))(makePostRequest('http://localhost/x', body));
    expect(legacy.status).toBe(400);
    expect(await legacy.json()).toEqual({ success: false, error: 'Invalid or expired token' });
  });

  it('standard 의 AuthError 숫자 코드는 AUTH_ERROR_CODE_MAP 을 따른다', async () => {
    mockRegister.mockRejectedValue(new AuthError('Email already in use', 'EMAIL_ALREADY_EXISTS', 409));
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'standard' }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'password123' }),
    );
    const { ERROR_CODES } = await import('@withwiz/toolkit/core/constants/error-codes');
    expect((await res.json()).error.code).toBe(ERROR_CODES.EMAIL_ALREADY_EXISTS.code);
  });

  it('정책 함수와 사용자 문구는 요청 로케일(accept-language)을 따른다', async () => {
    const policy = vi.fn().mockReturnValue({ ok: true });
    mockRegister.mockRejectedValue(new AuthError('Email already in use', 'EMAIL_ALREADY_EXISTS', 409));
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'accept-language': 'en-US,en;q=0.9' },
      body: JSON.stringify({ email: 'a@b.com', password: 'password123' }),
    }) as any;
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'standard', passwordPolicy: policy }))(req);
    expect(policy).toHaveBeenCalledWith('password123', expect.objectContaining({ locale: 'en' }));
    const { getErrorMessage } = await import('@withwiz/toolkit/core/error/messages');
    const json = await res.json();
    expect(json.error.userMessage.description).toBe(getErrorMessage(json.error.code, 'en').description);
  });

  it('사유 없이 실패한 정책도 기본 문구를 싣는다', async () => {
    const res = await createRegisterHandler(createMockOptions({ passwordPolicy: () => ({ ok: false }) as any }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'abc' }),
    );
    const json = await res.json();
    expect(json.error.message).toBe('Password does not meet the policy');
    expect(json.error.userMessage.description).toBe('Password does not meet the policy');
  });

  it('훅 ctx.body 에는 평문 비밀번호가 없다', async () => {
    const onBeforeRegister = vi.fn().mockResolvedValue(undefined);
    mockRegister.mockResolvedValue({ user: verifiedUser, verificationSent: false });
    await createRegisterHandler(createMockOptions({ hooks: { onBeforeRegister } }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'password123', consent: true }),
    );
    const ctx = onBeforeRegister.mock.calls[0][1];
    expect(ctx.body).toEqual({ email: 'a@b.com', consent: true });
  });
});

describe('JSON 이 아닌 본문 (0.22)', () => {
  const rawPost = (body?: string) =>
    new Request('http://localhost/api/auth/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }) as any;

  // [이름, 핸들러 생성자, legacy 의 기존 검증 실패 문구]
  const cases = [
    ['signup', createSignupHandler, 'Invalid input'],
    ['register', createRegisterHandler, 'Invalid input'],
    ['login', createLoginHandler, 'Invalid input'],
    ['forgot-password', createForgotPasswordHandler, 'Invalid email'],
    ['reset-password', createResetPasswordHandler, 'Invalid input'],
    ['verify-email(POST)', createVerifyEmailHandler, 'Invalid input'],
    ['oauth-authorize', createOAuthAuthorizeHandler, 'Invalid input'],
  ] as const;

  it.each(cases)('%s: 파싱할 수 없는 본문은 500 이 아니라 400 VALIDATION_ERROR(기본 standard)', async (_name, create) => {
    const options = createMockOptions({ dependencies: { ...createMockOptions().dependencies, emailSender: {} as any } });
    for (const body of ['xx', '{"email":', undefined]) {
      const res = await (create as any)(options)(rawPost(body));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toEqual(expect.objectContaining({ key: 'VALIDATION_ERROR' }));
    }
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockRequestReset).not.toHaveBeenCalled();
    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(mockVerifyEmail).not.toHaveBeenCalled();
    expect(mockGetLoginUrl).not.toHaveBeenCalled();
  });

  it.each(cases)('%s: legacy 는 기존 검증 실패와 같은 문자열형 400 이다', async (_name, create, message) => {
    const options = createMockOptions({ errorFormat: 'legacy', dependencies: { ...createMockOptions().dependencies, emailSender: {} as any } });
    const res = await (create as any)(options)(rawPost('xx'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe(message);
  });

  it('oauth-authorize: JSON 이지만 객체가 아닌 본문(null)은 400 OAUTH_PROVIDER_INVALID', async () => {
    const res = await createOAuthAuthorizeHandler(createMockOptions())(rawPost('null'));
    expect(res.status).toBe(400);
    expect((await res.json()).error.key).toBe('OAUTH_PROVIDER_INVALID');
  });
});

describe('0.22 — OAuth provider 는 설정의 자기 속성만 인정한다', () => {
  const oauth = { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost:3000/cb' } };

  it.each(['__proto__', 'constructor', 'toString'])('oauth-authorize: provider=%s 는 400 OAUTH_PROVIDER_INVALID', async (provider) => {
    const res = await createOAuthAuthorizeHandler(createMockOptions({ oauth }))(
      makeRequest('http://localhost:3000/api/auth/oauth', { method: 'POST', body: JSON.stringify({ provider }) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.key).toBe('OAUTH_PROVIDER_INVALID');
  });

  it.each(['__proto__', 'constructor'])('oauth-callback: provider=%s 는 400 OAUTH_CALLBACK_INVALID', async (provider) => {
    const res = await createOAuthCallbackHandler(createMockOptions({ oauth }))(
      makeRequest(`http://localhost:3000/api/auth/callback?code=c&state=s&provider=${provider}`),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.key).toBe('OAUTH_CALLBACK_INVALID');
  });
});

describe('fieldErrors 로케일 (0.22.1)', () => {
  const post = (url: string, body: unknown, lang: string): any =>
    new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'accept-language': lang },
      body: JSON.stringify(body),
    });

  it('ko 요청의 스키마 검증 사유는 한국어 문구다', async () => {
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'standard' }))(
      post('http://localhost/api/auth/register', { email: 'not-an-email', password: 'short' }, 'ko-KR,ko;q=0.9'),
    );
    expect(res.status).toBe(400);
    const { fieldErrors } = (await res.json()).error.details;
    expect(fieldErrors).toEqual({
      email: ['올바른 이메일 주소를 입력해 주세요.'],
      password: ['8자 이상 입력해 주세요.'],
    });
  });

  it('값이 없는 필드는 필수 문구, ja 요청은 일본어 문구다', async () => {
    const res = await createLoginHandler(createMockOptions({ errorFormat: 'standard' }))(
      post('http://localhost/api/auth/login', { password: '' }, 'ja'),
    );
    const { fieldErrors } = (await res.json()).error.details;
    expect(fieldErrors).toEqual({ email: ['必須項目です。'], password: ['必須項目です。'] });
  });

  it('정책이 없을 때 72바이트 초과 사유도 요청 로케일 문구다', async () => {
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'standard' }))(
      post('http://localhost/api/auth/register', { email: 'a@b.com', password: '가'.repeat(25) }, 'ko'),
    );
    const { fieldErrors } = (await res.json()).error.details;
    expect(fieldErrors.password[0]).toMatch(/^비밀번호가 너무 깁니다/);
  });

  it('en 요청은 zod 문구를 그대로 쓴다(0.22.0 과 같다)', async () => {
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'standard' }))(
      post('http://localhost/api/auth/register', { email: 'not-an-email', password: '가'.repeat(25) }, 'en-US'),
    );
    const { fieldErrors } = (await res.json()).error.details;
    expect(fieldErrors).toEqual({ email: ['Invalid email'], password: ['Password cannot exceed 72 bytes'] });
  });

  it('토큰으로 email 을 보완할 수 없을 때의 필수 사유도 요청 로케일 문구다', async () => {
    const res = await createVerifyEmailHandler(createMockOptions({ errorFormat: 'standard' }))(
      post('http://localhost/api/auth/verify-email', { token: 'plain' }, 'ko'),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.details.fieldErrors).toEqual({ email: ['필수 입력 항목입니다.'] });
  });

  it('legacy 본문의 details 는 ko 요청에서도 zod 문구 그대로다', async () => {
    const res = await createRegisterHandler(createMockOptions({ errorFormat: 'legacy' }))(
      post('http://localhost/api/auth/register', { email: 'not-an-email', password: 'password123' }, 'ko'),
    );
    expect(await res.json()).toEqual({
      success: false,
      error: 'Invalid input',
      details: { formErrors: [], fieldErrors: { email: ['Invalid email'] } },
    });
  });
});
