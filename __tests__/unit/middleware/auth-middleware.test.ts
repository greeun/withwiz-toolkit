/**
 * Unit Tests: authMiddleware detailed error paths
 *
 * Targets uncovered lines in src/middleware/auth.ts:
 * - jwtManager is null (not configured) -> throws UNAUTHORIZED
 * - token is null (no cookie, no header) -> throws UNAUTHORIZED
 * - Access token is blacklisted/revoked -> throws INVALID_TOKEN
 * - JWT verification fails with TOKEN_EXPIRED -> throws TOKEN_EXPIRED
 * - JWT verification fails with other error -> throws INVALID_TOKEN
 * - AppError is re-thrown as-is
 * - initializeAuthMiddleware returns boolean
 * - setAccessTokenBlacklistChecker sets checker
 * - createRoleMiddleware / adminMiddleware behavior
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { JWTService } from '@withwiz/auth/core/jwt';
import type { JWTConfig } from '@withwiz/auth/types';
import type { IApiContext } from '@withwiz/middleware/types';
// NOTE: We don't use `instanceof AppError` checks because vi.resetModules()
// causes different class references. Instead we check error.name and error.code.
import { ERROR_CODES } from '@withwiz/constants/error-codes';
import { NextResponse } from 'next/server';
import { initializeAuth, resetAuth } from '../../../src/auth/config';

// Suppress logger output during tests
vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const testConfig: JWTConfig = {
  secret: 'test-secret-key-that-is-at-least-32-characters-long',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  algorithm: 'HS256',
};

const shortExpiryConfig: JWTConfig = {
  secret: 'test-secret-key-that-is-at-least-32-characters-long',
  accessTokenExpiry: '1s',
  refreshTokenExpiry: '2s',
  algorithm: 'HS256',
};

const testUser = {
  id: 'user-auth-mw-test-001',
  email: 'auth-mw-test@example.com',
  role: 'USER' as const,
  emailVerified: new Date(),
};

let validAccessToken: string;
let expiredAccessToken: string;

/**
 * Helper to create mock request for IApiContext
 */
function createMockRequest(options?: {
  authHeader?: string;
  cookieToken?: string;
}): IApiContext['request'] {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  if (options?.authHeader) {
    headers.set('authorization', options.authHeader);
  }

  const cookies = {
    get: (name: string) => {
      if (name === 'access_token' && options?.cookieToken) {
        return { name, value: options.cookieToken };
      }
      return undefined;
    },
  };

  return {
    headers,
    cookies,
    method: 'GET',
    url: 'http://localhost:3000/api/test',
  } as unknown as IApiContext['request'];
}

function createMockContext(options?: {
  authHeader?: string;
  cookieToken?: string;
}): IApiContext {
  return {
    request: createMockRequest(options),
    locale: 'ko',
    requestId: 'test-request-id',
    startTime: Date.now(),
    metadata: {},
  };
}

const mockNext = async () => NextResponse.json({ ok: true });

// ============================================================================
// Setup: generate tokens
// ============================================================================
beforeAll(async () => {
  // Generate valid token
  const jwtService = new JWTService(testConfig);
  validAccessToken = await jwtService.createAccessToken({
    id: testUser.id,
    userId: testUser.id,
    email: testUser.email,
    role: testUser.role,
    emailVerified: testUser.emailVerified,
  });

  // Generate expired token
  const shortService = new JWTService(shortExpiryConfig);
  expiredAccessToken = await shortService.createAccessToken({
    id: testUser.id,
    userId: testUser.id,
    email: testUser.email,
    role: testUser.role,
    emailVerified: testUser.emailVerified,
  });

  // Wait for the short-expiry token to expire
  await new Promise((resolve) => setTimeout(resolve, 1500));
});

// ============================================================================
// SC-AUTH-MW-001: authMiddleware - jwtManager null (not configured)
// ============================================================================
describe('authMiddleware: JWT not configured', () => {
  beforeEach(() => {
    // Reset module-level _jwtManager and auth config
    resetAuth();
    // Clear cached module state
    vi.resetModules();
  });

  it('should throw UNAUTHORIZED when auth is not initialized', async () => {
    // Re-import after reset to get fresh module state
    const { authMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext({ authHeader: `Bearer ${validAccessToken}` });

    try {
      await authMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.UNAUTHORIZED.code);
    }
  });
});

