/**
 * Redis 고정 윈도 Rate Limiter 테스트
 *
 * 테스트 범위:
 * - Redis(Lua INCR + 첫 증가 때 PEXPIRE)로 세고 한도 초과 시 retryAfter(초)와 함께 차단
 * - 클라이언트가 없으면(null) 인메모리로 제한
 * - Redis 오류 시 모두 허용/거부하지 않고 인메모리로 계속 제한, 재시도 간격 뒤 Redis 재시도
 * - 키 접두사 옵션
 * - createMiddlewareRateLimiter 의 IRateLimiter 계약
 */
import {
  createRedisRateLimiter,
  RATE_LIMIT_INCR_SCRIPT,
  type IRateLimitEvalClient,
} from '@withwiz/toolkit/core/rate-limit/redis-rate-limiter';
import { InMemoryRateLimitStore } from '@withwiz/toolkit/core/rate-limit/in-memory-rate-limit-store';
import { createMiddlewareRateLimiter } from '@withwiz/toolkit/next/middleware/redis-rate-limiter';

const OPTS = { bucket: 'b', subject: 's', max: 2, windowSec: 60 };
const RETRY_MS = 30_000;

function makeClient() {
  const evalCommand = vi.fn();
  const client: IRateLimitEvalClient = { eval: evalCommand };
  return { client, evalCommand };
}

