/**
 * ErrorProcessor - 중앙 집중식 에러 처리
 *
 * API 라우트와 미들웨어에서 발생하는 모든 에러를 일관되게 처리합니다.
 * 5자리 HTTP 확장 에러 코드 체계를 사용합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@withwiz/logger/logger';
import { logApiRequest, logApiResponse } from '@withwiz/logger/logger';
import { ERROR_CODES, formatErrorMessage, getHttpStatus } from '@withwiz/constants/error-codes';
import { AppError } from '@withwiz/error/app-error';
import type { ISerializedError } from '@withwiz/error/app-error';

// ProcessedError 타입 (AppError의 ISerializedError와 호환)
export type ProcessedError = ISerializedError;

/**
 * Prisma 에러 코드 매핑 (5자리 코드)
 */
const PRISMA_ERROR_MAP: Record<string, { code: number; message: string; status: number }> = {
  P2000: { code: 40001, message: '입력값이 너무 깁니다.', status: 400 },
  P2001: { code: 40401, message: '요청한 레코드를 찾을 수 없습니다.', status: 404 },
  P2002: { code: 40905, message: '이미 존재하는 데이터입니다.', status: 409 },
  P2003: { code: 40001, message: '외래 키 제약 조건 위반입니다.', status: 400 },
  P2004: { code: 40001, message: '데이터베이스 제약 조건 위반입니다.', status: 400 },
  P2005: { code: 40001, message: '유효하지 않은 필드 값입니다.', status: 400 },
  P2006: { code: 40001, message: '유효하지 않은 값입니다.', status: 400 },
  P2011: { code: 40004, message: 'Null 제약 조건 위반입니다.', status: 400 },
  P2014: { code: 40001, message: '필수 관계 위반입니다.', status: 400 },
  P2015: { code: 40401, message: '관련 레코드를 찾을 수 없습니다.', status: 404 },
  P2016: { code: 40001, message: '쿼리 해석 오류입니다.', status: 400 },
  P2017: { code: 40001, message: '관계가 연결되지 않았습니다.', status: 400 },
  P2018: { code: 40401, message: '연결된 레코드를 찾을 수 없습니다.', status: 404 },
  P2025: { code: 40401, message: '요청한 레코드를 찾을 수 없습니다.', status: 404 },
};

/**
 * 에러 핸들링 옵션
 */
export interface IErrorHandlerOptions {
  /** 커스텀 에러 핸들러 함수 */
  customErrorHandler?: (error: unknown, request: NextRequest) => NextResponse;
  /** 커스텀 응답 보존 여부 (기본값: false) */
  preserveCustomResponses?: boolean;
  /** 에러 로깅 레벨 (기본값: 'error') */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 민감한 정보 마스킹 여부 (기본값: true) */
  maskSensitiveInfo?: boolean;
}

/**
 * 중앙 에러 처리기
 */
export class ErrorProcessor {
  /**
   * 에러를 처리하여 표준화된 응답으로 변환
   */
  static process(error: unknown): ProcessedError {
    // 1. AppError 인스턴스
    if (error instanceof AppError) {
      return error.toJSON();
    }

    // 2. Zod 검증 에러
    if (error instanceof z.ZodError) {
      return this.handleZodError(error);
    }

    // 3. 일반 Error 인스턴스
    if (error instanceof Error) {
      // Prisma 에러 확인
      const prismaError = this.extractPrismaError(error);
      if (prismaError) {
        return prismaError;
      }

      // 특정 에러 메시지 패턴 확인
      if (error.message.includes('Unique constraint failed')) {
        return {
          code: ERROR_CODES.DUPLICATE_RESOURCE.code,
          message: formatErrorMessage(ERROR_CODES.DUPLICATE_RESOURCE.code),
          status: 409,
          key: 'DUPLICATE_RESOURCE',
          category: 'conflict',
          timestamp: new Date().toISOString(),
        };
      }

      if (error.message.includes('not found') || error.message.includes('Not found')) {
        return {
          code: ERROR_CODES.NOT_FOUND.code,
          message: formatErrorMessage(ERROR_CODES.NOT_FOUND.code, error.message),
          status: 404,
          key: 'NOT_FOUND',
          category: 'resource',
          timestamp: new Date().toISOString(),
        };
      }

      if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
        return {
          code: ERROR_CODES.UNAUTHORIZED.code,
          message: formatErrorMessage(ERROR_CODES.UNAUTHORIZED.code, error.message),
          status: 401,
          key: 'UNAUTHORIZED',
          category: 'auth',
          timestamp: new Date().toISOString(),
        };
      }

      // 일반 에러 - 내부 에러 메시지는 사용자에게 노출하지 않음
      return {
        code: ERROR_CODES.SERVER_ERROR.code,
        message: formatErrorMessage(ERROR_CODES.SERVER_ERROR.code),
        status: 500,
        key: 'SERVER_ERROR',
        category: 'server',
        timestamp: new Date().toISOString(),
      };
    }

