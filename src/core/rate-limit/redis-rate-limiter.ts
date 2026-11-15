/**
 * Redis 고정 윈도 Rate Limiter (인메모리 폴백 포함)
 *
 * Lua 스크립트(`INCR` 뒤 첫 증가 때 `PEXPIRE`)로 키별 요청 수를 센다. 슬라이딩 윈도가 아니라 고정 윈도다.
 *
 * Redis가 없거나(클라이언트 `null`) 오류가 나도 요청을 모두 허용하거나 모두 거부하지 않는다.
 * `InMemoryRateLimitStore` 로 서버별로 계속 제한하고, 오류 뒤 `retryIntervalMs`(기본 30초)가 지나면
 * 첫 요청에서 Redis를 다시 시도한다. 장애 동안 서버가 N대이면 한 사용자의 실제 한도는 최대 N배가 된다.
 *
 * `ioredis` 에 의존하지 않는다. `eval(script, numKeys, ...args)` 만 가진 클라이언트를 받는다.
 * 요청 경로에서 쓰는 클라이언트는 빠르게 실패하도록(예: ioredis `maxRetriesPerRequest: 1`,
 * `commandTimeout: 1000`) 따로 만드는 것을 권장한다.
 *
 * @example
 * ```typescript
 * import { createRedisRateLimiter } from '@withwiz/toolkit/core/rate-limit/redis-rate-limiter';
 *
 * const limiter = createRedisRateLimiter({ getClient: () => (redisDisabled ? null : rateLimitRedis) });
 * const r = await limiter.check({ bucket: 'signin-ip', subject: ip, max: 10, windowSec: 600 });
 * if (!r.allowed) return tooManyRequests(r.retryAfter);
 * ```
 */
import { InMemoryRateLimitStore } from '@withwiz/toolkit/core/rate-limit/in-memory-rate-limit-store';
import { logger } from '@withwiz/toolkit/core/logger/logger';

/** `eval` 만 쓰는 구조적 Redis 클라이언트 타입 (ioredis 호환) */
export interface IRateLimitEvalClient {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

export interface IRateLimitCheckOptions {
  /** 한도 종류 (예: `signin-ip`) */
  bucket: string;
  /** 한도 대상 (IP, 사용자 ID, 이메일 등) */
  subject: string;
  /** 윈도당 허용 요청 수 */
  max: number;
  /** 윈도 길이(초) */
  windowSec: number;
}

export interface IRateLimitDecision {
  /** 통과 여부 */
  allowed: boolean;
  /** 남은 요청 수 */
  remaining: number;
  /** 차단 시 다시 시도할 수 있을 때까지의 초. 통과하면 0 */
  retryAfter: number;
  /** 현재 윈도가 끝날 때까지의 초 (통과 여부와 무관) */
  resetIn: number;
}

export interface IRedisRateLimiterOptions {
  /** Redis 클라이언트를 돌려준다. `null` 이면 Redis 없이 인메모리로 센다 */
  getClient: () => IRateLimitEvalClient | null;
  /** 키 접두사. 키는 `{keyPrefix}:{bucket}:{subject}`. 기본 `rl` */
  keyPrefix?: string;
  /** Redis 오류 뒤 인메모리로 세는 시간(ms). 지나면 첫 요청에서 Redis를 다시 시도한다. 기본 30,000 */
  retryIntervalMs?: number;
  /** 폴백 저장소. 생략하면 limiter 마다 새로 만든다 */
  store?: InMemoryRateLimitStore;
}

export interface IRedisRateLimiter {
  check(options: IRateLimitCheckOptions): Promise<IRateLimitDecision>;
}

/** 반환값: [현재값, 남은 TTL(ms)] */
export const RATE_LIMIT_INCR_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl == -1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {current, ttl}
`;

const DEFAULT_KEY_PREFIX = 'rl';
const DEFAULT_RETRY_INTERVAL_MS = 30_000;

export function createRedisRateLimiter(options: IRedisRateLimiterOptions): IRedisRateLimiter {
  const store = options.store ?? new InMemoryRateLimitStore();
  const keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
  const retryIntervalMs = options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;
  let redisRetryAt = 0;

  function checkInMemory(key: string, opts: IRateLimitCheckOptions): IRateLimitDecision {
    const r = store.check(key, opts.max, opts.windowSec * 1000);
    return {
      allowed: r.success,
      remaining: r.remaining,
      retryAfter: r.success ? 0 : r.resetIn,
      resetIn: r.resetIn,
    };
  }

  return {
    async check(opts) {
      const key = `${keyPrefix}:${opts.bucket}:${opts.subject}`;
      const client = options.getClient();
      if (!client || Date.now() <= redisRetryAt) return checkInMemory(key, opts);

      const windowMs = opts.windowSec * 1000;
      try {
        const reply = (await client.eval(RATE_LIMIT_INCR_SCRIPT, 1, key, String(windowMs))) as [unknown, unknown];
        const count = Number(reply[0]);
        const ttlMs = Number(reply[1]);
        if (redisRetryAt > 0) {
          redisRetryAt = 0;
          logger.info('[RedisRateLimiter] Redis recovered');
        }
        const resetIn = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : opts.windowSec;
        if (count > opts.max) {
          return { allowed: false, remaining: 0, retryAfter: resetIn, resetIn };
        }
        return { allowed: true, remaining: opts.max - count, retryAfter: 0, resetIn };
      } catch (err) {
        redisRetryAt = Date.now() + retryIntervalMs;
        logger.error('[RedisRateLimiter] Redis error, falling back to in-memory counter', {
          error: err instanceof Error ? err.message : String(err),
        });
        return checkInMemory(key, opts);
      }
    },
  };
}
