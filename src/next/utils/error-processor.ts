/**
 * ErrorProcessor - 중앙 집중식 에러 처리
 *
 * API 라우트와 미들웨어에서 발생하는 모든 에러를 일관되게 처리합니다.
 * 5자리 HTTP 확장 에러 코드 체계를 사용합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@withwiz/toolkit/core/logger/logger';
import { logApiRequest, logApiResponse } from '@withwiz/toolkit/core/logger/logger';
import { ERROR_CODES, formatErrorMessage, getHttpStatus } from '@withwiz/toolkit/core/constants/error-codes';
import { AppError } from '@withwiz/toolkit/core/error/app-error';
import type { ISerializedError } from '@withwiz/toolkit/core/error/app-error';
import { summarizeErrorForLog, truncateErrorMessage } from '@withwiz/toolkit/core/error/extract-error-info';
import {
  inspectPrismaError,
  getPrismaErrorMapping,
  PRISMA_VALIDATION_MESSAGE,
} from '@withwiz/toolkit/core/error/prisma-error';

// ProcessedError 타입 (AppError의 ISerializedError와 호환)
export type ProcessedError = ISerializedError;

// Prisma 에러 코드 매핑은 core/error/prisma-error 의 단일 기준표(PRISMA_ERROR_MAP)를 사용한다.

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

/** 오류 값에서 로그용 메시지를 읽는다 (Error 가 아닌 객체도 허용). */
function readErrorMessage(error: unknown): unknown {
  if (!error || typeof error !== 'object') return undefined;
  return (error as { message?: unknown }).message;
}

/**
 * Prisma 오류를 공통 매핑표(PRISMA_ERROR_MAP) 기준의 ProcessedError 로 변환한다.
 * Prisma 오류가 아니면 null.
 *
 * ErrorProcessor.process() 와 handlePrismaError() 가 이 함수를 공유하므로
 * 두 경로의 상태 코드·에러 코드·메시지가 항상 같다.
 */
function resolvePrismaError(error: unknown): ProcessedError | null {
  // code 속성/클래스 이름 우선 판정. 메시지 스캔은 앞부분 제한 폴백.
  const info = inspectPrismaError(error);
  if (!info) return null;

  // PrismaClientValidationError 등 code 가 없는 입력 검증 오류 → 400
  if (info.kind === 'validation') {
    logger.warn('Prisma validation error', {
      prismaErrorName: info.name,
      message: truncateErrorMessage(readErrorMessage(error)),
    });
    return {
      code: ERROR_CODES.VALIDATION_ERROR.code,
      message: formatErrorMessage(ERROR_CODES.VALIDATION_ERROR.code, PRISMA_VALIDATION_MESSAGE),
      status: 400,
      key: 'VALIDATION_ERROR',
      category: 'validation',
      timestamp: new Date().toISOString(),
    };
  }

  const prismaCode = info.code;
  const mapping = getPrismaErrorMapping(prismaCode);

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

  // 매핑되지 않은 Prisma 에러 - 내부 코드는 로그에만 기록 (메시지는 길이 제한)
  logger.error('Unmapped Prisma error', {
    prismaCode,
    prismaErrorName: info.name,
    message: truncateErrorMessage(readErrorMessage(error)),
  });
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
   * Prisma 에러 추출 및 처리 (공통 매핑표 기준, resolvePrismaError 참조)
   */
  private static extractPrismaError(error: Error): ProcessedError | null {
    return resolvePrismaError(error);
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
        originalError: summarizeErrorForLog(error),
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
          error: truncateErrorMessage(error.message),
          stack: truncateErrorMessage(error.stack),
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
          error: summarizeErrorForLog(error),
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
 *
 * 공통 매핑표(PRISMA_ERROR_MAP) 기준으로 ErrorProcessor.process() 와 같은
 * 상태 코드·에러 코드·메시지를 응답한다. 응답 본문에는 Prisma 내부 코드
 * (details.prismaCode)를 싣지 않는다. Prisma 오류가 아니면 500 DATABASE_ERROR.
 */
export function handlePrismaError(error: unknown): NextResponse {
  const processed = resolvePrismaError(error);
  const errorInfo = ERROR_CODES.DATABASE_ERROR;
  const code = processed?.code ?? errorInfo.code;
  const message = processed?.message ?? formatErrorMessage(errorInfo.code);
  const status = processed?.status ?? errorInfo.status;

  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
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
