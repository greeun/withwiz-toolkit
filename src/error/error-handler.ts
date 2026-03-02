/**
 * 통합 에러 핸들러
 * API 라우트 및 미들웨어에서 발생하는 모든 에러를 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@withwiz/logger/logger';
import { ERROR_CODES, formatErrorMessage, getHttpStatus } from '@withwiz/constants/error-codes';
import { AppError } from './app-error';

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

  // 3. 일반 Error
  if (error instanceof Error) {
    // Prisma 에러 확인
    const prismaMatch = error.message.match(/P\d{4}/);
    if (prismaMatch) {
      const mapping = PRISMA_ERROR_MAP[prismaMatch[0]];
      if (mapping) {
        return { code: mapping.code, message: formatErrorMessage(mapping.code, mapping.message), status: getHttpStatus(mapping.code) };
      }
    }

    // 특정 패턴 매칭
    if (error.message.toLowerCase().includes('not found')) {
      return { code: ERROR_CODES.NOT_FOUND.code, message: formatErrorMessage(ERROR_CODES.NOT_FOUND.code), status: 404 };
    }
    if (error.message.toLowerCase().includes('unauthorized')) {
      return { code: ERROR_CODES.UNAUTHORIZED.code, message: formatErrorMessage(ERROR_CODES.UNAUTHORIZED.code), status: 401 };
    }

    // 기본 서버 에러
    return { code: ERROR_CODES.SERVER_ERROR.code, message: formatErrorMessage(ERROR_CODES.SERVER_ERROR.code), status: 500 };
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
  invalidUrl: () => errorToResponse(AppError.invalidUrl()),
  invalidEmail: () => errorToResponse(AppError.invalidEmail()),
  invalidAlias: () => errorToResponse(AppError.invalidAlias()),
  
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
  linkNotFound: () => errorToResponse(AppError.linkNotFound()),
  
  // 409xx
  conflict: (message?: string) => errorToResponse(AppError.conflict(message)),
  duplicate: (resource?: string) => errorToResponse(AppError.duplicate(resource)),
  emailExists: () => errorToResponse(AppError.emailExists()),
  aliasExists: () => errorToResponse(AppError.aliasExists()),
  
  // 422xx
  businessRule: (message?: string) => errorToResponse(AppError.businessRule(message)),
  linkExpired: () => errorToResponse(AppError.linkExpired()),
  linkInactive: () => errorToResponse(AppError.linkInactive()),
  linkPasswordRequired: () => errorToResponse(AppError.linkPasswordRequired()),
  linkPasswordIncorrect: () => errorToResponse(AppError.linkPasswordIncorrect()),
  reservedWord: () => errorToResponse(AppError.reservedWord()),
  quotaExceeded: () => errorToResponse(AppError.quotaExceeded()),
  
  // 429xx
  rateLimit: () => errorToResponse(AppError.rateLimit()),
  dailyLimit: () => errorToResponse(AppError.dailyLimit()),
  
  // 500xx
  serverError: (message?: string) => errorToResponse(AppError.serverError(message)),
  databaseError: () => errorToResponse(AppError.databaseError()),
  
  // 503xx
  serviceUnavailable: () => errorToResponse(AppError.serviceUnavailable()),
  externalServiceError: (service?: string) => errorToResponse(AppError.externalServiceError(service)),
  
  // 보안
  accessBlocked: () => errorToResponse(AppError.accessBlocked()),
  ipBlocked: () => errorToResponse(AppError.ipBlocked()),
};

export default { errorToResponse, processError, withErrorHandler, ErrorResponse };
