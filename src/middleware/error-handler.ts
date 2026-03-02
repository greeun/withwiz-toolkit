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
import type { TApiMiddleware } from './types';
import { AppError } from '@withwiz/error/app-error';
import { getErrorMessage } from '@withwiz/error/messages';
import { ERROR_CODES } from '@withwiz/constants/error-codes';
import { logger } from '@withwiz/logger/logger';

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
      return createErrorResponse(
        error.code,
        error.message,
        context.locale,
        context.requestId,
        error.details
      );
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

    // 알 수 없는 에러 (500)
    logger.error('[ErrorHandler] Unexpected error:', error);

    // 프로덕션 환경에서는 민감한 정보 숨김
    const isProduction = process.env.NODE_ENV === 'production';
    const safeMessage = isProduction
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');

    return createErrorResponse(
      ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      safeMessage,
      context.locale,
      context.requestId,
      // 개발 환경에서만 스택 트레이스 포함
      !isProduction && error instanceof Error
        ? { stack: error.stack?.split('\n').slice(0, 5) }
        : undefined
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
  metadata?: Record<string, unknown>
): NextResponse {
  // 사용자용 다중 언어 메시지
  const userMessage = getErrorMessage(code, locale);

  // HTTP 상태 코드 추출 (40907 -> 409)
  const httpStatus = Math.floor(code / 100);

  // 에러 응답 구조 (code는 별도 필드로 제공, message에 포함하지 않음)
  const errorResponse = {
    success: false,
    error: {
      code,
      message,
      userMessage: {
        title: userMessage.title,
        description: userMessage.description,
        action: userMessage.action,
      },
      requestId,
      ...(metadata && { metadata }),
    },
  };

  return NextResponse.json(errorResponse, {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
