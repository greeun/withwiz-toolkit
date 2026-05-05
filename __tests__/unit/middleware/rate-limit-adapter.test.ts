/**
 * Unit Tests: Rate Limit Middleware - Adapter 미설정 경고 & isEnabled 체크
 *
 * 커버리지 대상: src/middleware/rate-limit.ts
 * - lines 112-116: getRateLimitAdapter() 경고 로깅 (한 번만 출력)
 * - lines 154-155: adapter.isEnabled가 false를 반환할 때 스킵 경로
 */

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '@withwiz/logger/logger';
import {
  setRateLimitAdapter,
  createRateLimitMiddleware,
  type IRateLimitAdapter,
  type IRateLimiter,
} from '@withwiz/middleware/rate-limit';

// ============================================================================
// 테스트 헬퍼
// ============================================================================

function createMockLimiter(overrides?: Partial<{ success: boolean; remaining: number; resetIn: number }>): IRateLimiter {
  const defaults = { success: true, remaining: 59, resetIn: 3600 };
  const result = { ...defaults, ...overrides };
  return {
    check: vi.fn().mockResolvedValue(result),
    config: { limit: 60 },
  };
}

function createMockContext(user?: { id: string }) {
  return {
    request: {
      headers: new Headers({ 'x-forwarded-for': '192.168.1.1' }),
    },
    user: user || null,
    metadata: {} as Record<string, unknown>,
  };
}

function createMockNext() {
  return vi.fn().mockResolvedValue({ status: 200 });
}

/**
 * globalThis에서 adapter와 warning flag를 초기화하는 헬퍼
 */
function resetGlobalState() {
  (globalThis as any).__withwiz_rateLimitAdapter__ = null;
  (globalThis as any).__withwiz_rateLimitWarningLogged__ = false;
}

// ============================================================================
// 테스트
// ============================================================================

describe('Rate Limit Middleware - Adapter 미설정 시 경고 로깅', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalState();
  });

  it('어댑터가 설정되지 않으면 경고 로그를 출력하고 next()를 호출한다', async () => {
    const middleware = createRateLimitMiddleware('api');
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Adapter not configured'),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Rate limiting is DISABLED'),
    );
    expect(next).toHaveBeenCalled();
  });

  it('어댑터 미설정 경고는 한 번만 출력된다', async () => {
    const middleware = createRateLimitMiddleware('api');
    const next = createMockNext();

    // 첫 번째 호출 - 경고 출력
    await middleware(createMockContext() as any, next);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // 두 번째 호출 - 경고 출력되지 않음
    await middleware(createMockContext() as any, createMockNext());
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('어댑터 미설정 시 debug 로그에 스킵 메시지를 출력한다', async () => {
    const middleware = createRateLimitMiddleware('api');
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Skipping rate limit check'),
    );
  });

  it('어댑터 설정 후에는 경고가 출력되지 않는다', async () => {
    // 먼저 어댑터 없이 호출하여 경고 출력
    const middleware = createRateLimitMiddleware('api');
    await middleware(createMockContext() as any, createMockNext());
    expect(logger.warn).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // 어댑터 설정
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: createMockLimiter() },
      extractClientIp: vi.fn().mockReturnValue('192.168.1.1'),
    };
    setRateLimitAdapter(adapter);

    // 어댑터 설정 후 호출 - 경고 없음
    await middleware(createMockContext() as any, createMockNext());
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('Rate Limit Middleware - isEnabled false 반환 시 스킵', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalState();
  });

  it('isEnabled가 false를 반환하면 rate limit 체크를 건너뛰고 next()를 호출한다', async () => {
    const limiter = createMockLimiter();
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: limiter },
      extractClientIp: vi.fn().mockReturnValue('10.0.0.1'),
      isEnabled: vi.fn().mockResolvedValue(false),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware('api');
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    expect(adapter.isEnabled).toHaveBeenCalledWith('api');
    expect(limiter.check).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('isEnabled가 true를 반환하면 rate limit 체크를 수행한다', async () => {
    const limiter = createMockLimiter();
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: limiter },
      extractClientIp: vi.fn().mockReturnValue('10.0.0.1'),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware('api');
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    expect(adapter.isEnabled).toHaveBeenCalledWith('api');
    expect(limiter.check).toHaveBeenCalledWith('ip:10.0.0.1');
    expect(next).toHaveBeenCalled();
  });

  it('isEnabled가 undefined이면 기본 활성화되어 rate limit 체크를 수행한다', async () => {
    const limiter = createMockLimiter();
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: limiter },
      extractClientIp: vi.fn().mockReturnValue('10.0.0.1'),
      // isEnabled 없음
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware('api');
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    expect(limiter.check).toHaveBeenCalledWith('ip:10.0.0.1');
    expect(next).toHaveBeenCalled();
  });
});
