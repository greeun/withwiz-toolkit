/**
 * Shared Auth Errors
 *
 * 프레임워크 독립적인 인증 에러 클래스
 */

// ============================================================================
// Base Auth Error
// ============================================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
}

// ============================================================================
// JWT Errors
// ============================================================================

export class JWTError extends AuthError {
  constructor(message: string, code: string = 'JWT_ERROR') {
    super(message, code, 401);
    this.name = 'JWTError';
  }
}

// ============================================================================
// OAuth Errors
// ============================================================================

export class OAuthError extends AuthError {
  constructor(message: string, code: string = 'OAUTH_ERROR') {
    super(message, code, 400);
    this.name = 'OAuthError';
  }
}

// ============================================================================
// Email Errors
// ============================================================================

export class EmailError extends AuthError {
  constructor(message: string, code: string = 'EMAIL_ERROR') {
    super(message, code, 500);
    this.name = 'EmailError';
  }
}

// ============================================================================
// Password Errors
// ============================================================================

export class PasswordError extends AuthError {
  constructor(message: string, code: string = 'PASSWORD_ERROR') {
    super(message, code, 400);
    this.name = 'PasswordError';
  }
}

// ============================================================================
// Error Codes (상수)
// ============================================================================

export const AUTH_ERROR_CODES = {
  // JWT Errors
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_CREATION_FAILED: 'TOKEN_CREATION_FAILED',
  TOKEN_VERIFICATION_FAILED: 'TOKEN_VERIFICATION_FAILED',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',

  // OAuth Errors
  OAUTH_PROVIDER_NOT_CONFIGURED: 'OAUTH_PROVIDER_NOT_CONFIGURED',
  OAUTH_TOKEN_EXCHANGE_FAILED: 'OAUTH_TOKEN_EXCHANGE_FAILED',
  OAUTH_USER_INFO_FAILED: 'OAUTH_USER_INFO_FAILED',

  // Password Errors
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
  PASSWORD_MISSING_NUMBER: 'PASSWORD_MISSING_NUMBER',
  PASSWORD_MISSING_UPPERCASE: 'PASSWORD_MISSING_UPPERCASE',
  PASSWORD_MISSING_LOWERCASE: 'PASSWORD_MISSING_LOWERCASE',
  PASSWORD_MISSING_SPECIAL_CHAR: 'PASSWORD_MISSING_SPECIAL_CHAR',
  PASSWORD_HASH_FAILED: 'PASSWORD_HASH_FAILED',
  PASSWORD_VERIFY_FAILED: 'PASSWORD_VERIFY_FAILED',

  // Email Errors
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  EMAIL_TOKEN_INVALID: 'EMAIL_TOKEN_INVALID',
  EMAIL_TOKEN_EXPIRED: 'EMAIL_TOKEN_EXPIRED',

  // Generic Errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];
