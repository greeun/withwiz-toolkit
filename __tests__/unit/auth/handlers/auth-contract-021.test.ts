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
  it('기본(legacy)은 0.20 과 같은 문자열형 본문이다', async () => {
    const options = createMockOptions({ features: { emailVerificationRequired: true } });
    (options.dependencies.userRepository.findByEmail as any).mockResolvedValue({ ...verifiedUser, emailVerified: null, password: 'h' });
    mockCompare.mockResolvedValue(true);
    const res = await createLoginHandler(options)(makePostRequest('http://localhost/api/auth/login', { email: 'test@example.com', password: 'pw' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ success: false, error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
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
  it('정책이 없으면 0.20 처럼 8자 미만을 Invalid input 으로 거부한다', async () => {
    const res = await createRegisterHandler(createMockOptions())(makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: 'short' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid input');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('설정형 정책 위반은 PASSWORD_TOO_WEAK — legacy 도 사유를 error·details 에 싣는다', async () => {
    const res = await createRegisterHandler(createMockOptions({ passwordPolicy: { requireUppercase: true } }))(
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

  it('72바이트 제한은 정책과 별개로 적용된다', async () => {
    const res = await createRegisterHandler(createMockOptions({ passwordPolicy: () => ({ ok: true }) }))(
      makePostRequest('http://localhost/api/auth/register', { email: 'a@b.com', password: '가'.repeat(25) }),
    );
    expect(res.status).toBe(400);
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

  it('저장소가 조회를 지원하지 않으면 0.20 처럼 email 이 필수다', async () => {
    const res = await createResetPasswordHandler(createMockOptions())(
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

  it('가입 실패는 register 와 같은 응답이다', async () => {
    mockRegister.mockRejectedValue(new AuthError('Email already in use', 'EMAIL_ALREADY_EXISTS', 409));
    const res = await createSignupHandler(createMockOptions())(signupReq());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, error: 'Email already in use', code: 'EMAIL_ALREADY_EXISTS' });
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

  it('verify-email(POST): 조회를 지원하지 않는 저장소에서 email 이 없으면 0.20 처럼 Invalid input', async () => {
    const res = await createVerifyEmailHandler(createMockOptions())(makePostRequest('http://localhost/api/auth/verify-email', { token: 'plain' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Invalid input' });
  });

  it('verify-email(GET): 같은 경우 0.20 처럼 Missing email or token', async () => {
    const res = await createVerifyEmailHandler(createMockOptions())(makeRequest('http://localhost/api/auth/verify-email?token=plain'));
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
    const legacy = await createResetPasswordHandler(createMockOptions({ dependencies: deps }))(makePostRequest('http://localhost/x', body));
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
    expect((await res.json()).error).toBe('Password does not meet the policy');
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
