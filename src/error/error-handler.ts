/**
 * 통합 에러 핸들러
 * API 라우트 및 미들웨어에서 발생하는 모든 에러를 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@withwiz/logger/logger';
import { ERROR_CODES, formatErrorMessage, getHttpStatus, classifyError } from '@withwiz/constants/error-codes';
import { AppError } from './app-error';
import { AuthError } from '@withwiz/auth/errors';

// AuthError.code → ERROR_CODES 키 매핑
export const AUTH_ERROR_CODE_MAP: Record<string, number> = {
  // JWT
  TOKEN_EXPIRED: ERROR_CODES.TOKEN_EXPIRED.code,
  TOKEN_INVALID: ERROR_CODES.INVALID_TOKEN.code,
  TOKEN_CREATION_FAILED: ERROR_CODES.SERVER_ERROR.code,
  TOKEN_VERIFICATION_FAILED: ERROR_CODES.INVALID_TOKEN.code,
  REFRESH_TOKEN_EXPIRED: ERROR_CODES.TOKEN_EXPIRED.code,
  INVALID_PAYLOAD: ERROR_CODES.INVALID_TOKEN.code,
  // OAuth
  OAUTH_PROVIDER_NOT_CONFIGURED: ERROR_CODES.EXTERNAL_SERVICE_ERROR.code,
  OAUTH_TOKEN_EXCHANGE_FAILED: ERROR_CODES.EXTERNAL_SERVICE_ERROR.code,
  OAUTH_USER_INFO_FAILED: ERROR_CODES.EXTERNAL_SERVICE_ERROR.code,
  // Password
  PASSWORD_TOO_SHORT: ERROR_CODES.PASSWORD_TOO_WEAK.code,
  PASSWORD_TOO_LONG: ERROR_CODES.PASSWORD_TOO_WEAK.code,
  PASSWORD_MISSING_NUMBER: ERROR_CODES.PASSWORD_TOO_WEAK.code,
  PASSWORD_MISSING_UPPERCASE: ERROR_CODES.PASSWORD_TOO_WEAK.code,
  PASSWORD_MISSING_LOWERCASE: ERROR_CODES.PASSWORD_TOO_WEAK.code,
  PASSWORD_MISSING_SPECIAL_CHAR: ERROR_CODES.PASSWORD_TOO_WEAK.code,
  PASSWORD_HASH_FAILED: ERROR_CODES.SERVER_ERROR.code,
  PASSWORD_VERIFY_FAILED: ERROR_CODES.SERVER_ERROR.code,
  // Email
  EMAIL_SEND_FAILED: ERROR_CODES.EMAIL_SEND_FAILED.code,
  EMAIL_TOKEN_EXPIRED: ERROR_CODES.TOKEN_EXPIRED.code,
  EMAIL_TOKEN_INVALID: ERROR_CODES.INVALID_TOKEN.code,
  // Generic
  INVALID_CREDENTIALS: ERROR_CODES.INVALID_CREDENTIALS.code,
  USER_NOT_FOUND: ERROR_CODES.USER_NOT_FOUND.code,
  EMAIL_ALREADY_EXISTS: ERROR_CODES.EMAIL_ALREADY_EXISTS.code,
  UNAUTHORIZED: ERROR_CODES.UNAUTHORIZED.code,
};

// Prisma 에러 코드 매핑
const PRISMA_ERROR_MAP: Record<string, { code: number; message: string }> = {
  P2000: { code: 40001, message: '입력값이 너무 깁니다.' },
  P2001: { code: 40401, message: '레코드를 찾을 수 없습니다.' },
  P2002: { code: 40905, message: '이미 존재하는 데이터입니다.' },
  P2003: { code: 40001, message: '외래 키 제약 조건 위반입니다.' },
  P2025: { code: 40401, message: '레코드를 찾을 수 없습니다.' },
};

/**
 * 에러 응답 형식
 */
export interface IErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    details?: unknown;
  };
}

/**
 * 에러를 NextResponse로 변환
 */
export function errorToResponse(error: unknown, requestPath?: string): NextResponse<IErrorResponse> {
  const processed = processError(error);

  // 로깅
  if (processed.status >= 500) {
    logger.error('Server error', { ...processed, path: requestPath, stack: error instanceof Error ? error.stack : undefined });
  } else if (processed.status >= 400) {
    logger.warn('Client error', { ...processed, path: requestPath });
  }

  return NextResponse.json(
    { success: false, error: { code: processed.code, message: processed.message, details: processed.details } },
    { status: processed.status }
  );
}

/**
 * 에러 처리 및 표준화
 */