    // 4. 알 수 없는 에러
    return {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: formatErrorMessage(ERROR_CODES.INTERNAL_SERVER_ERROR.code),
      status: 500,
      key: 'INTERNAL_SERVER_ERROR',
      category: 'server',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Zod 검증 에러 처리
   */
  private static handleZodError(error: z.ZodError): ProcessedError {
    const issues = error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    const firstMessage = issues[0]?.message || ERROR_CODES.VALIDATION_ERROR.message;

    return {
      code: ERROR_CODES.VALIDATION_ERROR.code,
      message: formatErrorMessage(ERROR_CODES.VALIDATION_ERROR.code, firstMessage),
      status: 400,
      key: 'VALIDATION_ERROR',
      category: 'validation',
      details: { issues },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Prisma 에러 추출 및 처리
   */
  private static extractPrismaError(error: Error): ProcessedError | null {
    // Prisma 에러 코드 추출 (P2xxx 형식)
    const codeMatch = error.message.match(/P\d{4}/);
    if (!codeMatch) return null;

    const prismaCode = codeMatch[0];
    const mapping = PRISMA_ERROR_MAP[prismaCode];

    if (mapping) {
      return {
        code: mapping.code,
        message: formatErrorMessage(mapping.code, mapping.message),
        status: mapping.status,
        key: 'DATABASE_ERROR',
        category: 'server',
        details: { prismaCode },
        timestamp: new Date().toISOString(),
      };
    }

    // 매핑되지 않은 Prisma 에러 - 내부 코드는 로그에만 기록
    logger.error('Unmapped Prisma error', { prismaCode, message: error.message });
    return {
      code: ERROR_CODES.DATABASE_ERROR.code,
      message: formatErrorMessage(ERROR_CODES.DATABASE_ERROR.code),
      status: 500,
      key: 'DATABASE_ERROR',
      category: 'server',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 에러를 NextResponse로 변환
   */
  static toResponse(error: unknown, requestPath?: string): NextResponse {
    const processed = this.process(error);

    // 에러 로깅
    if (processed.status >= 500) {
      logger.error('Server error', {
        code: processed.code,
        message: processed.message,
        status: processed.status,
        path: requestPath,
        details: processed.details,
        originalError: error instanceof Error ? error.stack : error,
      });
    } else if (processed.status >= 400) {
      logger.warn('Client error', {
        code: processed.code,
        message: processed.message,
        status: processed.status,
        path: requestPath,
      });
    }

    // NextResponse.json 직접 사용
    return NextResponse.json(
      {
        success: false,
        error: {
          code: processed.code,
          message: processed.message,
          details: processed.details,
        },
      },
      { status: processed.status }
    );
  }

  /**
   * 에러 핸들러 래퍼 함수 (간단한 버전)
   * try-catch 블록을 대체하여 사용
   */
  static withErrorHandling<T extends (...args: unknown[]) => Promise<NextResponse>>(handler: T): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await handler(...args);
      } catch (error) {
        return this.toResponse(error);
      }
    }) as T;
  }
}

/**
 * 에러 핸들링 미들웨어 (고급 버전)
 * 로깅, 민감 정보 마스킹 등 추가 기능 제공
 */
export function withErrorHandling<T extends unknown[], TRequest extends NextRequest = NextRequest>(
  handler: (request: TRequest, ...args: T) => Promise<NextResponse>,
  options: IErrorHandlerOptions = {}
) {
  return async (request: TRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now();

    try {
      // API 요청 로깅
      await logApiRequest(request);

      // 핸들러 실행
      const response = await handler(request, ...args);

      // 응답 로깅
      logApiResponse(request, response);

      // 커스텀 응답 보존 옵션이 활성화된 경우
      if (options.preserveCustomResponses && response.status !== 200) {
        return response;
      }

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // 커스텀 에러 핸들러가 있는 경우
      if (options.customErrorHandler) {
        try {
          const customResponse = options.customErrorHandler(error, request);
          logApiResponse(request, customResponse);
          return customResponse;
        } catch (customError) {
          logger.error('Custom error handler failed:', { error: customError, originalError: error });
        }
      }

      // 에러 타입별 처리
      let response: NextResponse;

      if (error instanceof z.ZodError) {
        // Zod 검증 에러
        const issues = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        const firstMessage = issues[0]?.message || ERROR_CODES.VALIDATION_ERROR.message;

        response = NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR.code,
              message: formatErrorMessage(ERROR_CODES.VALIDATION_ERROR.code, firstMessage),
              details: { issues },
            },
          },
          { status: 400 }
        );

        logger.warn('Validation error:', {
          error: issues,
          responseTime: `${responseTime}ms`,
          path: request.nextUrl.pathname,
        });
      } else if (error instanceof AppError) {
        // AppError 인스턴스
        response = NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          { status: error.status }
        );

