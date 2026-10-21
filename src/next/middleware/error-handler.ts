/**
 * 에러 핸들러 미들웨어
 *
 * - 모든 에러를 잡아서 표준 형식의 JSON 응답으로 변환
 * - AppError를 감지하여 적절한 HTTP 상태 코드 반환
 * - ZodError를 감지하여 400 Bad Request 반환
 * - 다중 언어 메시지 지원
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { TApiMiddleware } from '@withwiz/toolkit/next/middleware/types';
import { AppError } from '@withwiz/toolkit/core/error/app-error';
import { AUTH_ERROR_CODE_MAP } from '@withwiz/toolkit/next/error/error-handler';
import { getErrorMessage } from '@withwiz/toolkit/core/error/messages';
import { ERROR_CODES, classifyError, getHttpStatus, formatErrorMessage, getErrorByCode } from '@withwiz/toolkit/core/constants/error-codes';
import { representativeCode } from '@withwiz/toolkit/next/error/build-error-response';
import { summarizeErrorForLog, truncateErrorMessage } from '@withwiz/toolkit/core/error/extract-error-info';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import { logger } from '@withwiz/toolkit/core/logger/logger';
import { getCommonConfig } from '@withwiz/toolkit/core/config/common';

/**
 * 에러 핸들러 미들웨어
 *
 * 체인의 최상위에 배치하여 모든 에러를 캐치합니다.
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain()
 *   .use(errorHandlerMiddleware)  // 가장 먼저
 *   .use(initRequestMiddleware)
 *   .use(authMiddleware);
 * ```
 */
export const errorHandlerMiddleware: TApiMiddleware = async (
  context,
  next
) => {
  try {
    // 다음 미들웨어/핸들러 실행
    return await next();
  } catch (error) {
    // AppError인 경우
    if (error instanceof AppError) {
      const response = createErrorResponse(
        error.code,
        error.message,
        context.locale,
        context.requestId,
        error.details
      );
      if (response.status === 429) {
        applyRateLimitHeaders(response, error.details, context.metadata.rateLimit);
      }
      return response;
    }

    // ZodError인 경우 (validation failure -> 400)
    if (error instanceof z.ZodError) {
      const issues = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));
      const firstMessage = issues[0]?.message || 'Validation failed';

      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR.code,
        firstMessage,
        context.locale,
        context.requestId,
        { issues }
      );
    }

    // AuthError인 경우 (JWTError, OAuthError 등)
    if (error instanceof AuthError) {
      // key 는 인증 핸들러와 같이 AuthError 의 code 를 쓴다
      const mappedCode = AUTH_ERROR_CODE_MAP[error.code];
      if (mappedCode) {
        return createErrorResponse(
          mappedCode,
          error.message,
          context.locale,
          context.requestId,
          undefined,
          error.code
        );
      }
      // 매핑에 없는 AuthError는 statusCode 기반으로 처리
      const fallbackCode = error.statusCode === 401 ? ERROR_CODES.UNAUTHORIZED.code : ERROR_CODES.BAD_REQUEST.code;
      return createErrorResponse(
        fallbackCode,
        error.message,
        context.locale,
        context.requestId,
        undefined,
        error.code
      );
    }

    // 공통 에러 분류
    const classified = error instanceof Error
      ? classifyError(error)
      : ERROR_CODES.INTERNAL_SERVER_ERROR;

    // 스택 트레이스는 서버 로그에만 기록 (API 응답에는 포함하지 않음)
    // 난독화된 번들 소스가 통째로 기록되지 않도록 메시지/스택 길이를 제한한다.
    logger.error('[ErrorHandler] Unexpected error:', {
      error: summarizeErrorForLog(error),
      requestId: context.requestId,
      stack: error instanceof Error ? truncateErrorMessage(error.stack) : undefined,
    });

    return createErrorResponse(
      classified.code,
      classified.message,
      context.locale,
      context.requestId,
    );
  }
};

