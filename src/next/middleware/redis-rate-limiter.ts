/**
 * Redis Rate Limiter → 미들웨어 `IRateLimiter` 변환
 *
 * `core/rate-limit/redis-rate-limiter` 의 limiter 를 `setRateLimitAdapter` 가 받는 `IRateLimiter` 로 감싼다.
 * 미들웨어가 넘기는 identifier(`ip:...` 또는 `user:...`)가 subject 가 되므로
 * 키는 `{keyPrefix}:{bucket}:{identifier}` 형태가 된다.
 *
 * @example
 * ```typescript
 * import { setRateLimitAdapter } from '@withwiz/toolkit/next/middleware/rate-limit';
 * import { createRedisRateLimiter } from '@withwiz/toolkit/core/rate-limit/redis-rate-limiter';
 * import { createMiddlewareRateLimiter } from '@withwiz/toolkit/next/middleware/redis-rate-limiter';
 * import { extractClientIp } from '@withwiz/toolkit/core/utils/ip-utils';
 *
 * const limiter = createRedisRateLimiter({ getClient: getRateLimitRedis });
 * setRateLimitAdapter({
 *   rateLimiters: {
 *     api: createMiddlewareRateLimiter(limiter, { bucket: 'api', limit: 120, windowSec: 60 }),
 *     auth: createMiddlewareRateLimiter(limiter, { bucket: 'auth', limit: 40, windowSec: 3600 }),
 *   },
 *   extractClientIp: (headers) => extractClientIp(headers) ?? 'unknown',
 * });
 * ```
 */
import type { IRedisRateLimiter } from '@withwiz/toolkit/core/rate-limit/redis-rate-limiter';
import type { IRateLimiter } from '@withwiz/toolkit/next/middleware/rate-limit';

export interface IMiddlewareRateLimiterOptions {
  /** 한도 종류. 키의 bucket 자리에 들어간다 */
  bucket: string;
  /** 윈도당 허용 요청 수 */
  limit: number;
  /** 윈도 길이(초) */
  windowSec: number;
}

export function createMiddlewareRateLimiter(
  limiter: IRedisRateLimiter,
  options: IMiddlewareRateLimiterOptions,
): IRateLimiter {
  return {
    config: { limit: options.limit },
    check: async (identifier: string) => {
      const r = await limiter.check({
        bucket: options.bucket,
        subject: identifier,
        max: options.limit,
        windowSec: options.windowSec,
      });
      return { success: r.allowed, remaining: r.remaining, resetIn: r.resetIn };
    },
  };
}
