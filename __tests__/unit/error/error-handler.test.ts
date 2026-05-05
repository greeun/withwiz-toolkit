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

    // 401xx
    expect(typeof ErrorResponse.unauthorized).toBe('function');
    expect(typeof ErrorResponse.invalidToken).toBe('function');
    expect(typeof ErrorResponse.tokenExpired).toBe('function');
    expect(typeof ErrorResponse.invalidCredentials).toBe('function');
    expect(typeof ErrorResponse.sessionExpired).toBe('function');

    // 403xx
    expect(typeof ErrorResponse.forbidden).toBe('function');

    // 404xx
    expect(typeof ErrorResponse.notFound).toBe('function');
    expect(typeof ErrorResponse.userNotFound).toBe('function');

    // 409xx
    expect(typeof ErrorResponse.conflict).toBe('function');
    expect(typeof ErrorResponse.duplicate).toBe('function');

    // 422xx
    expect(typeof ErrorResponse.businessRule).toBe('function');
    expect(typeof ErrorResponse.invalidOperation).toBe('function');
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

// ============================================================================
// errorToResponse: Converts error to NextResponse
// ============================================================================
describe('errorToResponse', () => {
  it('should return NextResponse with correct status and body for AppError', async () => {
    const { errorToResponse } = await import('@withwiz/error/error-handler');
    const { AppError } = await import('@withwiz/error/app-error');

    const error = AppError.notFound('User not found');
    const response = errorToResponse(error, '/api/users/1');

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.NOT_FOUND.code);
    expect(body.error.message).toContain('User not found');
  });

  it('should return 400 with validation details for ZodError', async () => {
    const { errorToResponse } = await import('@withwiz/error/error-handler');
    const { z } = await import('zod');

    const schema = z.object({ email: z.string().email() });
    let response;
    try {
      schema.parse({ email: 'invalid' });
    } catch (error) {
      response = errorToResponse(error);
    }

    expect(response!.status).toBe(400);
    const body = await response!.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
    expect(body.error.details).toHaveProperty('issues');
  });

  it('should return correct mapped code for AuthError with mapped code', async () => {
    const { errorToResponse } = await import('@withwiz/error/error-handler');
    const { JWTError } = await import('@withwiz/auth/errors');

    const error = new JWTError('Token has expired', 'TOKEN_EXPIRED');
    const response = errorToResponse(error);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.TOKEN_EXPIRED.code);
  });

  it('should fallback for AuthError with unmapped code', async () => {
    const { errorToResponse } = await import('@withwiz/error/error-handler');
    const { AuthError } = await import('@withwiz/auth/errors');

    const error = new AuthError('Custom auth error', 'UNKNOWN_AUTH_CODE', 401);
    const response = errorToResponse(error);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED.code);
  });

  it('should return mapped code for Prisma error message', async () => {
    const { errorToResponse } = await import('@withwiz/error/error-handler');

    const error = new Error('Unique constraint violation P2002');
    const response = errorToResponse(error);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe(40905);
  });

  it('should use classifyError for generic Error', async () => {
    const { errorToResponse } = await import('@withwiz/error/error-handler');

    const error = new Error('random unexpected error');
    const response = errorToResponse(error);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('should return 500 for non-Error values', async () => {
    const { errorToResponse } = await import('@withwiz/error/error-handler');

    const response = errorToResponse('string error');

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR.code);
  });

  it('should log via logger.error for status >= 500', async () => {
    const { logger } = await import('@withwiz/logger/logger');
    const { errorToResponse } = await import('@withwiz/error/error-handler');
    const { AppError } = await import('@withwiz/error/app-error');

    vi.mocked(logger.error).mockClear();
    const error = AppError.serverError('DB down');
    errorToResponse(error, '/api/health');

    expect(logger.error).toHaveBeenCalledWith(
      'Server error',
      expect.objectContaining({ path: '/api/health', status: 500 })
    );
  });

  it('should log via logger.warn for status 400-499', async () => {
    const { logger } = await import('@withwiz/logger/logger');
    const { errorToResponse } = await import('@withwiz/error/error-handler');
    const { AppError } = await import('@withwiz/error/app-error');

    vi.mocked(logger.warn).mockClear();
    const error = AppError.notFound('Missing resource');
    errorToResponse(error, '/api/items/123');

    expect(logger.warn).toHaveBeenCalledWith(
      'Client error',
      expect.objectContaining({ path: '/api/items/123', status: 404 })
    );
  });
});

