/**
 * API 미들웨어 시스템
 *
 * 통합 에러 처리 시스템의 API 레이어
 */

// 타입
export type {
  IApiContext,
  IUser,
  TApiHandler,
  TApiMiddleware,
  IMiddlewareChainOptions,
} from './types';

// 미들웨어 체인
export { MiddlewareChain } from './middleware-chain';

// 개별 미들웨어
export { initRequestMiddleware } from './init-request';
export { authMiddleware, optionalAuthMiddleware, adminMiddleware, initializeAuthMiddleware, setAccessTokenBlacklistChecker } from './auth';
export type { IAccessTokenBlacklistChecker } from './auth';
export { rateLimitMiddleware, createRateLimitMiddleware, setRateLimitAdapter } from './rate-limit';
export { errorHandlerMiddleware } from './error-handler';
export { responseLoggerMiddleware } from './response-logger';
export { corsMiddleware, validateCorsConfiguration } from './cors';
export { securityMiddleware, validateSecurityConfiguration, setAllowedOrigins } from './security';

// 래퍼 함수
export {
  withPublicApi,
  withAuthApi,
  withAdminApi,
  withOptionalAuthApi,
  withCustomApi,
} from './wrappers';
