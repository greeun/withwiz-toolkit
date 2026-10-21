/**
 * Unit Tests: errorHandlerMiddleware - 429 응답의 Retry-After·X-RateLimit-* 헤더
 *
 * Rate limit 초과는 AppError(42901)로 던져지고 오류 처리기가 응답을 만든다.
 * X-RateLimit-* 헤더는 성공 응답에서만 responseLoggerMiddleware 가 붙이므로,
 * 429 응답의 헤더는 오류 처리기가 책임진다.
 */

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
}));

import { AppError } from '@withwiz/toolkit/core/error/app-error';
import { ERROR_CODES } from '@withwiz/toolkit/core/constants/error-codes';
import { errorHandlerMiddleware } from '@withwiz/toolkit/next/middleware/error-handler';
import { MiddlewareChain } from '@withwiz/toolkit/next/middleware/middleware-chain';
import { createRateLimitMiddleware, setRateLimitAdapter } from '@withwiz/toolkit/next/middleware/rate-limit';

type TRateLimitMeta = { limit: number; remaining: number; reset: number };

function createContext(rateLimit?: TRateLimitMeta) {
  return {
    request: {
      method: 'GET',
      url: 'http://localhost/api/test',
      headers: new Headers(),
      cookies: { get: () => undefined },
      nextUrl: new URL('http://localhost/api/test'),
    },
    locale: 'ko',
    requestId: 'req-1',
    startTime: Date.now(),
    metadata: rateLimit ? { rateLimit } : {},
  } as any;
}

async function respond(error: unknown, rateLimit?: TRateLimitMeta) {
  return errorHandlerMiddleware(createContext(rateLimit), async () => {
    throw error;
  });
}

const RATE_LIMIT_CODE = ERROR_CODES.RATE_LIMIT_EXCEEDED.code;

describe('errorHandlerMiddleware 429 헤더', () => {
  it('details.resetIn(초)을 Retry-After 로 싣는다', async () => {
    const res = await respond(new AppError(RATE_LIMIT_CODE, undefined, { resetIn: 30 }));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('소수 초는 올림한다', async () => {
    const res = await respond(new AppError(RATE_LIMIT_CODE, undefined, { resetIn: 12.3 }));

    expect(res.headers.get('Retry-After')).toBe('13');
  });

  it('0 이하는 1초로 올린다 (즉시 재시도 루프 방지)', async () => {
    const res = await respond(new AppError(RATE_LIMIT_CODE, undefined, { resetIn: 0 }));

    expect(res.headers.get('Retry-After')).toBe('1');
  });

  it('AppError.rateLimit(retryAfter) 의 details.retryAfter 를 쓴다', async () => {
    const res = await respond(AppError.rateLimit(60));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('details 에 값이 없으면 rate limit 미들웨어가 남긴 reset 을 쓴다', async () => {
    const res = await respond(new AppError(RATE_LIMIT_CODE), { limit: 40, remaining: 0, reset: 45 });

    expect(res.headers.get('Retry-After')).toBe('45');
  });

  it('남은 시간을 알 수 없으면 Retry-After 를 싣지 않는다', async () => {
    const res = await respond(new AppError(RATE_LIMIT_CODE));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('숫자가 아닌 값은 무시한다', async () => {
    const res = await respond(new AppError(RATE_LIMIT_CODE, undefined, { resetIn: 'soon' }));

    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('rate limit 미들웨어가 남긴 한도 정보를 X-RateLimit-* 로 싣는다', async () => {
    const res = await respond(
      new AppError(RATE_LIMIT_CODE, undefined, { resetIn: 45 }),
      { limit: 40, remaining: 0, reset: 45 },
    );

    expect(res.headers.get('X-RateLimit-Limit')).toBe('40');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).toBe('45');
  });

  it('429 가 아닌 오류에는 Retry-After 를 싣지 않는다', async () => {
    const res = await respond(AppError.badRequest(undefined, { resetIn: 30 }));

    expect(res.status).toBe(400);
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('rate limit 미들웨어가 한도 초과를 던지면 체인 응답에 헤더가 실린다', async () => {
    (globalThis as any).__withwiz_rateLimitAdapter__ = null;
    setRateLimitAdapter({
      rateLimiters: {
        api: {
          check: vi.fn().mockResolvedValue({ success: false, remaining: 0, resetIn: 42 }),
          config: { limit: 120 },
        },
      },
      extractClientIp: () => '203.0.113.7',
    });

    const handler = vi.fn();
    const res = await new MiddlewareChain()
      .use(errorHandlerMiddleware)
      .use(createRateLimitMiddleware('api'))
      .execute(createContext(), handler);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('120');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');

    (globalThis as any).__withwiz_rateLimitAdapter__ = null;
  });

  it('응답 본문 봉투는 그대로 유지한다', async () => {
    const res = await respond(new AppError(RATE_LIMIT_CODE, undefined, { resetIn: 30 }));
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe(RATE_LIMIT_CODE);
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });
});
