/**
 * 보안 미들웨어
 *
 * - TRACE/TRACK HTTP 메서드 차단
 * - Content-Type 검증
 * - 보안 헤더 강화
 */

import { NextResponse } from 'next/server';
import type { TApiMiddleware } from './types';
import { logger } from '../logger/logger';

// ============================================================================
// Origin 검증 (CSRF 방어)
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_allowed_origins: string[] | undefined;
}

export function setAllowedOrigins(origins: string[]): void {
  globalThis.__withwiz_allowed_origins = origins;
  logger.info(`[Security Middleware] Allowed origins configured: ${origins.join(', ')}`);
}

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

function verifyOrigin(request: Request): boolean {
  const allowedOrigins = globalThis.__withwiz_allowed_origins;
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return true; // 설정되지 않으면 검증 건너뛰기 (하위 호환)
  }

  const method = request.method.toUpperCase();
  if (!STATE_CHANGING_METHODS.includes(method as typeof STATE_CHANGING_METHODS[number])) {
    return true;
  }

  const origin = request.headers.get('origin');
  if (origin) {
    return allowedOrigins.some(allowed => origin === allowed);
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.some(allowed => refererOrigin === allowed);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * 차단할 HTTP 메서드 목록
 * TRACE/TRACK은 XST(Cross-Site Tracing) 공격에 사용될 수 있음
 */
const BLOCKED_METHODS = ['TRACE', 'TRACK'] as const;

/**
 * 허용되는 Content-Type 목록
 * API 요청에 허용되는 Content-Type만 지정
 */
const ALLOWED_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain', // 일부 클라이언트 호환성을 위해 허용하되 로깅
] as const;

/**
 * Content-Type 검증이 필요한 HTTP 메서드
 * GET, HEAD, OPTIONS는 body가 없으므로 제외
 */
const METHODS_REQUIRING_CONTENT_TYPE = ['POST', 'PUT', 'PATCH'] as const;

/**
 * 보안 미들웨어
 *
 * - TRACE/TRACK 메서드 차단 (405 Method Not Allowed)
 * - POST/PUT/PATCH 요청의 Content-Type 검증
 * - 보안 헤더 추가
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain()
 *   .use(errorHandlerMiddleware)
 *   .use(securityMiddleware)  // CORS 전에 배치
 *   .use(corsMiddleware)
 *   .use(initRequestMiddleware);
 * ```
 */
export const securityMiddleware: TApiMiddleware = async (context, next) => {
  const { request } = context;
  const method = request.method.toUpperCase();

  // 1. TRACE/TRACK 메서드 차단
  if (BLOCKED_METHODS.includes(method as typeof BLOCKED_METHODS[number])) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 40500,
          message: `Method ${method} is not allowed`,
          userMessage: {
            title: '허용되지 않는 메서드',
            description: `${method} 메서드는 보안상 이유로 허용되지 않습니다.`,
            action: '다른 HTTP 메서드를 사용해 주세요.',
          },
        },
      }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          Allow: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        },
      }
    );
  }

  // 2. Content-Type 검증 (POST, PUT, PATCH 요청만)
  if (METHODS_REQUIRING_CONTENT_TYPE.includes(method as typeof METHODS_REQUIRING_CONTENT_TYPE[number])) {
    const contentType = request.headers.get('content-type');

    // Content-Type 헤더가 없는 경우
    if (!contentType) {
      // body가 있는지 확인 (Content-Length > 0)
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 0) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              code: 41500,
              message: 'Content-Type header is required for requests with body',
              userMessage: {
                title: 'Content-Type 필수',
                description: '요청 본문이 있는 경우 Content-Type 헤더가 필요합니다.',
                action: 'Content-Type: application/json 헤더를 추가해 주세요.',
              },
            },
          }),
          {
            status: 415,
            headers: {
              'Content-Type': 'application/json',
              Accept: ALLOWED_CONTENT_TYPES.join(', '),
            },
          }
        );
      }
    }

    // Content-Type이 허용 목록에 없는 경우
    if (contentType) {
      const normalizedContentType = contentType.split(';')[0].trim().toLowerCase();
      const isAllowed = ALLOWED_CONTENT_TYPES.some((allowed) =>
        normalizedContentType === allowed || normalizedContentType.startsWith(allowed)
      );

      if (!isAllowed) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              code: 41501,
              message: `Unsupported Content-Type: ${normalizedContentType}`,
              userMessage: {
                title: '지원하지 않는 Content-Type',
                description: `${normalizedContentType}은(는) 지원되지 않습니다.`,
                action: 'application/json Content-Type을 사용해 주세요.',
              },
            },
          }),
          {
            status: 415,
            headers: {
              'Content-Type': 'application/json',
              Accept: ALLOWED_CONTENT_TYPES.join(', '),
            },
          }
        );
      }
    }
  }

  // 3. Origin 검증 (CSRF 방어 - state-changing 요청만)
  if (!verifyOrigin(request)) {
    logger.warn('[Security] Origin verification failed', {
      method,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      url: request.url,
    });
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 40300,
          message: 'Origin verification failed',
          userMessage: {
            title: '요청 거부',
            description: '허용되지 않은 출처에서의 요청입니다.',
            action: '올바른 페이지에서 다시 시도해 주세요.',
          },
        },
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 4. 다음 미들웨어 실행
  const response = await next();

  // 5. 추가 보안 헤더 설정
  // X-Content-Type-Options: MIME 타입 스니핑 방지
  if (!response.headers.has('X-Content-Type-Options')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }

  // X-Frame-Options: 클릭재킹 방지
  if (!response.headers.has('X-Frame-Options')) {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  // X-XSS-Protection: XSS 필터 활성화 (레거시 브라우저용)
  if (!response.headers.has('X-XSS-Protection')) {
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }

  // Referrer-Policy: Referrer 정보 제한
  if (!response.headers.has('Referrer-Policy')) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  // Permissions-Policy: 브라우저 기능 제한
  if (!response.headers.has('Permissions-Policy')) {
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }

  return response;
};

/**
 * 보안 미들웨어 설정 검증
 *
 * 서버 시작 시 호출하여 보안 설정을 로깅합니다.
 */
export function validateSecurityConfiguration(): void {
  logger.info('[Security Middleware] Blocked methods: ' + BLOCKED_METHODS.join(', '));
  logger.info('[Security Middleware] Allowed Content-Types: ' + ALLOWED_CONTENT_TYPES.join(', '));
  const origins = globalThis.__withwiz_allowed_origins;
  logger.info('[Security Middleware] Allowed Origins: ' + (origins?.join(', ') || 'NOT CONFIGURED (origin check disabled)'));
}
