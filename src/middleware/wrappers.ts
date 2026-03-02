/**
 * API 래퍼 함수
 *
 * 미들웨어 체인을 조합하여 API 핸들러를 래핑합니다.
 */

import type { NextRequest } from 'next/server';
import type { IApiContext, TApiHandler, TApiMiddleware } from './types';
import { MiddlewareChain } from './middleware-chain';
import { errorHandlerMiddleware } from './error-handler';
import { initRequestMiddleware } from './init-request';
import { authMiddleware, adminMiddleware, optionalAuthMiddleware } from './auth';
import { rateLimitMiddleware } from './rate-limit';
import { responseLoggerMiddleware } from './response-logger';
import { corsMiddleware } from './cors';
import { securityMiddleware } from './security';

/**
 * 공개 API 래퍼
 *
 * - 인증 불필요
 * - Rate limit: API (분당 120회)
 * - 에러 핸들링, 로깅 포함
 *
 * @example
 * ```typescript
 * export const GET = withPublicApi(async (ctx) => {
 *   return NextResponse.json({ message: 'Hello' });
 * });
 * ```
 */
export function withPublicApi(handler: TApiHandler) {
  const chain = new MiddlewareChain()
    .use(errorHandlerMiddleware) // 최상위 에러 핸들러
    .use(securityMiddleware) // 보안 검증 (TRACE/TRACK 차단, Content-Type 검증)
    .use(corsMiddleware) // CORS 헤더
    .use(initRequestMiddleware) // 요청 초기화
    .use(rateLimitMiddleware.api) // Rate limit
    .use(responseLoggerMiddleware); // 응답 로깅

  return async (request: NextRequest, props?: unknown) => {
    // 초기 컨텍스트 생성
    const context: IApiContext = {
      request,
      locale: 'ko',
      requestId: '',
      startTime: Date.now(),
      metadata: {},
    };

    // 미들웨어 체인 실행 (동적 라우트 params 전달)
    return await chain.execute(context, handler, props);
  };
}

/**
 * 인증 필수 API 래퍼
 *
 * - JWT 인증 필수
 * - Rate limit: API (분당 120회)
 * - 에러 핸들링, 로깅 포함
 *
 * @example
 * ```typescript
 * export const GET = withAuthApi(async (ctx) => {
 *   const userId = ctx.user!.id;
 *   return NextResponse.json({ userId });
 * });
 * ```
 */
export function withAuthApi(handler: TApiHandler) {
  const chain = new MiddlewareChain()
    .use(errorHandlerMiddleware) // 최상위 에러 핸들러
    .use(securityMiddleware) // 보안 검증 (TRACE/TRACK 차단, Content-Type 검증)
    .use(corsMiddleware) // CORS 헤더
    .use(initRequestMiddleware) // 요청 초기화
    .use(authMiddleware) // JWT 인증
    .use(rateLimitMiddleware.api) // Rate limit
    .use(responseLoggerMiddleware); // 응답 로깅

  return async (request: NextRequest, props?: unknown) => {
    // 초기 컨텍스트 생성
    const context: IApiContext = {
      request,
      locale: 'ko',
      requestId: '',
      startTime: Date.now(),
      metadata: {},
    };

    // 미들웨어 체인 실행 (동적 라우트 params 전달)
    return await chain.execute(context, handler, props);
  };
}

/**
 * 관리자 전용 API 래퍼
 *
 * - JWT 인증 + 관리자 권한 필수
 * - Rate limit: Admin (분당 200회)
 * - 에러 핸들링, 로깅 포함
 *
 * @example
 * ```typescript
 * export const GET = withAdminApi(async (ctx) => {
 *   // ctx.user.role === 'admin' 보장됨
 *   return NextResponse.json({ users: [...] });
 * });
 * ```
 */
export function withAdminApi(handler: TApiHandler) {
  const chain = new MiddlewareChain()
    .use(errorHandlerMiddleware) // 최상위 에러 핸들러
    .use(securityMiddleware) // 보안 검증 (TRACE/TRACK 차단, Content-Type 검증)
    .use(corsMiddleware) // CORS 헤더
    .use(initRequestMiddleware) // 요청 초기화
    .use(authMiddleware) // JWT 인증
    .use(adminMiddleware) // 관리자 권한 확인
    .use(rateLimitMiddleware.admin) // Rate limit
    .use(responseLoggerMiddleware); // 응답 로깅

  return async (request: NextRequest, props?: unknown) => {
    // 초기 컨텍스트 생성
    const context: IApiContext = {
      request,
      locale: 'ko',
      requestId: '',
      startTime: Date.now(),
      metadata: {},
    };

    // 미들웨어 체인 실행 (동적 라우트 params 전달)
    return await chain.execute(context, handler, props);
  };
}

/**
 * 선택적 인증 API 래퍼
 *
 * - 인증 선택적 (로그인 시 context.user 설정, 비로그인 시 무시)
 * - Rate limit: API (분당 120회)
 * - 에러 핸들링, 로깅 포함
 *
 * @example
 * ```typescript
 * export const POST = withOptionalAuthApi(async (ctx) => {
 *   const userId = ctx.user?.id; // 로그인 시 존재, 비로그인 시 undefined
 *   return NextResponse.json({ userId });
 * });
 * ```
 */
export function withOptionalAuthApi(handler: TApiHandler) {
  const chain = new MiddlewareChain()
    .use(errorHandlerMiddleware) // 최상위 에러 핸들러
    .use(securityMiddleware) // 보안 검증 (TRACE/TRACK 차단, Content-Type 검증)
    .use(corsMiddleware) // CORS 헤더
    .use(initRequestMiddleware) // 요청 초기화
    .use(optionalAuthMiddleware) // 선택적 JWT 인증
    .use(rateLimitMiddleware.api) // Rate limit
    .use(responseLoggerMiddleware); // 응답 로깅

  return async (request: NextRequest, props?: unknown) => {
    // 초기 컨텍스트 생성
    const context: IApiContext = {
      request,
      locale: 'ko',
      requestId: '',
      startTime: Date.now(),
      metadata: {},
    };

    // 미들웨어 체인 실행 (동적 라우트 params 전달)
    return await chain.execute(context, handler, props);
  };
}

/**
 * 커스텀 미들웨어 체인 API 래퍼
 *
 * 사용자 정의 미들웨어 체인을 적용할 수 있습니다.
 *
 * @example
 * ```typescript
 * export const GET = withCustomApi(
 *   async (ctx) => {
 *     return NextResponse.json({ data: 'custom' });
 *   },
 *   (chain) => chain
 *     .use(errorHandlerMiddleware)
 *     .use(initRequestMiddleware)
 *     .use(rateLimitMiddleware.createLink)
 *     .use(responseLoggerMiddleware)
 * );
 * ```
 */
export function withCustomApi(
  handler: TApiHandler,
  configureChain: (chain: MiddlewareChain) => MiddlewareChain
) {
  const chain = configureChain(new MiddlewareChain());

  return async (request: NextRequest, props?: unknown) => {
    // 초기 컨텍스트 생성
    const context: IApiContext = {
      request,
      locale: 'ko',
      requestId: '',
      startTime: Date.now(),
      metadata: {},
    };

    // 미들웨어 체인 실행 (동적 라우트 params 전달)
    return await chain.execute(context, handler, props);
  };
}