/**
 * 에러 응답 생성
 *
 * @param code - 에러 코드
 * @param message - 에러 메시지 (내부용)
 * @param locale - 로케일
 * @param requestId - 요청 ID
 * @param metadata - 추가 메타데이터
 */
function createErrorResponse(
  code: number,
  message: string,
  locale: 'ko' | 'en' | 'ja',
  requestId: string,
  metadata?: Record<string, unknown>,
  keyOverride?: string
): NextResponse {
  // 사용자용 다중 언어 메시지
  const userMessage = getErrorMessage(code, locale);

  // HTTP 상태 코드 추출 (40907 -> 409)
  const httpStatus = Math.floor(code / 100);

  // 0.21+: 기계 분기용 key 와 필드 오류(details.fieldErrors)를 함께 싣는다. 기존 필드는 그대로 둔다.
  const key = keyOverride ?? getErrorByCode(code)?.key ?? getErrorByCode(representativeCode(httpStatus))?.key ?? 'INTERNAL_SERVER_ERROR';
  const fieldErrors = fieldErrorsFromIssues(metadata?.issues);

  // 에러 응답 구조 (code는 별도 필드로 제공, message에 포함하지 않음)
  const errorResponse = {
    success: false,
    error: {
      code,
      key,
      message,
      userMessage: {
        title: userMessage.title,
        description: userMessage.description,
        action: userMessage.action,
      },
      requestId,
      ...(metadata && { metadata }),
      ...(fieldErrors && { details: { fieldErrors } }),
    },
  };

  return NextResponse.json(errorResponse, {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 429 응답에 Retry-After 와 X-RateLimit-* 헤더를 싣는다.
 *
 * 성공 응답의 X-RateLimit-* 는 responseLoggerMiddleware 가 붙이지만, 한도 초과는 예외로
 * 빠져나오므로 그 단계를 거치지 않는다. 남은 시간(초)은 details.resetIn(rate limit 미들웨어),
 * details.retryAfter(AppError.rateLimit), metadata.rateLimit.reset 순서로 찾는다.
 * 찾지 못하면 Retry-After 를 싣지 않는다.
 */
function applyRateLimitHeaders(
  response: NextResponse,
  details: Record<string, unknown> | undefined,
  rateLimit: unknown
): void {
  const meta = isRateLimitMeta(rateLimit) ? rateLimit : undefined;
  const seconds = [details?.resetIn, details?.retryAfter, meta?.reset].find(isFiniteNumber);

  if (seconds !== undefined) {
    // 0 은 "바로 재시도" 로 읽혀 재시도 루프를 만들 수 있으므로 최소 1초로 둔다
    response.headers.set('Retry-After', String(Math.max(1, Math.ceil(seconds))));
  }
  if (meta) {
    response.headers.set('X-RateLimit-Limit', String(meta.limit));
    response.headers.set('X-RateLimit-Remaining', String(meta.remaining));
    response.headers.set('X-RateLimit-Reset', String(meta.reset));
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRateLimitMeta(value: unknown): value is { limit: number; remaining: number; reset: number } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return isFiniteNumber(v.limit) && isFiniteNumber(v.remaining) && isFiniteNumber(v.reset);
}

/** zod issues(`{ path, message }`)를 `fieldErrors`(필드별 사유 배열)로 바꾼다. issues 가 없으면 undefined */
function fieldErrorsFromIssues(issues: unknown): Record<string, string[]> | undefined {
  if (!Array.isArray(issues) || issues.length === 0) return undefined;
  const out: Record<string, string[]> = {};
  for (const issue of issues as Array<{ path?: unknown; message?: unknown }>) {
    const field = typeof issue.path === 'string' && issue.path ? issue.path.split('.')[0] : undefined;
    if (!field || typeof issue.message !== 'string') continue;
    (out[field] ??= []).push(issue.message);
  }
  return Object.keys(out).length ? out : undefined;
}
