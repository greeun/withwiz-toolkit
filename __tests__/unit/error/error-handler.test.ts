/**
 * Error Handler Unit Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { ERROR_CODES } from '@withwiz/constants/error-codes';

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Error Handler exports', () => {
  it('should export error handler functions', async () => {
    const errorHandler = await import('@withwiz/error/error-handler');
    expect(errorHandler).toBeDefined();
    expect(typeof errorHandler.processError).toBe('function');
    expect(typeof errorHandler.errorToResponse).toBe('function');
    expect(typeof errorHandler.withErrorHandler).toBe('function');
    expect(errorHandler.ErrorResponse).toBeDefined();
  });

  it('should export AUTH_ERROR_CODE_MAP', async () => {
    const errorHandler = await import('@withwiz/error/error-handler');
    expect(errorHandler.AUTH_ERROR_CODE_MAP).toBeDefined();
    expect(typeof errorHandler.AUTH_ERROR_CODE_MAP).toBe('object');
  });
});

describe('Error Display exports', () => {
  it('should export error display utilities', async () => {
    const errorDisplay = await import('@withwiz/error/error-display');
    expect(errorDisplay).toBeDefined();
  });
});

// ============================================================================
// processError: AppError passthrough
// ============================================================================
describe('processError: AppError passthrough', () => {
  it('should return AppError fields directly', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { AppError } = await import('@withwiz/error/app-error');

    const error = AppError.notFound('Test resource');
    const result = processError(error);

    expect(result.code).toBe(ERROR_CODES.NOT_FOUND.code);
    expect(result.status).toBe(404);
    expect(result.message).toContain('Test resource');
  });
});

// ============================================================================
// processError: ZodError handling
// ============================================================================
describe('processError: ZodError handling', () => {
  it('should map ZodError to VALIDATION_ERROR', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { z } = await import('zod');

    const schema = z.object({ email: z.string().email() });
    try {
      schema.parse({ email: 'invalid' });
    } catch (error) {
      const result = processError(error);
      expect(result.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
      expect(result.status).toBe(400);
      expect(result.details).toHaveProperty('issues');
    }
  });
});

// ============================================================================
// processError: Prisma error mapping
// ============================================================================
describe('processError: Prisma error mapping', () => {
  it('should map P2002 to DUPLICATE_RESOURCE', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const error = new Error('Unique constraint failed P2002');
    const result = processError(error);
    expect(result.code).toBe(40905); // DUPLICATE_RESOURCE
    expect(result.status).toBe(409);
  });

  it('should map P2025 to NOT_FOUND', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const error = new Error('Record not found P2025');
    const result = processError(error);
    expect(result.code).toBe(40401);
    expect(result.status).toBe(404);
  });

  it('should map unmapped Prisma codes to DATABASE_ERROR via classifyError', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const error = new Error('P9999 unknown prisma error');
    const result = processError(error);
    expect(result.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
    expect(result.status).toBe(500);
  });
});

// ============================================================================
// processError: classifyError fallback for plain Error
// ============================================================================
describe('processError: classifyError fallback', () => {
  it('should classify "not found" message via classifyError', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const result = processError(new Error('Entity not found'));
    expect(result.code).toBe(ERROR_CODES.NOT_FOUND.code);
    expect(result.status).toBe(404);
  });

  it('should classify network error via classifyError', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const error = new Error('fetch failed');
    const result = processError(error);
    expect(result.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
    expect(result.status).toBe(503);
  });

  it('should classify unknown error as SERVER_ERROR', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const result = processError(new Error('Unexpected thing'));
    expect(result.code).toBe(ERROR_CODES.SERVER_ERROR.code);
    expect(result.status).toBe(500);
  });

  it('should classify non-Error types as INTERNAL_SERVER_ERROR', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const result = processError('string error');
    expect(result.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR.code);
    expect(result.status).toBe(500);
  });
});

// ============================================================================
// processError: AuthError mapping
// ============================================================================
describe('processError: AuthError mapping', () => {
  it('should map JWTError TOKEN_EXPIRED to 40103', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { JWTError } = await import('@withwiz/auth/errors');
    const result = processError(new JWTError('Expired', 'TOKEN_EXPIRED'));
    expect(result.code).toBe(ERROR_CODES.TOKEN_EXPIRED.code);
    expect(result.status).toBe(401);
  });

  it('should map OAuthError to EXTERNAL_SERVICE_ERROR', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { OAuthError } = await import('@withwiz/auth/errors');
    const result = processError(new OAuthError('Exchange failed', 'OAUTH_TOKEN_EXCHANGE_FAILED'));
    expect(result.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
    expect(result.status).toBe(503);
  });

  it('should map PASSWORD_HASH_FAILED to SERVER_ERROR (not 400)', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { PasswordError } = await import('@withwiz/auth/errors');
    const result = processError(new PasswordError('Hash failed', 'PASSWORD_HASH_FAILED'));
    expect(result.code).toBe(ERROR_CODES.SERVER_ERROR.code);
    expect(result.status).toBe(500);
  });

  it('should fallback unmapped AuthError by statusCode', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { AuthError } = await import('@withwiz/auth/errors');
    const result = processError(new AuthError('Unknown', 'CUSTOM_CODE', 401));
    expect(result.code).toBe(ERROR_CODES.UNAUTHORIZED.code);
    expect(result.status).toBe(401);
  });

  it('should fallback unmapped AuthError 400 to BAD_REQUEST', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { AuthError } = await import('@withwiz/auth/errors');
    const result = processError(new AuthError('Bad', 'CUSTOM_CODE', 400));
    expect(result.code).toBe(ERROR_CODES.BAD_REQUEST.code);
    expect(result.status).toBe(400);
  });
});

// ============================================================================
// AUTH_ERROR_CODE_MAP completeness
// ============================================================================
describe('AUTH_ERROR_CODE_MAP completeness', () => {
  it('should contain all AUTH_ERROR_CODES keys', async () => {
    const { AUTH_ERROR_CODE_MAP } = await import('@withwiz/error/error-handler');
    const { AUTH_ERROR_CODES } = await import('@withwiz/auth/errors');

    const allAuthKeys = Object.values(AUTH_ERROR_CODES);
    const mappedKeys = Object.keys(AUTH_ERROR_CODE_MAP);

    allAuthKeys.forEach((key) => {
      expect(mappedKeys).toContain(key);
    });
  });
});

// ============================================================================
// ErrorResponse completeness
// ============================================================================
describe('ErrorResponse utility completeness', () => {
  it('should have all expected response factory methods', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');

    // 400xx
    expect(typeof ErrorResponse.validation).toBe('function');
    expect(typeof ErrorResponse.badRequest).toBe('function');
    expect(typeof ErrorResponse.invalidInput).toBe('function');
    expect(typeof ErrorResponse.missingField).toBe('function');
    expect(typeof ErrorResponse.invalidUrl).toBe('function');
    expect(typeof ErrorResponse.invalidEmail).toBe('function');
    expect(typeof ErrorResponse.weakPassword).toBe('function');
    expect(typeof ErrorResponse.invalidAlias).toBe('function');

    // 401xx
    expect(typeof ErrorResponse.unauthorized).toBe('function');
    expect(typeof ErrorResponse.invalidToken).toBe('function');
    expect(typeof ErrorResponse.tokenExpired).toBe('function');
    expect(typeof ErrorResponse.linkPasswordRequired).toBe('function');
    expect(typeof ErrorResponse.linkPasswordIncorrect).toBe('function');
    expect(typeof ErrorResponse.invalidCredentials).toBe('function');
    expect(typeof ErrorResponse.sessionExpired).toBe('function');

    // 403xx
    expect(typeof ErrorResponse.forbidden).toBe('function');

    // 404xx
    expect(typeof ErrorResponse.notFound).toBe('function');
    expect(typeof ErrorResponse.tagNotFound).toBe('function');
    expect(typeof ErrorResponse.favoriteNotFound).toBe('function');
    expect(typeof ErrorResponse.groupNotFound).toBe('function');

    // 409xx
    expect(typeof ErrorResponse.conflict).toBe('function');
    expect(typeof ErrorResponse.duplicate).toBe('function');

    // 422xx
    expect(typeof ErrorResponse.businessRule).toBe('function');
    expect(typeof ErrorResponse.invalidOperation).toBe('function');
    expect(typeof ErrorResponse.alreadyFavorited).toBe('function');
    expect(typeof ErrorResponse.fileTooLarge).toBe('function');
    expect(typeof ErrorResponse.unsupportedFileType).toBe('function');

    // 429xx
    expect(typeof ErrorResponse.rateLimit).toBe('function');
    expect(typeof ErrorResponse.dailyLimit).toBe('function');
    expect(typeof ErrorResponse.apiQuotaExceeded).toBe('function');

    // 500xx
    expect(typeof ErrorResponse.serverError).toBe('function');
    expect(typeof ErrorResponse.internalError).toBe('function');
    expect(typeof ErrorResponse.databaseError).toBe('function');
    expect(typeof ErrorResponse.emailSendFailed).toBe('function');
    expect(typeof ErrorResponse.cacheError).toBe('function');
    expect(typeof ErrorResponse.fileUploadFailed).toBe('function');

    // 503xx
    expect(typeof ErrorResponse.serviceUnavailable).toBe('function');
    expect(typeof ErrorResponse.externalServiceError).toBe('function');

    // Security
    expect(typeof ErrorResponse.accessBlocked).toBe('function');
    expect(typeof ErrorResponse.securityValidationFailed).toBe('function');
    expect(typeof ErrorResponse.blockedUrl).toBe('function');
    expect(typeof ErrorResponse.suspiciousActivity).toBe('function');
    expect(typeof ErrorResponse.ipBlocked).toBe('function');
    expect(typeof ErrorResponse.corsViolation).toBe('function');
  });
});
