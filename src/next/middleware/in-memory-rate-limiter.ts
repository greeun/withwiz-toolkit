/**
 * 인메모리 Rate Limiter
 *
 * `core/rate-limit/in-memory-rate-limit-store` 로 `IRateLimiter` 를 구현한다.
 * 단일 인스턴스 배포나 개발 환경, 분산 저장소가 없을 때 `setRateLimitAdapter` 에 그대로 넘길 수 있다.
 * 여러 인스턴스가 한도를 공유해야 하면 Redis 등 분산 저장소 기반 구현을 쓴다.
 *
 * @example
 * ```typescript
 * import { setRateLimitAdapter } from '@withwiz/toolkit/next/middleware/rate-limit';
 * import { createInMemoryRateLimiter } from '@withwiz/toolkit/next/middleware/in-memory-rate-limiter';
 * import { extractClientIp } from '@withwiz/toolkit/core/utils/ip-utils';
 *
 * setRateLimitAdapter({
 *   rateLimiters: {
 *     api: createInMemoryRateLimiter({ limit: 100, windowMs: 60_000, keyPrefix: 'api' }),
 *     auth: createInMemoryRateLimiter({ limit: 10, windowMs: 60_000, keyPrefix: 'auth' }),
 *   },
 *   extractClientIp: (headers) => extractClientIp(headers) ?? 'unknown',
 * });
 * ```
 */
import { InMemoryRateLimitStore } from '@withwiz/toolkit/core/rate-limit/in-memory-rate-limit-store';
import type { IRateLimiter } from '@withwiz/toolkit/next/middleware/rate-limit';

export interface IInMemoryRateLimiterOptions {
  /** 윈도당 허용 요청 수 */
  limit: number;
  /** 윈도 길이(ms) */
  windowMs: number;
  /** 저장소 키 접두사. 같은 저장소를 여러 limiter 가 공유할 때 구분용 */
  keyPrefix?: string;
  /** 공유할 저장소. 생략하면 limiter 마다 새로 만든다 */
  store?: InMemoryRateLimitStore;
}

export function createInMemoryRateLimiter(options: IInMemoryRateLimiterOptions): IRateLimiter {
  const store = options.store ?? new InMemoryRateLimitStore();
  const prefix = options.keyPrefix ? `${options.keyPrefix}:` : '';

  return {
    config: { limit: options.limit },
    check: async (identifier: string) => {
      const { success, remaining, resetIn } = store.check(`${prefix}${identifier}`, options.limit, options.windowMs);
      return { success, remaining, resetIn };
    },
  };
}