// ============================================================================
// withErrorHandler: Wraps async handler with error handling
// ============================================================================
describe('withErrorHandler', () => {
  it('should return handler response when it succeeds', async () => {
    const { withErrorHandler } = await import('@withwiz/error/error-handler');
    const { NextRequest, NextResponse } = await import('next/server');

    const successResponse = NextResponse.json({ success: true, data: 'hello' });
    const handler = vi.fn().mockResolvedValue(successResponse);
    const wrapped = withErrorHandler(handler);

    const req = new NextRequest('http://localhost/api/test');
    const result = await wrapped(req);

    expect(handler).toHaveBeenCalledWith(req);
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.success).toBe(true);
  });

  it('should catch errors and return error response', async () => {
    const { withErrorHandler } = await import('@withwiz/error/error-handler');
    const { AppError } = await import('@withwiz/error/app-error');
    const { NextRequest } = await import('next/server');

    const handler = vi.fn().mockRejectedValue(AppError.forbidden('No access'));
    const wrapped = withErrorHandler(handler);

    const req = new NextRequest('http://localhost/api/secret');
    const result = await wrapped(req);

    expect(result.status).toBe(403);
    const body = await result.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN.code);
  });

  it('should handle non-AppError throws', async () => {
    const { withErrorHandler } = await import('@withwiz/error/error-handler');
    const { NextRequest } = await import('next/server');

    const handler = vi.fn().mockRejectedValue(new Error('Unexpected crash'));
    const wrapped = withErrorHandler(handler);

    const req = new NextRequest('http://localhost/api/crash');
    const result = await wrapped(req);

    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.success).toBe(false);
  });

  it('should pass request path for logging', async () => {
    const { withErrorHandler } = await import('@withwiz/error/error-handler');
    const { AppError } = await import('@withwiz/error/app-error');
    const { NextRequest } = await import('next/server');
    const { logger } = await import('@withwiz/logger/logger');

    vi.mocked(logger.error).mockClear();
    const handler = vi.fn().mockRejectedValue(AppError.serverError('Internal'));
    const wrapped = withErrorHandler(handler);

    const req = new NextRequest('http://localhost/api/data');
    await wrapped(req);

    expect(logger.error).toHaveBeenCalledWith(
      'Server error',
      expect.objectContaining({ path: '/api/data' })
    );
  });
});

// ============================================================================
// ErrorResponse factory methods: verify status codes
// ============================================================================
describe('ErrorResponse factory status codes', () => {
  it('ErrorResponse.validation() → 400', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.validation('Bad input');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
  });

  it('ErrorResponse.unauthorized() → 401', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.unauthorized();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED.code);
  });

  it('ErrorResponse.forbidden() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.forbidden();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN.code);
  });

  it('ErrorResponse.notFound() → 404', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.notFound();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.NOT_FOUND.code);
  });

  it('ErrorResponse.conflict() → 409', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.conflict();
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.CONFLICT.code);
  });

  it('ErrorResponse.rateLimit() → 429', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.rateLimit();
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED.code);
  });

  it('ErrorResponse.serverError() → 500', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.serverError();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.SERVER_ERROR.code);
  });

  it('ErrorResponse.serviceUnavailable() → 503', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.serviceUnavailable();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE.code);
  });

  it('ErrorResponse.businessRule() → 422', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.businessRule('Cannot do that');
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.BUSINESS_RULE_VIOLATION.code);
  });

  it('ErrorResponse.duplicate() → 409', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.duplicate('email');
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.DUPLICATE_RESOURCE.code);
  });

  it('ErrorResponse.accessBlocked() → 403 (security)', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.accessBlocked('Blocked by policy');
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe(ERROR_CODES.ACCESS_BLOCKED.code);
  });
});

