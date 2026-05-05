import { AuthError } from '../../../../src/auth/errors';
import type { AuthHandlerOptions } from '../../../../src/auth/types/handler-types';

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
vi.mock('../../../../src/auth/core/jwt', () => ({
  JWTService: vi.fn().mockImplementation(function (this: any) {
    this.createTokenPair = mockCreateTokenPair;
    this.verifyAccessToken = mockVerifyAccessToken;
    this.extractTokenFromHeader = mockExtractTokenFromHeader;
  }),
}));

const mockSetTokenCookies = vi.fn();
const mockClearTokenCookies = vi.fn();
vi.mock('../../../../src/auth/core/jwt/cookie', () => ({
  setTokenCookies: (...args: any[]) => mockSetTokenCookies(...args),
  clearTokenCookies: (...args: any[]) => mockClearTokenCookies(...args),
}));

const mockRegister = vi.fn();
vi.mock('../../../../src/auth/services/register.service', () => ({
  RegisterService: vi.fn().mockImplementation(function (this: any) {
    this.register = mockRegister;
  }),
}));

const mockRefresh = vi.fn();
vi.mock('../../../../src/auth/services/token-refresh.service', () => ({
  TokenRefreshService: vi.fn().mockImplementation(function (this: any) {
    this.refresh = mockRefresh;
  }),
}));

const mockRequestReset = vi.fn();
const mockResetPassword = vi.fn();
vi.mock('../../../../src/auth/services/password-reset.service', () => ({
  PasswordResetService: vi.fn().mockImplementation(function (this: any) {
    this.requestReset = mockRequestReset;
    this.resetPassword = mockResetPassword;
  }),
}));

const mockVerifyEmail = vi.fn();
vi.mock('../../../../src/auth/services/email-verification.service', () => ({
  EmailVerificationService: vi.fn().mockImplementation(function (this: any) {
    this.verify = mockVerifyEmail;
  }),
}));

const mockGetLoginUrl = vi.fn();
const mockExchangeCodeForToken = vi.fn();
const mockGetUserInfo = vi.fn();
vi.mock('../../../../src/auth/core/oauth', () => ({
  OAuthManager: vi.fn().mockImplementation(function (this: any) {
    this.getLoginUrl = mockGetLoginUrl;
    this.exchangeCodeForToken = mockExchangeCodeForToken;
    this.getUserInfo = mockGetUserInfo;
  }),
}));

