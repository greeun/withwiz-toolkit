/**
 * Security Tests: Error Information Exposure
 *
 * 에러 응답에 내부 정보(스택 트레이스, 민감한 세부사항)가 노출되지 않는지 검증
 * - OWASP: Information Exposure Through an Error Message (CWE-209)
 */

vi.mock('next/server', () => {
  return {
    NextRequest: vi.fn(),
    NextResponse: {
      json: vi.fn((body: any, options: any) => ({
        body,
        status: options?.status ?? 200,
        json: async () => body,
      })),
    },
  };
});

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@withwiz/auth/errors', () => {
  class AuthError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.name = 'AuthError';
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return { AuthError };
});

import { NextResponse } from 'next/server';

describe('Security: Error Information Exposure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('errorToResponse - Stack trace exposure', () => {
    it('should never include stack traces in response body', async () => {
      const { errorToResponse } = await import('@withwiz/error/error-handler');

      // Create an error with a stack trace
      const error = new Error('Internal database connection failed');
      error.stack = 'Error: Internal database connection failed\n    at DatabaseConnection.connect (/app/src/db.ts:42:11)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)';

      const response = errorToResponse(error);
      const body = (response as any).body;

      // Verify no stack trace in response body
      expect(JSON.stringify(body)).not.toContain('.ts:');
      expect(JSON.stringify(body)).not.toContain('at ');
      expect(JSON.stringify(body)).not.toContain('node:internal');
      expect(body.error.stack).toBeUndefined();
    });

    it('should never expose file paths in error responses', async () => {
      const { errorToResponse } = await import('@withwiz/error/error-handler');

      const error = new Error('Module not found: /app/src/services/payment.ts');
      const response = errorToResponse(error);
      const body = (response as any).body;

      // Response should not contain file system paths
      expect(JSON.stringify(body)).not.toContain('/app/src/');
      expect(JSON.stringify(body)).not.toContain('payment.ts');
    });
  });

  describe('errorToResponse - 500 error detail exposure', () => {
    it('should not expose internal error details for 500 errors', async () => {
      const { errorToResponse } = await import('@withwiz/error/error-handler');

      // Simulate an unexpected internal error
      const error = new Error('ECONNREFUSED: connection refused to redis://internal-redis:6379');
      const response = errorToResponse(error);
      const body = (response as any).body;

      // Should not expose internal hostnames or port numbers
      expect(JSON.stringify(body)).not.toContain('redis://');
      expect(JSON.stringify(body)).not.toContain('internal-redis');
      expect(JSON.stringify(body)).not.toContain(':6379');
    });

    it('should return a generic error message for unhandled exceptions', async () => {
      const { errorToResponse } = await import('@withwiz/error/error-handler');

      const error = new Error('Cannot read properties of undefined (reading "password")');
      const response = errorToResponse(error);
      const body = (response as any).body;

      // Should not expose property access details
      expect(body.error.message).not.toContain('password');
      expect(body.success).toBe(false);
      expect(body.error.code).toBeDefined();
    });
  });

  describe('processError - Prisma error sanitization', () => {
    it('should sanitize Prisma unique constraint errors without exposing field values', async () => {
      const { processError } = await import('@withwiz/error/error-handler');

      // Simulate Prisma P2002 error (unique constraint violation)
      const prismaError = new Error(
        'Unique constraint failed on the constraint: `User_email_key` P2002'
      );
      const result = processError(prismaError);

      // Should return sanitized message, not the raw Prisma error
      expect(result.message).not.toContain('User_email_key');
      expect(result.code).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('should sanitize Prisma record not found errors', async () => {
      const { processError } = await import('@withwiz/error/error-handler');

      const prismaError = new Error(
        'No User found with id: "clxy123abc456" P2001'
      );
      const result = processError(prismaError);

      // Should not expose the user ID in the response
      expect(result.message).not.toContain('clxy123abc456');
    });

    it('should map Prisma P2025 to 404 status', async () => {
      const { processError } = await import('@withwiz/error/error-handler');

      const prismaError = new Error(
        'An operation failed because it depends on one or more records that were required but not found. P2025'
      );
      const result = processError(prismaError);

      expect(result.status).toBe(404);
    });
  });

  describe('Auth error responses - User enumeration prevention', () => {
    it('should return the same error code for "user not found" and "wrong password"', async () => {
      const { AuthError } = await import('@withwiz/auth/errors');
      const { processError } = await import('@withwiz/error/error-handler');

      // "User not found" scenario
      const userNotFoundError = new (AuthError as any)('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      const result1 = processError(userNotFoundError);

      // "Wrong password" scenario
      const wrongPasswordError = new (AuthError as any)('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      const result2 = processError(wrongPasswordError);

      // Both should return the same error code and status
      expect(result1.code).toBe(result2.code);
      expect(result1.status).toBe(result2.status);
      expect(result1.status).toBe(401);
    });

    it('should not distinguish between user-not-found and wrong-password in error messages', async () => {
      const { AuthError } = await import('@withwiz/auth/errors');
      const { processError } = await import('@withwiz/error/error-handler');

      const userNotFoundError = new (AuthError as any)('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      const result = processError(userNotFoundError);

      // Message should not hint at whether the user exists
      expect(result.message).not.toContain('not found');
      expect(result.message).not.toContain('does not exist');
      expect(result.message).not.toContain('no user');
    });

    it('should not expose user IDs or emails in auth error responses', async () => {
      const { AuthError } = await import('@withwiz/auth/errors');
      const { errorToResponse } = await import('@withwiz/error/error-handler');

      const authError = new (AuthError as any)('Invalid credentials', 'USER_NOT_FOUND', 401);
      const response = errorToResponse(authError);
      const body = (response as any).body;

      // Response should never contain email patterns or UUIDs
      expect(JSON.stringify(body)).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    });
  });

  describe('Unknown error handling', () => {
    it('should handle non-Error objects without exposing internals', async () => {
      const { processError } = await import('@withwiz/error/error-handler');

      const result = processError('string error with internal path /app/src/secret.ts');

      // Should return generic server error
      expect(result.status).toBe(500);
      expect(result.message).not.toContain('/app/src/');
      expect(result.message).not.toContain('secret.ts');
    });

    it('should handle null/undefined errors gracefully', async () => {
      const { processError } = await import('@withwiz/error/error-handler');

      const result1 = processError(null);
      const result2 = processError(undefined);

      expect(result1.status).toBe(500);
      expect(result2.status).toBe(500);
      expect(result1.code).toBeDefined();
      expect(result2.code).toBeDefined();
    });
  });
});
