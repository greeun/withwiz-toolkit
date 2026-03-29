/**
 * CORS 미들웨어
 *
 * Cross-Origin Resource Sharing 헤더를 설정합니다.
 */

import { NextResponse } from 'next/server';
import type { TApiMiddleware } from './types';
import { logger } from '../logger/logger';

/**
 * CORS 미들웨어 설정
 */
export interface CorsMiddlewareConfig {
  /** 허용할 Origin 목록 (예: ['https://example.com', 'https://app.example.com']) */
  allowedOrigins: string[];
  /** 크레덴셜 허용 여부 (기본값: true) */
  allowCredentials?: boolean;
  /** 허용할 HTTP 메서드 (기본값: GET, POST, PUT, DELETE, PATCH, OPTIONS) */
  allowedMethods?: string;
  /** 허용할 헤더 (기본값: Content-Type, Authorization, X-Requested-With, X-API-Key) */
  allowedHeaders?: string;
  /** preflight 캐시 시간(초) (기본값: 86400 = 24시간) */
  maxAge?: number;
}

const DEFAULT_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
const DEFAULT_HEADERS = 'Content-Type, Authorization, X-Requested-With, X-API-Key';
const DEFAULT_MAX_AGE = '86400';

/**
 * CORS 미들웨어 팩토리
 *
 * 설정 기반으로 CORS 미들웨어를 생성합니다.
 *
 * @example
 * ```typescript
 * const cors = createCorsMiddleware({
 *   allowedOrigins: ['https://example.com', 'https://app.example.com'],
 * });
 * ```
 */
export function createCorsMiddleware(config: CorsMiddlewareConfig): TApiMiddleware {
  const {
    allowedOrigins,
    allowCredentials = true,
    allowedMethods = DEFAULT_METHODS,
    allowedHeaders = DEFAULT_HEADERS,
    maxAge = DEFAULT_MAX_AGE,
  } = config;

  return async (context, next) => {
    const { request } = context;
    const origin = request.headers.get('origin');

    // OPTIONS preflight 요청 처리
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });

      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      } else if (allowedOrigins.includes('*')) {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }

      response.headers.set('Access-Control-Allow-Methods', allowedMethods);
      response.headers.set('Access-Control-Allow-Headers', allowedHeaders);
      response.headers.set('Access-Control-Max-Age', String(maxAge));
      if (allowCredentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      return response;
    }

    // 일반 요청 처리
    const response = await next();

    // Origin 검증
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      if (allowCredentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
    } else if (allowedOrigins.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      if (allowCredentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }

    // 공통 CORS 헤더
    response.headers.set('Access-Control-Allow-Methods', allowedMethods);
    response.headers.set('Access-Control-Allow-Headers', allowedHeaders);

    return response;
  };
}

/**
 * 기본 CORS 미들웨어 (환경변수 기반)
 *
 * ALLOWED_ORIGINS 환경변수에서 콤마 구분 Origin 목록을 읽습니다.
 * 설정이 없으면 빈 배열(모든 Origin 차단)을 사용합니다.
 *
 * @deprecated createCorsMiddleware()를 사용하여 명시적으로 설정하세요.
 */
export const corsMiddleware: TApiMiddleware = createCorsMiddleware({
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : [],
});

/**
 * CORS 설정 검증 및 초기화
 *
 * instrumentation.ts에서 서버 시작 시 호출하여 CORS 설정을 검증하고 로그를 출력합니다.
 *
 * @param config - 검증할 CORS 설정 (생략 시 환경변수 기반)
 *
 * @example
 * ```typescript
 * // instrumentation.ts
 * import { validateCorsConfiguration } from '@withwiz/middleware/cors';
 *
 * export async function register() {
 *   validateCorsConfiguration({
 *     allowedOrigins: ['https://example.com'],
 *   });
 * }
 * ```
 */
export function validateCorsConfiguration(config?: Pick<CorsMiddlewareConfig, 'allowedOrigins'>): void {
  const allowedOrigins = config?.allowedOrigins
    ?? (process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
      : []);

  logger.info(
    `[CORS Middleware] Initialized - Allowed Origins: [${allowedOrigins.join(', ')}]`
  );
}
