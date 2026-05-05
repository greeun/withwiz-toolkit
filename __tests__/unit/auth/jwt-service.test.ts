/**
 * Unit Tests: JWTService & JWTManager extended coverage
 *
 * Targets uncovered lines in src/auth/core/jwt/index.ts:
 * - createTokenPair success and failure paths
 * - verifyAccessToken with expired token (TOKEN_EXPIRED)
 * - verifyAccessToken with invalid token (TOKEN_VERIFICATION_FAILED)
 * - verifyRefreshToken success and failure paths
 * - extractTokenFromHeader edge cases
 * - isTokenExpired
 * - getTokenRemainingTime
 * - extractUserFromPayload
 * - Constructor with short secret
 */

import { describe, it, expect, vi } from 'vitest';
import { JWTService, JWTManager } from '@withwiz/auth/core/jwt';
import { JWTError } from '@withwiz/auth/errors';
import type { JWTConfig } from '@withwiz/auth/types';

const testConfig: JWTConfig = {
  secret: 'test-secret-key-that-is-at-least-32-characters-long',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  algorithm: 'HS256',
};

const shortExpiryConfig: JWTConfig = {
  secret: 'test-secret-key-that-is-at-least-32-characters-long',
  accessTokenExpiry: '1s',
  refreshTokenExpiry: '1s',
  algorithm: 'HS256',
};

const testUser = {
  id: 'user-jwt-test-001',
  email: 'jwt-test@example.com',
  role: 'USER',
  emailVerified: new Date(),
};

// ============================================================================
// JWTService: createTokenPair
// ============================================================================
describe('JWTService: createTokenPair', () => {
  it('should return accessToken and refreshToken as strings', async () => {
    const service = new JWTService(testConfig);
    const result = await service.createTokenPair(testUser);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.refreshToken.split('.')).toHaveLength(3);
  });

  it('accessToken from createTokenPair should be verifiable', async () => {
    const service = new JWTService(testConfig);
    const { accessToken } = await service.createTokenPair(testUser);
    const payload = await service.verifyAccessToken(accessToken);

    expect(payload.userId).toBe(testUser.id);
    expect(payload.email).toBe(testUser.email);
    expect(payload.role).toBe(testUser.role);
  });

  it('refreshToken from createTokenPair should be verifiable', async () => {
    const service = new JWTService(testConfig);
    const { refreshToken } = await service.createTokenPair(testUser);
    const payload = await service.verifyRefreshToken(refreshToken);

    expect(payload.userId).toBe(testUser.id);
    expect(payload.tokenType).toBe('refresh');
  });
});

// ============================================================================
// JWTService: verifyAccessToken error paths
// ============================================================================
describe('JWTService: verifyAccessToken error paths', () => {
  it('should throw TOKEN_EXPIRED for expired access token', async () => {
    const shortService = new JWTService(shortExpiryConfig);
    const token = await shortService.sign({
      id: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role as any,
    });

    // Wait for token to expire
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      await shortService.verifyAccessToken(token);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(JWTError);
      expect((error as JWTError).code).toBe('TOKEN_EXPIRED');
    }
  }, 10000);

  it('should throw TOKEN_VERIFICATION_FAILED for invalid token string', async () => {
    const service = new JWTService(testConfig);

    try {
      await service.verifyAccessToken('not-a-valid-jwt-token');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(JWTError);
      expect((error as JWTError).code).toBe('TOKEN_VERIFICATION_FAILED');
    }
  });

  it('should throw TOKEN_VERIFICATION_FAILED for token signed with different secret', async () => {
    const otherService = new JWTService({
      ...testConfig,
      secret: 'another-secret-that-is-definitely-32-characters-long!!',
    });
    const service = new JWTService(testConfig);

    const token = await otherService.sign({
      id: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role as any,
    });

    try {
      await service.verifyAccessToken(token);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(JWTError);
      expect((error as JWTError).code).toBe('TOKEN_VERIFICATION_FAILED');
    }
  });
});

// ============================================================================
// JWTService: verifyRefreshToken
// ============================================================================
describe('JWTService: verifyRefreshToken', () => {
  it('should verify a valid refresh token', async () => {
    const service = new JWTService(testConfig);
    const token = await service.createRefreshToken(testUser.id);
    const result = await service.verifyRefreshToken(token);

    expect(result.userId).toBe(testUser.id);
    expect(result.tokenType).toBe('refresh');
  });

  it('should throw REFRESH_TOKEN_EXPIRED for expired refresh token', async () => {
    const shortService = new JWTService(shortExpiryConfig);
    const token = await shortService.createRefreshToken(testUser.id);

    // Wait for token to expire
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      await shortService.verifyRefreshToken(token);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(JWTError);
      expect((error as JWTError).code).toBe('REFRESH_TOKEN_EXPIRED');
    }
  }, 10000);

  it('should throw TOKEN_VERIFICATION_FAILED for invalid refresh token', async () => {
    const service = new JWTService(testConfig);

    try {
      await service.verifyRefreshToken('invalid-token');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(JWTError);
      expect((error as JWTError).code).toBe('TOKEN_VERIFICATION_FAILED');
    }
  });

  it('should throw TOKEN_VERIFICATION_FAILED for access token used as refresh token', async () => {
    const service = new JWTService(testConfig);
    // Create an access token (not a refresh token)
    const accessToken = await service.sign({
      id: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role as any,
    });

    // Try to verify it as a refresh token - should fail because tokenType != "refresh"
    try {
      await service.verifyRefreshToken(accessToken);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(JWTError);
      // It should throw because payload.tokenType !== 'refresh'
      expect(['INVALID_PAYLOAD', 'TOKEN_VERIFICATION_FAILED']).toContain(
        (error as JWTError).code
      );
    }
  });
});