// ============================================================================
// SC-AUTH-MW-002: authMiddleware - no token provided
// ============================================================================
describe('authMiddleware: no token', () => {
  beforeAll(() => {
    resetAuth();
    initializeAuth({
      jwtSecret: testConfig.secret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('should throw UNAUTHORIZED when no cookie and no Authorization header', async () => {
    const { authMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext(); // no auth

    try {
      await authMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.UNAUTHORIZED.code);
    }
  });
});

// ============================================================================
// SC-AUTH-MW-003: authMiddleware - valid token
// ============================================================================
describe('authMiddleware: valid token', () => {
  beforeAll(() => {
    resetAuth();
    initializeAuth({
      jwtSecret: testConfig.secret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('should set context.user for valid token in Authorization header', async () => {
    const { authMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext({ authHeader: `Bearer ${validAccessToken}` });

    await authMiddleware(context, mockNext);

    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
    expect(context.user!.email).toBe(testUser.email);
    expect(context.user!.role).toBe('USER');
  });

  it('should set context.user for valid token in cookie', async () => {
    const { authMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext({ cookieToken: validAccessToken });

    await authMiddleware(context, mockNext);

    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
  });

  it('should prefer cookie over Authorization header', async () => {
    const { authMiddleware } = await import('@withwiz/middleware/auth');
    // Set both cookie and header, cookie should win
    const context = createMockContext({
      cookieToken: validAccessToken,
      authHeader: 'Bearer invalid-token',
    });

    await authMiddleware(context, mockNext);
    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
  });
});

// ============================================================================
// SC-AUTH-MW-004: authMiddleware - blacklisted token
// ============================================================================
describe('authMiddleware: blacklisted token', () => {
  beforeAll(() => {
    resetAuth();
    initializeAuth({
      jwtSecret: testConfig.secret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('should throw INVALID_TOKEN when token is revoked', async () => {
    const { authMiddleware, setAccessTokenBlacklistChecker } = await import(
      '@withwiz/middleware/auth'
    );

    // Set up blacklist checker that marks all tokens as revoked
    setAccessTokenBlacklistChecker({
      isAccessTokenRevoked: vi.fn().mockResolvedValue(true),
    });

    const context = createMockContext({ authHeader: `Bearer ${validAccessToken}` });

    try {
      await authMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.INVALID_TOKEN.code);
      expect((error as any).message).toContain('revoked');
    }

    // Clean up: reset checker
    setAccessTokenBlacklistChecker({
      isAccessTokenRevoked: vi.fn().mockResolvedValue(false),
    });
  });

  it('should pass when token is not revoked', async () => {
    const { authMiddleware, setAccessTokenBlacklistChecker } = await import(
      '@withwiz/middleware/auth'
    );

    setAccessTokenBlacklistChecker({
      isAccessTokenRevoked: vi.fn().mockResolvedValue(false),
    });

    const context = createMockContext({ authHeader: `Bearer ${validAccessToken}` });
    await authMiddleware(context, mockNext);

    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
  });
});

// ============================================================================
// SC-AUTH-MW-005: authMiddleware - expired token
// ============================================================================
describe('authMiddleware: expired token', () => {
  beforeAll(() => {
    resetAuth();
    initializeAuth({
      jwtSecret: testConfig.secret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('should throw TOKEN_EXPIRED for expired access token', async () => {
    const { authMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext({ authHeader: `Bearer ${expiredAccessToken}` });

    try {
      await authMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.TOKEN_EXPIRED.code);
    }
  });
});

// ============================================================================
// SC-AUTH-MW-006: authMiddleware - invalid token
// ============================================================================
describe('authMiddleware: invalid token', () => {
  beforeAll(() => {
    resetAuth();
    initializeAuth({
      jwtSecret: testConfig.secret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('should throw INVALID_TOKEN for completely invalid token string', async () => {
    const { authMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext({ authHeader: 'Bearer this-is-not-a-jwt' });

    try {
      await authMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.INVALID_TOKEN.code);
    }
  });

  it('should throw INVALID_TOKEN for token signed with wrong secret', async () => {
    const { authMiddleware } = await import('@withwiz/middleware/auth');
    const otherService = new JWTService({
      ...testConfig,
      secret: 'a-completely-different-secret-that-is-32-chars-long!',
    });
    const wrongToken = await otherService.createAccessToken({
      id: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role as any,
    });

    const context = createMockContext({ authHeader: `Bearer ${wrongToken}` });

    try {
      await authMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.INVALID_TOKEN.code);
    }
  });
});

// ============================================================================
// SC-AUTH-MW-007: initializeAuthMiddleware
// ============================================================================
describe('initializeAuthMiddleware', () => {
  beforeEach(() => {
    resetAuth();
    vi.resetModules();
  });

  it('should return true when auth config is valid', async () => {
    initializeAuth({
      jwtSecret: testConfig.secret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });

    const { initializeAuthMiddleware } = await import('@withwiz/middleware/auth');
    const result = initializeAuthMiddleware();
    expect(result).toBe(true);
  });

  it('should return false when auth is not initialized', async () => {
    // Do NOT call initializeAuth
    const { initializeAuthMiddleware } = await import('@withwiz/middleware/auth');
    const result = initializeAuthMiddleware();
    expect(result).toBe(false);
  });
});

// ============================================================================
// SC-AUTH-MW-008: createRoleMiddleware / adminMiddleware
// ============================================================================
describe('createRoleMiddleware and adminMiddleware', () => {
  beforeAll(() => {
    resetAuth();
    initializeAuth({
      jwtSecret: testConfig.secret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('adminMiddleware should throw UNAUTHORIZED when no user', async () => {
    const { adminMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext();
    // context.user is undefined

    try {
      await adminMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.UNAUTHORIZED.code);
    }
  });

  it('adminMiddleware should throw FORBIDDEN when user is not ADMIN', async () => {
    const { adminMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext();
    context.user = { id: 'user-1', email: 'user@test.com', role: 'USER' };

    try {
      await adminMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.FORBIDDEN.code);
    }
  });

  it('adminMiddleware should pass for ADMIN user', async () => {
    const { adminMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext();
    context.user = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };

    const result = await adminMiddleware(context, mockNext);
    expect(result).toBeDefined();
  });

  it('createRoleMiddleware should allow specified roles', async () => {
    const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
    const editorMiddleware = createRoleMiddleware('EDITOR', 'ADMIN');
    const context = createMockContext();
    context.user = { id: 'editor-1', email: 'editor@test.com', role: 'EDITOR' };

    const result = await editorMiddleware(context, mockNext);
    expect(result).toBeDefined();
  });

  it('createRoleMiddleware should reject non-matching roles', async () => {
    const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
    const editorMiddleware = createRoleMiddleware('EDITOR', 'ADMIN');
    const context = createMockContext();
    context.user = { id: 'user-1', email: 'user@test.com', role: 'USER' };

    try {
      await editorMiddleware(context, mockNext);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect((error as any).name).toBe('AppError');
      expect((error as any).code).toBe(ERROR_CODES.FORBIDDEN.code);
    }
  });
});
