/**
 * classifyError() 및 AuthError → processError 통합 테스트
 */
import { describe, it, expect, vi } from 'vitest';
import {
  classifyError,
  ERROR_CODES,
} from '@withwiz/constants/error-codes';

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// ============================================================================
// classifyError 단위 테스트
// ============================================================================
describe('classifyError', () => {
  // 클라이언트 에러 메시지 패턴
  it('should classify "not found" message as NOT_FOUND', () => {
    const result = classifyError(new Error('Resource not found'));
    expect(result.code).toBe(ERROR_CODES.NOT_FOUND.code);
    expect(result.status).toBe(404);
  });

  it('should classify "unauthorized" message as UNAUTHORIZED', () => {
    const result = classifyError(new Error('Unauthorized access'));
    expect(result.code).toBe(ERROR_CODES.UNAUTHORIZED.code);
    expect(result.status).toBe(401);
  });

  it('should classify "forbidden" message as FORBIDDEN', () => {
    const result = classifyError(new Error('Forbidden'));
    expect(result.code).toBe(ERROR_CODES.FORBIDDEN.code);
    expect(result.status).toBe(403);
  });

  it('should classify "access denied" message as FORBIDDEN', () => {
    const result = classifyError(new Error('Access denied'));
    expect(result.code).toBe(ERROR_CODES.FORBIDDEN.code);
  });

  it('should classify "rate limit" message as RATE_LIMIT_EXCEEDED', () => {
    const result = classifyError(new Error('Rate limit exceeded'));
    expect(result.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED.code);
    expect(result.status).toBe(429);
  });

  it('should classify "too many requests" message as RATE_LIMIT_EXCEEDED', () => {
    const result = classifyError(new Error('Too many requests'));
    expect(result.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED.code);
  });

  // DB/Prisma 에러
  it('should classify Prisma error code pattern as DATABASE_ERROR', () => {
    const result = classifyError(new Error('P2010: Raw query failed'));
    expect(result.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
    expect(result.status).toBe(500);
  });

  it('should classify "database" keyword as DATABASE_ERROR', () => {
    const result = classifyError(new Error('Database connection failed'));
    expect(result.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
  });

  it('should classify "prisma" keyword as DATABASE_ERROR', () => {
    const result = classifyError(new Error('Prisma client error'));
    expect(result.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
  });

  // 네트워크/외부 서비스 에러
  it('should classify ECONNREFUSED as EXTERNAL_SERVICE_ERROR', () => {
    const error = new Error('Connection refused');
    (error as NodeJS.ErrnoException).code = 'ECONNREFUSED';
    const result = classifyError(error);
    expect(result.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
    expect(result.status).toBe(503);
  });

  it('should classify ETIMEDOUT as EXTERNAL_SERVICE_ERROR', () => {
    const error = new Error('Connection timed out');
    (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
    const result = classifyError(error);
    expect(result.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
  });

  it('should classify ECONNRESET as EXTERNAL_SERVICE_ERROR', () => {
    const error = new Error('Connection reset');
    (error as NodeJS.ErrnoException).code = 'ECONNRESET';
    const result = classifyError(error);
    expect(result.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
  });

  it('should classify ENOTFOUND as EXTERNAL_SERVICE_ERROR', () => {
    const error = new Error('DNS lookup failed');
    (error as NodeJS.ErrnoException).code = 'ENOTFOUND';
    const result = classifyError(error);
    expect(result.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
  });

  it('should classify "fetch failed" message as EXTERNAL_SERVICE_ERROR', () => {
    const result = classifyError(new Error('fetch failed'));
    expect(result.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
  });

  // Redis/캐시 에러
  it('should classify "redis" keyword as CACHE_ERROR', () => {
    const result = classifyError(new Error('Redis connection timeout'));
    expect(result.code).toBe(ERROR_CODES.CACHE_ERROR.code);
    expect(result.status).toBe(500);
  });

  it('should classify "upstash" keyword as CACHE_ERROR', () => {
    const result = classifyError(new Error('Upstash connection failed'));
    expect(result.code).toBe(ERROR_CODES.CACHE_ERROR.code);
  });

  // 이메일 전송 에러
  it('should classify email send error as EMAIL_SEND_FAILED', () => {
    const result = classifyError(new Error('Failed to send email via SMTP'));
    expect(result.code).toBe(ERROR_CODES.EMAIL_SEND_FAILED.code);
  });

  it('should classify email smtp error as EMAIL_SEND_FAILED', () => {
    const result = classifyError(new Error('SMTP email delivery failed'));
    expect(result.code).toBe(ERROR_CODES.EMAIL_SEND_FAILED.code);
  });

  // 파일 업로드 에러
  it('should classify "upload" keyword as FILE_UPLOAD_FAILED', () => {
    const result = classifyError(new Error('File upload failed'));
    expect(result.code).toBe(ERROR_CODES.FILE_UPLOAD_FAILED.code);
  });

  it('should classify "s3" keyword as FILE_UPLOAD_FAILED', () => {
    const result = classifyError(new Error('S3 bucket error'));
    expect(result.code).toBe(ERROR_CODES.FILE_UPLOAD_FAILED.code);
  });

  // 분류 불가 → fallback
  it('should fall back to SERVER_ERROR for unrecognized errors', () => {
    const result = classifyError(new Error('Something unexpected happened'));
    expect(result.code).toBe(ERROR_CODES.SERVER_ERROR.code);
    expect(result.status).toBe(500);
  });

  it('should fall back to SERVER_ERROR for generic TypeError', () => {
    const result = classifyError(new TypeError('Cannot read property of null'));
    expect(result.code).toBe(ERROR_CODES.SERVER_ERROR.code);
  });
});

// ============================================================================
// AuthError → processError 통합 테스트
// ============================================================================
describe('AuthError → processError integration', () => {
  it('should map TOKEN_EXPIRED AuthError to 40103', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { JWTError } = await import('@withwiz/auth/errors');

    const error = new JWTError('Token has expired', 'TOKEN_EXPIRED');
    const result = processError(error);

    expect(result.code).toBe(ERROR_CODES.TOKEN_EXPIRED.code);
    expect(result.status).toBe(401);
  });

  it('should map TOKEN_INVALID AuthError to INVALID_TOKEN code', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { JWTError } = await import('@withwiz/auth/errors');

    const error = new JWTError('Invalid token', 'TOKEN_INVALID');
    const result = processError(error);

    expect(result.code).toBe(ERROR_CODES.INVALID_TOKEN.code);
    expect(result.status).toBe(401);
  });

  it('should map TOKEN_CREATION_FAILED to SERVER_ERROR', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { JWTError } = await import('@withwiz/auth/errors');

    const error = new JWTError('JWT secret too short', 'TOKEN_CREATION_FAILED');
    const result = processError(error);

    expect(result.code).toBe(ERROR_CODES.SERVER_ERROR.code);
    expect(result.status).toBe(500);
  });

  it('should map PASSWORD_HASH_FAILED to SERVER_ERROR', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { PasswordError } = await import('@withwiz/auth/errors');

    const error = new PasswordError('Hash failed', 'PASSWORD_HASH_FAILED');
    const result = processError(error);

    expect(result.code).toBe(ERROR_CODES.SERVER_ERROR.code);
    expect(result.status).toBe(500);
  });

  it('should map OAUTH_TOKEN_EXCHANGE_FAILED to EXTERNAL_SERVICE_ERROR', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { OAuthError } = await import('@withwiz/auth/errors');

    const error = new OAuthError('Token exchange failed', 'OAUTH_TOKEN_EXCHANGE_FAILED');
    const result = processError(error);

    expect(result.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
    expect(result.status).toBe(503);
  });

  it('should map INVALID_CREDENTIALS to correct code', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { AuthError } = await import('@withwiz/auth/errors');

    const error = new AuthError('Wrong password', 'INVALID_CREDENTIALS', 401);
    const result = processError(error);

    expect(result.code).toBe(ERROR_CODES.INVALID_CREDENTIALS.code);
    expect(result.status).toBe(401);
  });

  it('should fallback unmapped AuthError to statusCode-based code', async () => {
    const { processError } = await import('@withwiz/error/error-handler');
    const { AuthError } = await import('@withwiz/auth/errors');

    const error = new AuthError('Unknown auth error', 'UNKNOWN_CODE', 401);
    const result = processError(error);

    expect(result.code).toBe(ERROR_CODES.UNAUTHORIZED.code);
    expect(result.status).toBe(401);
  });
});