// ============================================================================
// JWTService: extractTokenFromHeader
// ============================================================================
describe('JWTService: extractTokenFromHeader', () => {
  let service: JWTService;

  beforeAll(() => {
    service = new JWTService(testConfig);
  });

  it('should extract token from valid Bearer header', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
    expect(service.extractTokenFromHeader(`Bearer ${token}`)).toBe(token);
  });

  it('should return null for undefined header', () => {
    expect(service.extractTokenFromHeader(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(service.extractTokenFromHeader('')).toBeNull();
  });

  it('should return null for non-Bearer prefix', () => {
    expect(service.extractTokenFromHeader('Basic abc123')).toBeNull();
  });

  it('should return null for Bearer without token (only one part)', () => {
    expect(service.extractTokenFromHeader('Bearer')).toBeNull();
  });

  it('should return null for too many parts', () => {
    expect(service.extractTokenFromHeader('Bearer token extra')).toBeNull();
  });
});

// ============================================================================
// JWTManager: isTokenExpired and getTokenRemainingTime
// ============================================================================
describe('JWTManager: utility methods via JWTService', () => {
  it('should create a JWTManager instance with valid config', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const manager = new JWTManager(testConfig, logger);
    expect(manager).toBeInstanceOf(JWTManager);
  });

  it('isTokenExpired should return true for expired payload', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const manager = new JWTManager(testConfig, logger);

    const expiredPayload = {
      id: 'user-1',
      userId: 'user-1',
      email: 'test@test.com',
      role: 'USER' as any,
      exp: Math.floor(Date.now() / 1000) - 100, // 100 seconds ago
    };

    expect(manager.isTokenExpired(expiredPayload)).toBe(true);
  });

  it('isTokenExpired should return false for valid payload', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const manager = new JWTManager(testConfig, logger);

    const validPayload = {
      id: 'user-1',
      userId: 'user-1',
      email: 'test@test.com',
      role: 'USER' as any,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    expect(manager.isTokenExpired(validPayload)).toBe(false);
  });

  it('isTokenExpired should return true when exp is missing', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const manager = new JWTManager(testConfig, logger);

    const noExpPayload = {
      id: 'user-1',
      userId: 'user-1',
      email: 'test@test.com',
      role: 'USER' as any,
    };

    expect(manager.isTokenExpired(noExpPayload)).toBe(true);
  });

  it('getTokenRemainingTime should return positive for valid payload', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const manager = new JWTManager(testConfig, logger);

    const validPayload = {
      id: 'user-1',
      userId: 'user-1',
      email: 'test@test.com',
      role: 'USER' as any,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const remaining = manager.getTokenRemainingTime(validPayload);
    expect(remaining).toBeGreaterThan(3500);
    expect(remaining).toBeLessThanOrEqual(3600);
  });

  it('getTokenRemainingTime should return 0 for expired payload', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const manager = new JWTManager(testConfig, logger);

    const expiredPayload = {
      id: 'user-1',
      userId: 'user-1',
      email: 'test@test.com',
      role: 'USER' as any,
      exp: Math.floor(Date.now() / 1000) - 100,
    };

    expect(manager.getTokenRemainingTime(expiredPayload)).toBe(0);
  });

  it('getTokenRemainingTime should return 0 when exp is missing', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const manager = new JWTManager(testConfig, logger);

    const noExpPayload = {
      id: 'user-1',
      userId: 'user-1',
      email: 'test@test.com',
      role: 'USER' as any,
    };

    expect(manager.getTokenRemainingTime(noExpPayload)).toBe(0);
  });

  it('extractUserFromPayload should return user info', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const manager = new JWTManager(testConfig, logger);

    const payload = {
      id: 'user-1',
      userId: 'user-1',
      email: 'test@test.com',
      role: 'ADMIN' as any,
    };

    const user = manager.extractUserFromPayload(payload);
    expect(user.id).toBe('user-1');
    expect(user.email).toBe('test@test.com');
    expect(user.role).toBe('ADMIN');
  });
});

// ============================================================================
// JWTManager: Constructor validation
// ============================================================================
describe('JWTManager: constructor validation', () => {
  it('should throw JWTError for secret shorter than 32 chars', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    expect(() => new JWTManager({ ...testConfig, secret: 'short' }, logger)).toThrow(JWTError);
  });

  it('should accept secret of exactly 32 chars', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    expect(
      () => new JWTManager({ ...testConfig, secret: 'a'.repeat(32) }, logger)
    ).not.toThrow();
  });
});
