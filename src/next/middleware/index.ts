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
} from '@withwiz/toolkit/next/middleware/types';

// 미들웨어 체인
export { MiddlewareChain } from '@withwiz/toolkit/next/middleware/middleware-chain';

// 개별 미들웨어
export { initRequestMiddleware } from '@withwiz/toolkit/next/middleware/init-request';
export { authMiddleware, optionalAuthMiddleware, adminMiddleware, createRoleMiddleware, initializeAuthMiddleware, setAccessTokenBlacklistChecker } from '@withwiz/toolkit/next/middleware/auth';
export type { IAccessTokenBlacklistChecker } from '@withwiz/toolkit/next/middleware/auth';
export { rateLimitMiddleware, createRateLimitMiddleware, setRateLimitAdapter } from '@withwiz/toolkit/next/middleware/rate-limit';
export { errorHandlerMiddleware } from '@withwiz/toolkit/next/middleware/error-handler';
export { responseLoggerMiddleware } from '@withwiz/toolkit/next/middleware/response-logger';
export { corsMiddleware, validateCorsConfiguration } from '@withwiz/toolkit/next/middleware/cors';
export { securityMiddleware, validateSecurityConfiguration, setAllowedOrigins } from '@withwiz/toolkit/next/middleware/security';

// 래퍼 함수
export {
  withPublicApi,
  withAuthApi,
  withAdminApi,
  withOptionalAuthApi,
  withCustomApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
