/**
 * Rate Limit 미들웨어
 *
 * - IP 기반 Rate Limiting
 * - Redis + In-Memory Fallback
 * - 초과 시 429 에러
 *
 * 의존성 주입 패턴 사용:
 * 외부에서 Rate Limit 어댑터를 설정해야 합니다.
 */

import type { TApiMiddleware } from "./types";
import { AppError } from "@withwiz/error/app-error";
import { ERROR_CODES } from "@withwiz/constants/error-codes";
import { logger } from "@withwiz/logger/logger";

// ============================================================================
// Rate Limit 어댑터 인터페이스 (의존성 주입)
// ============================================================================

/**
 * Rate Limiter 인터페이스
 */
export interface IRateLimiter {
  check: (
    identifier: string,
  ) => Promise<{ success: boolean; remaining: number; resetIn: number }>;
  config: { limit: number };
}

/**
 * Rate Limit 어댑터 인터페이스
 */
export interface IRateLimitAdapter {
  rateLimiters: Record<string, IRateLimiter>;
  extractClientIp: (headers: Headers) => string;
  /** Rate Limiting 활성화 여부 (옵셔널, 미설정 시 기본 활성화) */
  isEnabled?: (type?: string) => Promise<boolean>;
}

let _rateLimitAdapter: IRateLimitAdapter | null = null;
let _adapterWarningLogged = false; // 경고 한 번만 출력

/**
 * Rate Limit 어댑터 설정
 * @param adapter - Rate Limit 어댑터 구현체
 *
 * @example
 * ```typescript
 * import { setRateLimitAdapter } from '@withwiz/middleware/rate-limit';
 * // 프로젝트에서 구현한 Rate Limit 유틸리티를 import하세요
 * import { rateLimiters, extractClientIp } from '<your-project>/rateLimiter';
 *
 * setRateLimitAdapter({ rateLimiters, extractClientIp });
 * ```
 */
export function setRateLimitAdapter(adapter: IRateLimitAdapter): void {
  const isInitialSetup = _rateLimitAdapter === null;
  const previousTypes = _rateLimitAdapter
    ? Object.keys(_rateLimitAdapter.rateLimiters).join(', ')
    : 'none';
  const newTypes = Object.keys(adapter.rateLimiters).join(', ');

  _rateLimitAdapter = adapter;
  _adapterWarningLogged = false; // 어댑터 설정되면 경고 플래그 리셋

  if (isInitialSetup) {
    logger.info(
      `[Rate Limit Middleware] ✅ Initialized with types: [${newTypes}]`
    );
  } else {
    logger.info(
      `[Rate Limit Middleware] 🔄 Updated - Previous: [${previousTypes}] → New: [${newTypes}]`
    );
  }
}

/**
 * Rate Limit 어댑터 가져오기 (내부용)
 *
 * ⚠️ OPTIONAL: Adapter가 설정되지 않으면 Rate Limiting이 비활성화됩니다.
 *
 * @returns {IRateLimitAdapter | null} Adapter 또는 null
 *
 * @example
 * ```typescript
 * // In instrumentation.ts (optional)
 * import { setRateLimitAdapter } from '@withwiz/middleware/rate-limit';
 * import { rateLimiters, extractClientIp } from '<your-project>/rateLimiter';
 *
 * setRateLimitAdapter({ rateLimiters, extractClientIp });
 * ```
 */
function getRateLimitAdapter(): IRateLimitAdapter | null {
  if (!_rateLimitAdapter && !_adapterWarningLogged) {
    logger.warn(
      "[Rate Limit Middleware] Adapter not configured. Rate limiting is DISABLED.\n" +
      "To enable: Call setRateLimitAdapter() in instrumentation.ts"
    );
    _adapterWarningLogged = true;
  }
  return _rateLimitAdapter;
}

// ============================================================================
// Rate Limit 타입
// ============================================================================

/**
 * 기본 Rate Limit 타입 (범용)
 */
export type TRateLimitType = "api" | "auth" | "admin";

/**
 * 확장 가능한 Rate Limit 타입
 * URL Shortener 서비스 특화 타입은 extensions/url-shortener/rate-limit-types.ts에 정의
 */
export type TExtendedRateLimitType = TRateLimitType | string;

// ============================================================================
// Rate Limit 미들웨어
// ============================================================================

/**
 * Rate Limit 미들웨어 팩토리
 *
 * @param type - Rate limit 타입 ('api', 'auth', 'admin' 등)
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain()
 *   .use(createRateLimitMiddleware('api'));
 * ```
 */
export function createRateLimitMiddleware(
  type: TExtendedRateLimitType,
): TApiMiddleware {
  return async (context, next) => {
    const adapter = getRateLimitAdapter();

    // Adapter가 없으면 Rate Limiting 스킵
    if (!adapter) {
      logger.debug(`[Rate Limit Middleware] Skipping rate limit check for '${type}' (adapter not configured)`);
      return await next();
    }

    // isEnabled가 설정되어 있으면 활성화 여부 체크 (미설정 시 기본 활성화)
    if (adapter.isEnabled) {
      const enabled = await adapter.isEnabled(type);
      if (!enabled) {
        return await next();
      }
    }

    // IP 주소 추출
    const ip = adapter.extractClientIp(context.request.headers);

    // 사용자 인증 정보가 있으면 userId 사용, 없으면 IP 사용
    const identifier = context.user ? `user:${context.user.id}` : `ip:${ip}`;

    // Rate limiter 선택
    const limiter = adapter.rateLimiters[type];

    if (!limiter) {
      throw new Error(
        `[Rate Limit Middleware] Unknown rate limit type: ${type}`,
      );
    }

    // Rate limit 체크
    const result = await limiter.check(identifier);

    // 응답에 Rate limit 헤더 추가 (metadata에 저장)
    context.metadata.rateLimit = {
      limit: limiter.config.limit,
      remaining: result.remaining,
      reset: result.resetIn,
    };

    // Rate limit 초과 시 에러
    if (!result.success) {
      throw new AppError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED.code,
        undefined, // message는 에러 코드에서 자동 생성
        {
          resetIn: result.resetIn,
          identifier,
          type,
        },
      );
    }

    return await next();
  };
}

/**
 * 사전 정의된 Rate Limit 미들웨어 (범용)
 *
 * 서비스 특화 미들웨어 (redirect, createLink 등)는
 * 프로젝트에서 직접 createRateLimitMiddleware를 사용하여 생성하세요.
 */
export const rateLimitMiddleware = {
  /** API Rate Limit (분당 120회) */
  api: createRateLimitMiddleware("api"),

  /** 인증 Rate Limit (시간당 40회) */
  auth: createRateLimitMiddleware("auth"),

  /** 관리자 Rate Limit (분당 200회) */
  admin: createRateLimitMiddleware("admin"),
};