        logger[options.logLevel || 'error']('App error:', {
          error: error.message,
          code: error.code,
          status: error.status,
          responseTime: `${responseTime}ms`,
          path: request.nextUrl.pathname,
        });
      } else if (error instanceof Error) {
        // 일반 JavaScript 에러
        response = ErrorProcessor.toResponse(error, request.nextUrl.pathname);
        logger.error('Unexpected error:', {
          error: error.message,
          stack: error.stack,
          responseTime: `${responseTime}ms`,
          path: request.nextUrl.pathname,
        });
      } else {
        // 알 수 없는 에러
        response = NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.SERVER_ERROR.code,
              message: formatErrorMessage(ERROR_CODES.SERVER_ERROR.code),
            },
          },
          { status: 500 }
        );

        logger.error('Unknown error:', {
          error,
          responseTime: `${responseTime}ms`,
          path: request.nextUrl.pathname,
        });
      }

      // 민감한 정보 마스킹
      if (options.maskSensitiveInfo) {
        response = await maskSensitiveInfo(response);
      }

      // 응답 로깅
      logApiResponse(request, response);

      return response;
    }
  };
}

/**
 * 민감한 정보 마스킹 함수
 */
async function maskSensitiveInfo(response: NextResponse): Promise<NextResponse> {
  try {
    const clonedResponse = response.clone();
    const body = await clonedResponse.json();

    if (body.error?.details) {
      delete body.error.details;
    }

    if (body.data?.password) {
      body.data.password = '***';
    }

    return NextResponse.json(body, { status: response.status });
  } catch {
    return response;
  }
}

// ============================================
// 헬퍼 함수들
// ============================================

/**
 * Prisma 에러 처리 헬퍼
 */
export function handlePrismaError(error: unknown): NextResponse {
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string };
    if (prismaError.code === 'P2002') {
      const errorInfo = ERROR_CODES.DUPLICATE_RESOURCE;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: errorInfo.code,
            message: formatErrorMessage(errorInfo.code),
          },
        },
        { status: errorInfo.status }
      );
    }
    if (prismaError.code === 'P2025') {
      const errorInfo = ERROR_CODES.NOT_FOUND;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: errorInfo.code,
            message: formatErrorMessage(errorInfo.code),
          },
        },
        { status: errorInfo.status }
      );
    }
    if (prismaError.code === 'P2003') {
      const errorInfo = ERROR_CODES.BUSINESS_RULE_VIOLATION;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: errorInfo.code,
            message: formatErrorMessage(errorInfo.code),
          },
        },
        { status: errorInfo.status }
      );
    }
  }

  const errorInfo = ERROR_CODES.DATABASE_ERROR;
  return NextResponse.json(
    {
      success: false,
      error: {
        code: errorInfo.code,
        message: formatErrorMessage(errorInfo.code),
      },
    },
    { status: errorInfo.status }
  );
}

/**
 * 비즈니스 로직 에러를 위한 헬퍼들
 */
export function throwBusinessRuleError(message?: string, code?: number): never {
  throw code ? new AppError(code, message) : AppError.businessRule(message);
}

export function throwNotFoundError(message?: string, code?: number): never {
  throw code ? new AppError(code, message) : AppError.notFound(message);
}

export function throwConflictError(message?: string, code?: number): never {
  throw code ? new AppError(code, message) : AppError.conflict(message);
}

export function throwForbiddenError(message?: string, code?: number): never {
  throw code ? new AppError(code, message) : AppError.forbidden(message);
}

export function throwUnauthorizedError(message?: string, code?: number): never {
  throw code ? new AppError(code, message) : AppError.unauthorized(message);
}

export function throwValidationError(message?: string, code?: number): never {
  throw code ? new AppError(code, message) : AppError.validation(message);
}

export function throwBadRequestError(message?: string, code?: number): never {
  throw code ? new AppError(code, message) : AppError.badRequest(message);
}

// 편의 함수 export
export const processError = ErrorProcessor.process.bind(ErrorProcessor);
export const errorToResponse = ErrorProcessor.toResponse.bind(ErrorProcessor);

export default ErrorProcessor;