const mockHandleCallback = vi.fn();
vi.mock('../../../../src/auth/services/oauth-callback.service', () => ({
  OAuthCallbackService: vi.fn().mockImplementation(function (this: any) {
    this.handleCallback = mockHandleCallback;
  }),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { createLoginHandler } from '../../../../src/auth/handlers/login.handler';
import { createRegisterHandler } from '../../../../src/auth/handlers/register.handler';
import { createLogoutHandler } from '../../../../src/auth/handlers/logout.handler';
import { createRefreshHandler } from '../../../../src/auth/handlers/refresh.handler';
import { createMeHandler } from '../../../../src/auth/handlers/me.handler';
import { createForgotPasswordHandler } from '../../../../src/auth/handlers/forgot-password.handler';
import { createResetPasswordHandler } from '../../../../src/auth/handlers/reset-password.handler';
import { createVerifyEmailHandler } from '../../../../src/auth/handlers/verify-email.handler';
import { createOAuthAuthorizeHandler } from '../../../../src/auth/handlers/oauth-authorize.handler';
import { createOAuthCallbackHandler } from '../../../../src/auth/handlers/oauth-callback.handler';
import { createAuthHandlers } from '../../../../src/auth/handlers';

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

describe('Auth Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // createAuthHandlers (integration)
  // ==========================================================================
  describe('createAuthHandlers', () => {
    it('should return all handler functions', () => {
      const handlers = createAuthHandlers(createMockOptions());
      expect(typeof handlers.login).toBe('function');
      expect(typeof handlers.register).toBe('function');
      expect(typeof handlers.logout).toBe('function');
      expect(typeof handlers.refresh).toBe('function');
      expect(typeof handlers.me).toBe('function');
      expect(typeof handlers.oauthAuthorize).toBe('function');
      expect(typeof handlers.oauthCallback).toBe('function');
      expect(typeof handlers.forgotPassword).toBe('function');
      expect(typeof handlers.resetPassword).toBe('function');
      expect(typeof handlers.verifyEmail).toBe('function');
    });
  });

  // ==========================================================================
  // Login Handler
  // ==========================================================================
  describe('createLoginHandler', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      password: '$2a$12$hashedpassword',
      isActive: true,
      emailVerified: new Date('2024-01-01'),
    };

    it('should return 400 for invalid input (missing email)', async () => {
      const options = createMockOptions();
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', { password: 'test123' });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid input');
    });

    it('should return 400 for invalid input (missing password)', async () => {
      const options = createMockOptions();
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', { email: 'test@example.com' });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid input (invalid email format)', async () => {
      const options = createMockOptions();
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'not-an-email',
        password: 'test123',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty body', async () => {
      const options = createMockOptions();
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {});

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    it('should return 401 when user is not found', async () => {
      const options = createMockOptions();
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(null);
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'notfound@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should return 401 when user has no password (OAuth-only account)', async () => {
      const options = createMockOptions();
      const userWithoutPassword = { ...mockUser, password: undefined };
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(userWithoutPassword);
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should return 401 when password does not match', async () => {
      const options = createMockOptions();
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(false);
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should return 403 when account is disabled (isActive === false)', async () => {
      const options = createMockOptions();
      const disabledUser = { ...mockUser, isActive: false };
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(disabledUser);
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Account disabled');
    });

    it('should return 403 when emailVerificationRequired and email is not verified', async () => {
      const options = createMockOptions({
        features: { emailVerificationRequired: true },
      });
      const unverifiedUser = { ...mockUser, emailVerified: null };
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(unverifiedUser);
      mockCompare.mockResolvedValue(true);
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Email not verified');
      expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('should return 200 with tokens on successful login', async () => {
      const options = createMockOptions();
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(mockUser);
      (options.dependencies.userRepository.updateLastLoginAt as any).mockResolvedValue(undefined);
      mockCompare.mockResolvedValue(true);
      mockCreateTokenPair.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
      expect(body.tokens.accessToken).toBe('access-token-123');
      expect(body.tokens.refreshToken).toBe('refresh-token-456');
      expect(body.user.id).toBe('user-1');
      expect(body.user.email).toBe('test@example.com');
      expect(mockSetTokenCookies).toHaveBeenCalled();
      expect(options.dependencies.userRepository.updateLastLoginAt).toHaveBeenCalledWith('user-1');
    });

    it('should return 403 when allowEmail hook returns false', async () => {
      const options = createMockOptions({
        hooks: {
          allowEmail: vi.fn().mockResolvedValue(false),
        },
      });
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'blocked@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Email not allowed');
    });

    it('should return custom Response when onBeforeLogin hook returns a Response', async () => {
      const customResponse = new Response(JSON.stringify({ custom: true }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
      const options = createMockOptions({
        hooks: {
          onBeforeLogin: vi.fn().mockResolvedValue(customResponse),
        },
      });
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(429);
      const body = await parseJsonResponse(res);
      expect(body.custom).toBe(true);
    });

    it('should call onAfterLogin hook after successful login', async () => {
      const onAfterLogin = vi.fn().mockResolvedValue(undefined);
      const options = createMockOptions({
        hooks: { onAfterLogin },
      });
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(mockUser);
      (options.dependencies.userRepository.updateLastLoginAt as any).mockResolvedValue(undefined);
      mockCompare.mockResolvedValue(true);
      mockCreateTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      await handler(req);
      expect(onAfterLogin).toHaveBeenCalledWith(mockUser, expect.anything());
    });

    it('should include extended user response when extendUserResponse hook is provided', async () => {
      const options = createMockOptions({
        hooks: {
          extendUserResponse: vi.fn().mockResolvedValue({ avatar: 'avatar-url', plan: 'pro' }),
        },
      });
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(mockUser);
      (options.dependencies.userRepository.updateLastLoginAt as any).mockResolvedValue(undefined);
      mockCompare.mockResolvedValue(true);
      mockCreateTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      const body = await parseJsonResponse(res);
      expect(body.user.avatar).toBe('avatar-url');
      expect(body.user.plan).toBe('pro');
    });

    it('should return 500 when unexpected error occurs', async () => {
      const options = createMockOptions();
      (options.dependencies.userRepository.findByEmail as any).mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockCreateTokenPair.mockRejectedValue(new Error('Unexpected'));
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Internal server error');
    });

    it('should return AuthError status when AuthError is thrown', async () => {
      const options = createMockOptions();
      (options.dependencies.userRepository.findByEmail as any).mockRejectedValue(
        new AuthError('Custom auth error', 'CUSTOM_CODE', 422),
      );
      const handler = createLoginHandler(options);
      const req = makePostRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(422);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Custom auth error');
      expect(body.code).toBe('CUSTOM_CODE');
    });
  });

  // ==========================================================================
  // Register Handler
  // ==========================================================================
  describe('createRegisterHandler', () => {
    it('should return 400 for invalid input (missing email)', async () => {
      const options = createMockOptions();
      const handler = createRegisterHandler(options);
      const req = makePostRequest('http://localhost/api/auth/register', {
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid input');
      expect(body.details).toBeDefined();
    });

    it('should return 400 for password too short (< 8 chars)', async () => {
      const options = createMockOptions();
      const handler = createRegisterHandler(options);
      const req = makePostRequest('http://localhost/api/auth/register', {
        email: 'test@example.com',
        password: 'short',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    it('should return 403 when allowEmail hook returns false', async () => {
      const options = createMockOptions({
        hooks: { allowEmail: vi.fn().mockResolvedValue(false) },
      });
      const handler = createRegisterHandler(options);
      const req = makePostRequest('http://localhost/api/auth/register', {
        email: 'blocked@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Email not allowed');
    });

    it('should return custom Response when onBeforeRegister hook returns a Response', async () => {
      const customResponse = new Response(JSON.stringify({ blocked: true }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
      const options = createMockOptions({
        hooks: { onBeforeRegister: vi.fn().mockResolvedValue(customResponse) },
      });
      const handler = createRegisterHandler(options);
      const req = makePostRequest('http://localhost/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(409);
    });

    it('should return 201 on successful registration', async () => {
      const options = createMockOptions();
      mockRegister.mockResolvedValue({
        user: { id: 'new-user', email: 'new@example.com', name: 'New User' },
        verificationSent: true,
      });
      const handler = createRegisterHandler(options);
      const req = makePostRequest('http://localhost/api/auth/register', {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      const res = await handler(req);
      expect(res.status).toBe(201);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
      expect(body.user.id).toBe('new-user');
      expect(body.user.email).toBe('new@example.com');
      expect(body.verificationSent).toBe(true);
    });

    it('should call onAfterRegister hook after successful registration', async () => {
      const onAfterRegister = vi.fn().mockResolvedValue(undefined);
      const options = createMockOptions({
        hooks: { onAfterRegister },
      });
      mockRegister.mockResolvedValue({
        user: { id: 'u1', email: 'test@example.com', name: 'Test' },
        verificationSent: false,
      });
      const handler = createRegisterHandler(options);
      const req = makePostRequest('http://localhost/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
      });

      await handler(req);
      expect(onAfterRegister).toHaveBeenCalledWith({ id: 'u1', email: 'test@example.com', name: 'Test' });
    });

    it('should return AuthError status when RegisterService throws AuthError', async () => {
      const options = createMockOptions();
      mockRegister.mockRejectedValue(new AuthError('Email already exists', 'EMAIL_ALREADY_EXISTS', 409));
      const handler = createRegisterHandler(options);
      const req = makePostRequest('http://localhost/api/auth/register', {
        email: 'existing@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(409);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Email already exists');
      expect(body.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should return 500 on unexpected error', async () => {
      const options = createMockOptions();
      mockRegister.mockRejectedValue(new Error('DB connection failed'));
      const handler = createRegisterHandler(options);
      const req = makePostRequest('http://localhost/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Internal server error');
    });
  });

  // ==========================================================================
  // Logout Handler
  // ==========================================================================
  describe('createLogoutHandler', () => {
    it('should return 200 and clear cookies', async () => {
      const options = createMockOptions();
      const handler = createLogoutHandler(options);
      const req = makeRequest('http://localhost/api/auth/logout', { method: 'POST' });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
      expect(mockClearTokenCookies).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Me Handler
  // ==========================================================================
  describe('createMeHandler', () => {
    const mockUser = {
      id: 'user-1',
      email: 'me@example.com',
      name: 'Me User',
      role: 'USER',
      isActive: true,
      emailVerified: new Date('2024-01-01'),
    };

    it('should return 401 when no token is present (no cookie, no authorization header)', async () => {
      const options = createMockOptions();
      mockExtractTokenFromHeader.mockReturnValue(null);
      const handler = createMeHandler(options);
      // Request without Cookie header and without Authorization header
      const req = new Request('http://localhost/api/auth/me', {
        method: 'GET',
      }) as any;
      req.cookies = { get: () => undefined };

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Not authenticated');
    });

    it('should return 401 when user is not found', async () => {
      const options = createMockOptions();
      mockExtractTokenFromHeader.mockReturnValue(null);
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-1', email: 'me@example.com', role: 'USER' });
      (options.dependencies.userRepository.findById as any).mockResolvedValue(null);
      const handler = createMeHandler(options);
      const req = makeRequestWithCookies('http://localhost/api/auth/me', { access_token: 'valid-token' }, { method: 'GET' });

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('User not found');
    });

    it('should return 401 when user is inactive', async () => {
      const options = createMockOptions();
      mockExtractTokenFromHeader.mockReturnValue(null);
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-1', email: 'me@example.com', role: 'USER' });
      (options.dependencies.userRepository.findById as any).mockResolvedValue({ ...mockUser, isActive: false });
      const handler = createMeHandler(options);
      const req = makeRequestWithCookies('http://localhost/api/auth/me', { access_token: 'valid-token' }, { method: 'GET' });

      const res = await handler(req);
      expect(res.status).toBe(401);
    });

    it('should return 200 with user data on valid token from cookie', async () => {
      const options = createMockOptions();
      mockExtractTokenFromHeader.mockReturnValue(null);
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-1', email: 'me@example.com', role: 'USER' });
      (options.dependencies.userRepository.findById as any).mockResolvedValue(mockUser);
      const handler = createMeHandler(options);
      const req = makeRequestWithCookies('http://localhost/api/auth/me', { access_token: 'valid-token' }, { method: 'GET' });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
      expect(body.user.id).toBe('user-1');
      expect(body.user.email).toBe('me@example.com');
      expect(body.user.name).toBe('Me User');
      expect(body.user.role).toBe('USER');
    });

    it('should extract token from Authorization header when no cookie', async () => {
      const options = createMockOptions();
      mockExtractTokenFromHeader.mockReturnValue('bearer-token');
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-1', email: 'me@example.com', role: 'USER' });
      (options.dependencies.userRepository.findById as any).mockResolvedValue(mockUser);
      const handler = createMeHandler(options);
      const req = new Request('http://localhost/api/auth/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer bearer-token' },
      }) as any;
      req.cookies = { get: () => undefined };

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.user.id).toBe('user-1');
    });

    it('should include extended fields from extendUserResponse hook', async () => {
      const options = createMockOptions({
        hooks: {
          extendUserResponse: vi.fn().mockResolvedValue({ subscription: 'premium', avatar: 'url' }),
        },
      });
      mockExtractTokenFromHeader.mockReturnValue('token');
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-1', email: 'me@example.com', role: 'USER' });
      (options.dependencies.userRepository.findById as any).mockResolvedValue(mockUser);
      const handler = createMeHandler(options);
      const req = new Request('http://localhost/api/auth/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      }) as any;
      req.cookies = { get: () => undefined };

      const res = await handler(req);
      const body = await parseJsonResponse(res);
      expect(body.user.subscription).toBe('premium');
      expect(body.user.avatar).toBe('url');
    });

    it('should return 401 when token verification throws', async () => {
      const options = createMockOptions();
      mockExtractTokenFromHeader.mockReturnValue('invalid-token');
      mockVerifyAccessToken.mockRejectedValue(new Error('Token invalid'));
      const handler = createMeHandler(options);
      const req = new Request('http://localhost/api/auth/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      }) as any;
      req.cookies = { get: () => undefined };

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Not authenticated');
    });
  });

  // ==========================================================================
  // Refresh Handler
  // ==========================================================================
  describe('createRefreshHandler', () => {
    it('should return 401 when no refresh_token cookie is present', async () => {
      const options = createMockOptions();
      const handler = createRefreshHandler(options);
      const req = new Request('http://localhost/api/auth/refresh', {
        method: 'POST',
      }) as any;
      req.cookies = { get: () => undefined };

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('No refresh token');
    });

    it('should return 200 with new access token on successful refresh', async () => {
      const options = createMockOptions();
      mockRefresh.mockResolvedValue({
        accessToken: 'new-access-token',
        user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
      });
      const handler = createRefreshHandler(options);
      const req = makeRequestWithCookies(
        'http://localhost/api/auth/refresh',
        { refresh_token: 'valid-refresh-token' },
        { method: 'POST' },
      );

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
      expect(body.accessToken).toBe('new-access-token');
      expect(body.user.id).toBe('user-1');
      expect(mockSetTokenCookies).toHaveBeenCalled();
    });

    it('should return AuthError status when TokenRefreshService throws AuthError', async () => {
      const options = createMockOptions();
      mockRefresh.mockRejectedValue(new AuthError('Token blacklisted', 'TOKEN_INVALID', 401));
      const handler = createRefreshHandler(options);
      const req = makeRequestWithCookies(
        'http://localhost/api/auth/refresh',
        { refresh_token: 'blacklisted-token' },
        { method: 'POST' },
      );

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Token blacklisted');
      expect(body.code).toBe('TOKEN_INVALID');
    });

    it('should return 401 on generic error', async () => {
      const options = createMockOptions();
      mockRefresh.mockRejectedValue(new Error('Network error'));
      const handler = createRefreshHandler(options);
      const req = makeRequestWithCookies(
        'http://localhost/api/auth/refresh',
        { refresh_token: 'some-token' },
        { method: 'POST' },
      );

      const res = await handler(req);
      expect(res.status).toBe(401);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Token refresh failed');
    });

    it('should return custom Response when onBeforeTokenRefresh hook returns a Response', async () => {
      const customResponse = new Response(JSON.stringify({ rateLimited: true }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
      const options = createMockOptions({
        hooks: { onBeforeTokenRefresh: vi.fn().mockResolvedValue(customResponse) },
      });
      const handler = createRefreshHandler(options);
      const req = makeRequestWithCookies(
        'http://localhost/api/auth/refresh',
        { refresh_token: 'valid-token' },
        { method: 'POST' },
      );

      const res = await handler(req);
      expect(res.status).toBe(429);
    });
  });

  // ==========================================================================
  // Forgot Password Handler
  // ==========================================================================
  describe('createForgotPasswordHandler', () => {
    it('should return 400 for invalid email', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      const handler = createForgotPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/forgot-password', {
        email: 'not-an-email',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid email');
    });

    it('should return 500 when emailSender is not configured', async () => {
      const options = createMockOptions();
      // emailSender is not set (undefined by default)
      const handler = createForgotPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/forgot-password', {
        email: 'test@example.com',
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Email service not configured');
    });

    it('should return 200 on valid email (prevent enumeration)', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockRequestReset.mockResolvedValue(undefined);
      const handler = createForgotPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/forgot-password', {
        email: 'test@example.com',
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
    });

    it('should return 200 even when service throws (silent fail for enumeration prevention)', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockRequestReset.mockRejectedValue(new Error('User not found'));
      const handler = createForgotPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/forgot-password', {
        email: 'nonexistent@example.com',
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
    });
  });

  // ==========================================================================
  // Reset Password Handler
  // ==========================================================================
  describe('createResetPasswordHandler', () => {
    it('should return 400 for invalid input (missing fields)', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      const handler = createResetPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/reset-password', {
        email: 'test@example.com',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid input');
    });

    it('should return 400 for password too short', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      const handler = createResetPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/reset-password', {
        email: 'test@example.com',
        token: 'reset-token',
        password: 'short',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    it('should return 500 when emailSender is not configured', async () => {
      const options = createMockOptions();
      const handler = createResetPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/reset-password', {
        email: 'test@example.com',
        token: 'reset-token',
        password: 'newpassword123',
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Email service not configured');
    });

    it('should return 200 on successful password reset', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockResetPassword.mockResolvedValue(undefined);
      const handler = createResetPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/reset-password', {
        email: 'test@example.com',
        token: 'valid-reset-token',
        password: 'newpassword123',
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
    });

    it('should return AuthError status when service throws AuthError', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockResetPassword.mockRejectedValue(new AuthError('Token invalid', 'TOKEN_INVALID', 400));
      const handler = createResetPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/reset-password', {
        email: 'test@example.com',
        token: 'expired-token',
        password: 'newpassword123',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Token invalid');
    });

    it('should return 500 on unexpected error', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockResetPassword.mockRejectedValue(new Error('DB error'));
      const handler = createResetPasswordHandler(options);
      const req = makePostRequest('http://localhost/api/auth/reset-password', {
        email: 'test@example.com',
        token: 'valid-token',
        password: 'newpassword123',
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Reset failed');
    });
  });

  // ==========================================================================
  // Verify Email Handler
  // ==========================================================================
  describe('createVerifyEmailHandler', () => {
    it('should return 400 for invalid POST input', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      const handler = createVerifyEmailHandler(options);
      const req = makePostRequest('http://localhost/api/auth/verify-email', {
        email: 'not-an-email',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid input');
    });

    it('should return 400 for missing email/token in GET request', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      const handler = createVerifyEmailHandler(options);
      const req = new Request('http://localhost/api/auth/verify-email', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Missing email or token');
    });

    it('should return 400 for GET with only email (no token)', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      const handler = createVerifyEmailHandler(options);
      const req = new Request('http://localhost/api/auth/verify-email?email=test@example.com', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Missing email or token');
    });

    it('should return 500 when emailSender is not configured', async () => {
      const options = createMockOptions();
      // emailSender not set
      const handler = createVerifyEmailHandler(options);
      const req = makePostRequest('http://localhost/api/auth/verify-email', {
        email: 'test@example.com',
        token: 'verify-token',
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Email service not configured');
    });

    it('should return 200 on successful email verification via POST', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockVerifyEmail.mockResolvedValue(undefined);
      const handler = createVerifyEmailHandler(options);
      const req = makePostRequest('http://localhost/api/auth/verify-email', {
        email: 'test@example.com',
        token: 'valid-token',
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
    });

    it('should return 200 on successful email verification via GET with query params', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockVerifyEmail.mockResolvedValue(undefined);
      const handler = createVerifyEmailHandler(options);
      const req = new Request(
        'http://localhost/api/auth/verify-email?email=test@example.com&token=valid-token',
        { method: 'GET' },
      ) as any;

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
    });

    it('should return AuthError status when verification service throws AuthError', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockVerifyEmail.mockRejectedValue(new AuthError('Invalid or expired verification token', 'TOKEN_INVALID', 400));
      const handler = createVerifyEmailHandler(options);
      const req = makePostRequest('http://localhost/api/auth/verify-email', {
        email: 'test@example.com',
        token: 'expired-token',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid or expired verification token');
    });

    it('should return 500 on unexpected error', async () => {
      const options = createMockOptions();
      options.dependencies.emailSender = { send: vi.fn() } as any;
      mockVerifyEmail.mockRejectedValue(new Error('DB error'));
      const handler = createVerifyEmailHandler(options);
      const req = makePostRequest('http://localhost/api/auth/verify-email', {
        email: 'test@example.com',
        token: 'some-token',
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Verification failed');
    });
  });

  // ==========================================================================
  // OAuth Authorize Handler
  // ==========================================================================
  describe('createOAuthAuthorizeHandler', () => {
    it('should return 400 when no provider is specified', async () => {
      const options = createMockOptions({
        oauth: { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/callback' } },
      });
      const handler = createOAuthAuthorizeHandler(options);
      const req = makePostRequest('http://localhost/api/auth/oauth/authorize', {});

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid provider');
    });

    it('should return 400 when provider is not configured', async () => {
      const options = createMockOptions({
        oauth: { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/callback' } },
      });
      const handler = createOAuthAuthorizeHandler(options);
      const req = makePostRequest('http://localhost/api/auth/oauth/authorize', {
        provider: 'facebook',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid provider');
    });

    it('should return 400 when oauth config is not defined at all', async () => {
      const options = createMockOptions(); // no oauth property
      const handler = createOAuthAuthorizeHandler(options);
      const req = makePostRequest('http://localhost/api/auth/oauth/authorize', {
        provider: 'google',
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    it('should return 200 with loginUrl and state on valid provider', async () => {
      const options = createMockOptions({
        oauth: { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/callback' } },
      });
      mockGetLoginUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?...');
      const handler = createOAuthAuthorizeHandler(options);
      const req = makePostRequest('http://localhost/api/auth/oauth/authorize', {
        provider: 'google',
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = await parseJsonResponse(res);
      expect(body.success).toBe(true);
      expect(body.loginUrl).toBe('https://accounts.google.com/o/oauth2/auth?...');
      expect(body.state).toBeDefined();
      expect(typeof body.state).toBe('string');
    });

    it('should return 500 when OAuthManager throws', async () => {
      const options = createMockOptions({
        oauth: { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/callback' } },
      });
      mockGetLoginUrl.mockImplementation(() => {
        throw new Error('Provider setup failed');
      });
      const handler = createOAuthAuthorizeHandler(options);
      const req = makePostRequest('http://localhost/api/auth/oauth/authorize', {
        provider: 'google',
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('OAuth initialization failed');
    });
  });

  // ==========================================================================
  // OAuth Callback Handler
  // ==========================================================================
  describe('createOAuthCallbackHandler', () => {
    const oauthOptions = {
      oauth: {
        google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/callback' },
      },
    };

    it('should return 400 when code is missing', async () => {
      const options = createMockOptions(oauthOptions);
      const handler = createOAuthCallbackHandler(options);
      // URL without code
      const req = new Request('http://localhost/api/auth/oauth/callback?provider=google', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid callback');
    });

    it('should return 400 when provider is missing or not configured', async () => {
      const options = createMockOptions(oauthOptions);
      const handler = createOAuthCallbackHandler(options);
      const req = new Request('http://localhost/api/auth/oauth/callback?code=abc123&provider=facebook', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Invalid callback');
    });

    it('should return redirect response on successful OAuth callback', async () => {
      const options = createMockOptions(oauthOptions);
      mockExchangeCodeForToken.mockResolvedValue('oauth-access-token');
      mockGetUserInfo.mockResolvedValue({
        id: 'google-user-id',
        email: 'oauth@example.com',
        name: 'OAuth User',
        image: 'https://photo.url',
      });
      mockHandleCallback.mockResolvedValue({
        user: { id: 'user-1', email: 'oauth@example.com', name: 'OAuth User', role: 'USER' },
        tokens: { accessToken: 'at', refreshToken: 'rt' },
        isNewUser: false,
      });
      const handler = createOAuthCallbackHandler(options);
      const req = new Request('http://localhost/api/auth/oauth/callback?code=abc123&provider=google', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      // Should redirect (307 or 302)
      expect(res.status).toBe(307);
      expect(mockSetTokenCookies).toHaveBeenCalled();
    });

    it('should return 403 when allowEmail hook blocks the email', async () => {
      const options = createMockOptions({
        ...oauthOptions,
        hooks: { allowEmail: vi.fn().mockResolvedValue(false) },
      });
      mockExchangeCodeForToken.mockResolvedValue('oauth-access-token');
      mockGetUserInfo.mockResolvedValue({
        id: 'google-user-id',
        email: 'blocked@example.com',
        name: 'Blocked User',
        image: null,
      });
      const handler = createOAuthCallbackHandler(options);
      const req = new Request('http://localhost/api/auth/oauth/callback?code=abc123&provider=google', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(403);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Email not allowed');
    });

    it('should return AuthError status when callbackService throws AuthError', async () => {
      const options = createMockOptions(oauthOptions);
      mockExchangeCodeForToken.mockResolvedValue('oauth-access-token');
      mockGetUserInfo.mockResolvedValue({
        id: 'google-user-id',
        email: 'user@example.com',
        name: 'User',
        image: null,
      });
      mockHandleCallback.mockRejectedValue(new AuthError('Account linking failed', 'OAUTH_ERROR', 409));
      const handler = createOAuthCallbackHandler(options);
      const req = new Request('http://localhost/api/auth/oauth/callback?code=abc123&provider=google', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(409);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('Account linking failed');
    });

    it('should return 500 on generic error', async () => {
      const options = createMockOptions(oauthOptions);
      mockExchangeCodeForToken.mockRejectedValue(new Error('Network error'));
      const handler = createOAuthCallbackHandler(options);
      const req = new Request('http://localhost/api/auth/oauth/callback?code=abc123&provider=google', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(500);
      const body = await parseJsonResponse(res);
      expect(body.error).toBe('OAuth callback failed');
    });

    it('should call onAfterOAuth hook after successful callback', async () => {
      const onAfterOAuth = vi.fn().mockResolvedValue(undefined);
      const options = createMockOptions({
        ...oauthOptions,
        hooks: { onAfterOAuth },
      });
      mockExchangeCodeForToken.mockResolvedValue('oauth-access-token');
      mockGetUserInfo.mockResolvedValue({
        id: 'google-user-id',
        email: 'user@example.com',
        name: 'User',
        image: null,
      });
      mockHandleCallback.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com', name: 'User', role: 'USER' },
        tokens: { accessToken: 'at', refreshToken: 'rt' },
        isNewUser: false,
      });
      const handler = createOAuthCallbackHandler(options);
      const req = new Request('http://localhost/api/auth/oauth/callback?code=abc123&provider=google', {
        method: 'GET',
      }) as any;

      await handler(req);
      expect(onAfterOAuth).toHaveBeenCalledWith(
        { id: 'user-1', email: 'user@example.com', name: 'User', role: 'USER' },
        'google',
        false,
      );
    });

    it('should redirect to onOAuthFirstLogin URL for new users', async () => {
      const onOAuthFirstLogin = vi.fn().mockResolvedValue('http://localhost:3000/onboarding');
      const options = createMockOptions({
        ...oauthOptions,
        hooks: { onOAuthFirstLogin },
      });
      mockExchangeCodeForToken.mockResolvedValue('oauth-access-token');
      mockGetUserInfo.mockResolvedValue({
        id: 'google-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        image: null,
      });
      mockHandleCallback.mockResolvedValue({
        user: { id: 'user-new', email: 'newuser@example.com', name: 'New User', role: 'USER' },
        tokens: { accessToken: 'at', refreshToken: 'rt' },
        isNewUser: true,
      });
      const handler = createOAuthCallbackHandler(options);
      const req = new Request('http://localhost/api/auth/oauth/callback?code=abc123&provider=google', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/onboarding');
      expect(mockSetTokenCookies).toHaveBeenCalled();
    });

    it('should use afterOAuth URL when configured', async () => {
      const options = createMockOptions({
        ...oauthOptions,
        urls: { baseUrl: 'http://localhost:3000', afterOAuth: '/dashboard' },
      });
      mockExchangeCodeForToken.mockResolvedValue('oauth-access-token');
      mockGetUserInfo.mockResolvedValue({
        id: 'google-user-id',
        email: 'user@example.com',
        name: 'User',
        image: null,
      });
      mockHandleCallback.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com', name: 'User', role: 'USER' },
        tokens: { accessToken: 'at', refreshToken: 'rt' },
        isNewUser: false,
      });
      const handler = createOAuthCallbackHandler(options);
      const req = new Request('http://localhost/api/auth/oauth/callback?code=abc123&provider=google', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('should extract provider from URL path when not in query params', async () => {
      const options = createMockOptions(oauthOptions);
      mockExchangeCodeForToken.mockResolvedValue('oauth-access-token');
      mockGetUserInfo.mockResolvedValue({
        id: 'google-user-id',
        email: 'user@example.com',
        name: 'User',
        image: null,
      });
      mockHandleCallback.mockResolvedValue({
        user: { id: 'user-1', email: 'user@example.com', name: 'User', role: 'USER' },
        tokens: { accessToken: 'at', refreshToken: 'rt' },
        isNewUser: false,
      });
      const handler = createOAuthCallbackHandler(options);
      // provider is the last segment of the path
      const req = new Request('http://localhost/api/auth/oauth/callback/google?code=abc123', {
        method: 'GET',
      }) as any;

      const res = await handler(req);
      expect(res.status).toBe(307);
    });
  });
});