// ============================================================================
// ErrorResponse factory methods: extended coverage for remaining methods
// ============================================================================
describe('ErrorResponse factory status codes - extended', () => {
  it('ErrorResponse.invalidInput() → 400', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.invalidInput('bad data');
    expect(response.status).toBe(400);
  });

  it('ErrorResponse.missingField() → 400', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.missingField('email');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain('email');
  });

  it('ErrorResponse.invalidUrl() → 400', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.invalidUrl();
    expect(response.status).toBe(400);
  });

  it('ErrorResponse.invalidEmail() → 400', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.invalidEmail();
    expect(response.status).toBe(400);
  });

  it('ErrorResponse.weakPassword() → 400', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.weakPassword();
    expect(response.status).toBe(400);
  });

  it('ErrorResponse.invalidToken() → 401', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.invalidToken();
    expect(response.status).toBe(401);
  });

  it('ErrorResponse.tokenExpired() → 401', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.tokenExpired();
    expect(response.status).toBe(401);
  });

  it('ErrorResponse.invalidCredentials() → 401', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.invalidCredentials();
    expect(response.status).toBe(401);
  });

  it('ErrorResponse.sessionExpired() → 401', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.sessionExpired();
    expect(response.status).toBe(401);
  });

  it('ErrorResponse.emailNotVerified() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.emailNotVerified();
    expect(response.status).toBe(403);
  });

  it('ErrorResponse.accountDisabled() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.accountDisabled();
    expect(response.status).toBe(403);
  });

  it('ErrorResponse.accountLocked() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.accountLocked();
    expect(response.status).toBe(403);
  });

  it('ErrorResponse.userNotFound() → 404', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.userNotFound();
    expect(response.status).toBe(404);
  });

  it('ErrorResponse.duplicate() without resource → 409', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.duplicate();
    expect(response.status).toBe(409);
  });

  it('ErrorResponse.emailExists() → 409', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.emailExists();
    expect(response.status).toBe(409);
  });

  it('ErrorResponse.invalidOperation() → 422', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.invalidOperation('cannot perform action');
    expect(response.status).toBe(422);
  });

  it('ErrorResponse.quotaExceeded() → 422', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.quotaExceeded();
    expect(response.status).toBe(422);
  });

  it('ErrorResponse.fileTooLarge() → 422', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.fileTooLarge('10MB');
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.message).toContain('10MB');
  });

  it('ErrorResponse.unsupportedFileType() → 422', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.unsupportedFileType('.exe');
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.message).toContain('.exe');
  });

  it('ErrorResponse.dailyLimit() → 429', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.dailyLimit();
    expect(response.status).toBe(429);
  });

  it('ErrorResponse.apiQuotaExceeded() → 429', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.apiQuotaExceeded();
    expect(response.status).toBe(429);
  });

  it('ErrorResponse.internalError() → 500', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.internalError('unexpected failure');
    expect(response.status).toBe(500);
  });

  it('ErrorResponse.databaseError() → 500', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.databaseError('connection lost');
    expect(response.status).toBe(500);
  });

  it('ErrorResponse.emailSendFailed() → 500', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.emailSendFailed();
    expect(response.status).toBe(500);
  });

  it('ErrorResponse.cacheError() → 500', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.cacheError();
    expect(response.status).toBe(500);
  });

  it('ErrorResponse.fileUploadFailed() → 500', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.fileUploadFailed();
    expect(response.status).toBe(500);
  });

  it('ErrorResponse.serviceUnavailable() with message → 503', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.serviceUnavailable('maintenance');
    expect(response.status).toBe(503);
  });

  it('ErrorResponse.externalServiceError() → 503', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.externalServiceError('Stripe');
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.message).toContain('Stripe');
  });

  it('ErrorResponse.securityValidationFailed() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.securityValidationFailed();
    expect(response.status).toBe(403);
  });

  it('ErrorResponse.blockedUrl() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.blockedUrl('http://evil.com');
    expect(response.status).toBe(403);
  });

  it('ErrorResponse.suspiciousActivity() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.suspiciousActivity();
    expect(response.status).toBe(403);
  });

  it('ErrorResponse.ipBlocked() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.ipBlocked('192.168.1.100');
    expect(response.status).toBe(403);
  });

  it('ErrorResponse.corsViolation() → 403', async () => {
    const { ErrorResponse } = await import('@withwiz/error/error-handler');
    const response = ErrorResponse.corsViolation('https://evil.com');
    expect(response.status).toBe(403);
  });
});