describe('createRedisRateLimiter', () => {
  const stores: InMemoryRateLimitStore[] = [];
  function newStore() {
    const s = new InMemoryRateLimitStore();
    stores.push(s);
    return s;
  }

  afterEach(() => {
    vi.useRealTimers();
    while (stores.length) stores.pop()!.destroy();
  });

  it('Redis로 세고, 한도를 넘으면 retryAfter와 함께 차단한다', async () => {
    const { client, evalCommand } = makeClient();
    evalCommand.mockResolvedValueOnce([2, 50_000]).mockResolvedValueOnce([3, 49_000]);
    const limiter = createRedisRateLimiter({ getClient: () => client, store: newStore() });

    await expect(limiter.check(OPTS)).resolves.toEqual({ allowed: true, remaining: 0, retryAfter: 0, resetIn: 50 });
    await expect(limiter.check(OPTS)).resolves.toEqual({ allowed: false, remaining: 0, retryAfter: 49, resetIn: 49 });
    expect(evalCommand).toHaveBeenCalledWith(RATE_LIMIT_INCR_SCRIPT, 1, 'rl:b:s', '60000');
  });

  it('Lua 스크립트는 INCR 뒤 TTL이 없을 때만 PEXPIRE 한다', () => {
    expect(RATE_LIMIT_INCR_SCRIPT).toContain("redis.call('INCR', KEYS[1])");
    expect(RATE_LIMIT_INCR_SCRIPT).toMatch(/if ttl == -1 then\s+redis\.call\('PEXPIRE', KEYS\[1\], ARGV\[1\]\)/);
  });

  it('TTL을 알 수 없으면 retryAfter로 windowSec을 쓴다', async () => {
    const { client, evalCommand } = makeClient();
    evalCommand.mockResolvedValueOnce([3, -2]);
    const limiter = createRedisRateLimiter({ getClient: () => client, store: newStore() });

    await expect(limiter.check(OPTS)).resolves.toMatchObject({ allowed: false, retryAfter: 60 });
  });

  it('클라이언트가 null이면 Redis 없이 인메모리로 제한한다', async () => {
    const limiter = createRedisRateLimiter({ getClient: () => null, store: newStore() });

    await expect(limiter.check(OPTS)).resolves.toMatchObject({ allowed: true, remaining: 1, retryAfter: 0 });
    await expect(limiter.check(OPTS)).resolves.toMatchObject({ allowed: true, remaining: 0 });
    const blocked = await limiter.check(OPTS);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('Redis 오류 시 모두 허용하지 않고 인메모리로 계속 제한한다', async () => {
    const { client, evalCommand } = makeClient();
    evalCommand.mockRejectedValue(new Error('connection refused'));
    const limiter = createRedisRateLimiter({ getClient: () => client, store: newStore() });

    await expect(limiter.check(OPTS)).resolves.toMatchObject({ allowed: true, remaining: 1 });
    await expect(limiter.check(OPTS)).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(limiter.check(OPTS)).resolves.toMatchObject({ allowed: false });
  });

  it('오류 뒤 재시도 간격 동안은 Redis를 쓰지 않고, 간격이 지나면 다시 시도한다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { client, evalCommand } = makeClient();
    evalCommand.mockRejectedValueOnce(new Error('connection refused'));
    const limiter = createRedisRateLimiter({ getClient: () => client, store: newStore() });

    await limiter.check(OPTS);
    vi.advanceTimersByTime(RETRY_MS);
    await limiter.check(OPTS);
    expect(evalCommand).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1);
    evalCommand.mockResolvedValueOnce([1, 60_000]);
    await expect(limiter.check(OPTS)).resolves.toEqual({ allowed: true, remaining: 1, retryAfter: 0, resetIn: 60 });
    expect(evalCommand).toHaveBeenCalledTimes(2);
  });

  it('재시도 간격과 키 접두사를 옵션으로 바꿀 수 있다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { client, evalCommand } = makeClient();
    evalCommand.mockRejectedValueOnce(new Error('down'));
    const limiter = createRedisRateLimiter({
      getClient: () => client,
      store: newStore(),
      keyPrefix: 'app:rl',
      retryIntervalMs: 1_000,
    });

    await limiter.check(OPTS);
    vi.advanceTimersByTime(1_001);
    evalCommand.mockResolvedValueOnce([1, 60_000]);
    await limiter.check(OPTS);
    expect(evalCommand).toHaveBeenLastCalledWith(RATE_LIMIT_INCR_SCRIPT, 1, 'app:rl:b:s', '60000');
  });

  it('limiter 인스턴스마다 장애 상태를 따로 가진다', async () => {
    const a = makeClient();
    const b = makeClient();
    a.evalCommand.mockRejectedValueOnce(new Error('down'));
    b.evalCommand.mockResolvedValue([1, 60_000]);
    const la = createRedisRateLimiter({ getClient: () => a.client, store: newStore() });
    const lb = createRedisRateLimiter({ getClient: () => b.client, store: newStore() });

    await la.check(OPTS);
    await lb.check(OPTS);
    expect(b.evalCommand).toHaveBeenCalledOnce();
  });
});

describe('createMiddlewareRateLimiter', () => {
  it('IRateLimiter 계약으로 변환하고 identifier를 subject로 쓴다', async () => {
    const { client, evalCommand } = makeClient();
    evalCommand.mockResolvedValueOnce([1, 60_000]).mockResolvedValueOnce([6, 12_400]);
    const store = new InMemoryRateLimitStore();
    const limiter = createRedisRateLimiter({ getClient: () => client, store });
    const mw = createMiddlewareRateLimiter(limiter, { bucket: 'api', limit: 5, windowSec: 60 });

    expect(mw.config).toEqual({ limit: 5 });
    await expect(mw.check('ip:1.2.3.4')).resolves.toEqual({ success: true, remaining: 4, resetIn: 60 });
    await expect(mw.check('user:u1')).resolves.toEqual({ success: false, remaining: 0, resetIn: 13 });
    expect(evalCommand).toHaveBeenNthCalledWith(1, RATE_LIMIT_INCR_SCRIPT, 1, 'rl:api:ip:1.2.3.4', '60000');
    expect(evalCommand).toHaveBeenNthCalledWith(2, RATE_LIMIT_INCR_SCRIPT, 1, 'rl:api:user:u1', '60000');
    store.destroy();
  });
});