export function processError(error: unknown): { code: number; message: string; status: number; details?: unknown } {
  // 1. AppError
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, status: error.status, details: error.details };
  }

  // 2. Zod 검증 에러
  if (error instanceof z.ZodError) {
    const issues = error.errors.map(e => ({ path: e.path.join('.'), message: e.message }));
    return {
      code: ERROR_CODES.VALIDATION_ERROR.code,
      message: formatErrorMessage(ERROR_CODES.VALIDATION_ERROR.code, issues[0]?.message),
      status: 400,
      details: { issues },
    };
  }

  // 3. AuthError (JWTError, OAuthError 등)
  if (error instanceof AuthError) {
    const mappedCode = AUTH_ERROR_CODE_MAP[error.code];
    if (mappedCode) {
      return { code: mappedCode, message: formatErrorMessage(mappedCode, error.message), status: getHttpStatus(mappedCode) };
    }
    // 매핑에 없는 AuthError는 statusCode 기반으로 처리
    const fallbackCode = error.statusCode === 401 ? ERROR_CODES.UNAUTHORIZED.code : ERROR_CODES.BAD_REQUEST.code;
    return { code: fallbackCode, message: formatErrorMessage(fallbackCode, error.message), status: error.statusCode };
  }

  // 4. 일반 Error
  if (error instanceof Error) {
    // Prisma 에러 확인
    const prismaMatch = error.message.match(/P\d{4}/);
    if (prismaMatch) {
      const mapping = PRISMA_ERROR_MAP[prismaMatch[0]];
      if (mapping) {
        return { code: mapping.code, message: formatErrorMessage(mapping.code, mapping.message), status: getHttpStatus(mapping.code) };
      }
    }

    // 공통 에러 분류
    const classified = classifyError(error);
    return { code: classified.code, message: formatErrorMessage(classified.code), status: classified.status };
  }

  // 4. 알 수 없는 에러
  return { code: ERROR_CODES.INTERNAL_SERVER_ERROR.code, message: formatErrorMessage(ERROR_CODES.INTERNAL_SERVER_ERROR.code), status: 500 };
}

/**
 * 에러 핸들링 미들웨어 래퍼
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return errorToResponse(error, request.nextUrl.pathname);
    }
  };
}

/**
 * 에러 응답 생성 유틸리티
 */
export const ErrorResponse = {
  // 400xx
  validation: (message?: string, details?: unknown) => errorToResponse(AppError.validation(message, details ? { ...details as object } : undefined)),
  badRequest: (message?: string) => errorToResponse(AppError.badRequest(message)),
  invalidInput: (message?: string) => errorToResponse(AppError.invalidInput(message)),
  missingField: (fieldName: string) => errorToResponse(AppError.missingField(fieldName)),
  invalidUrl: () => errorToResponse(AppError.invalidUrl()),
  invalidEmail: () => errorToResponse(AppError.invalidEmail()),
  weakPassword: () => errorToResponse(AppError.weakPassword()),

  // 401xx
  unauthorized: (message?: string) => errorToResponse(AppError.unauthorized(message)),
  invalidToken: () => errorToResponse(AppError.invalidToken()),
  tokenExpired: () => errorToResponse(AppError.tokenExpired()),
  invalidCredentials: () => errorToResponse(AppError.invalidCredentials()),
  sessionExpired: () => errorToResponse(AppError.sessionExpired()),

  // 403xx
  forbidden: (message?: string) => errorToResponse(AppError.forbidden(message)),
  emailNotVerified: () => errorToResponse(AppError.emailNotVerified()),
  accountDisabled: () => errorToResponse(AppError.accountDisabled()),
  accountLocked: () => errorToResponse(AppError.accountLocked()),

  // 404xx
  notFound: (message?: string) => errorToResponse(AppError.notFound(message)),
  userNotFound: () => errorToResponse(AppError.userNotFound()),

  // 409xx
  conflict: (message?: string) => errorToResponse(AppError.conflict(message)),
  duplicate: (resource?: string) => errorToResponse(AppError.duplicate(resource)),
  emailExists: () => errorToResponse(AppError.emailExists()),

  // 422xx
  businessRule: (message?: string) => errorToResponse(AppError.businessRule(message)),
  invalidOperation: (message?: string) => errorToResponse(AppError.invalidOperation(message)),
  quotaExceeded: () => errorToResponse(AppError.quotaExceeded()),
  fileTooLarge: (maxSize?: string) => errorToResponse(AppError.fileTooLarge(maxSize)),
  unsupportedFileType: (fileType?: string) => errorToResponse(AppError.unsupportedFileType(fileType)),

  // 429xx
  rateLimit: () => errorToResponse(AppError.rateLimit()),
  dailyLimit: () => errorToResponse(AppError.dailyLimit()),
  apiQuotaExceeded: () => errorToResponse(AppError.apiQuotaExceeded()),
  
  // 500xx
  serverError: (message?: string) => errorToResponse(AppError.serverError(message)),
  internalError: (message?: string) => errorToResponse(AppError.internalError(message)),
  databaseError: (message?: string) => errorToResponse(AppError.databaseError(message)),
  emailSendFailed: () => errorToResponse(AppError.emailSendFailed()),
  cacheError: () => errorToResponse(AppError.cacheError()),
  fileUploadFailed: () => errorToResponse(AppError.fileUploadFailed()),

  // 503xx
  serviceUnavailable: (message?: string) => errorToResponse(AppError.serviceUnavailable(message)),
  externalServiceError: (service?: string) => errorToResponse(AppError.externalServiceError(service)),

  // 보안 (403xx 71~79)
  accessBlocked: (reason?: string) => errorToResponse(AppError.accessBlocked(reason)),
  securityValidationFailed: () => errorToResponse(AppError.securityValidationFailed()),
  blockedUrl: (url?: string) => errorToResponse(AppError.blockedUrl(url)),
  suspiciousActivity: () => errorToResponse(AppError.suspiciousActivity()),
  ipBlocked: (ip?: string) => errorToResponse(AppError.ipBlocked(ip)),
  corsViolation: (origin?: string) => errorToResponse(AppError.corsViolation(origin)),
};

export default { errorToResponse, processError, withErrorHandler, ErrorResponse };
