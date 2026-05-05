/**
 * Unit Tests: Middleware Wrappers - withOptionalAuthApi
 *
 * 커버리지 대상: src/middleware/wrappers.ts lines 153-173
 * withOptionalAuthApi 함수가 올바른 미들웨어 체인을 구성하고
 * 핸들러를 올바른 컨텍스트로 호출하는지 검증합니다.
 */

import { NextResponse } from 'next/server';

// Track middleware invocations in order
const callOrder: string[] = [];

vi.mock('@withwiz/logger/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
}));

vi.mock('@withwiz/middleware/error-handler', () => ({
  errorHandlerMiddleware: vi.fn(async (_ctx: any, next: any) => {
    callOrder.push('errorHandler');
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/security', () => ({
  securityMiddleware: vi.fn(async (_ctx: any, next: any) => {
    callOrder.push('security');
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/cors', () => ({
  corsMiddleware: vi.fn(async (_ctx: any, next: any) => {
    callOrder.push('cors');
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/init-request', () => ({
  initRequestMiddleware: vi.fn(async (ctx: any, next: any) => {
    callOrder.push('initRequest');
    ctx.requestId = 'test-request-id';
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/auth', () => ({
  authMiddleware: vi.fn(async (ctx: any, next: any) => {
    callOrder.push('auth');
    ctx.user = { id: 'user-1', email: 'test@test.com', role: 'USER' };
    return await next();
  }),
  adminMiddleware: vi.fn(async (_ctx: any, next: any) => {
    callOrder.push('admin');
    return await next();
  }),
  optionalAuthMiddleware: vi.fn(async (ctx: any, next: any) => {
    callOrder.push('optionalAuth');
    // 선택적 인증: 토큰이 있으면 user 설정, 없으면 무시
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/rate-limit', () => ({
  rateLimitMiddleware: {
    api: vi.fn(async (ctx: any, next: any) => {
      callOrder.push('rateLimit:api');
      ctx.metadata.rateLimit = { limit: 120, remaining: 119, reset: 60 };
      return await next();
    }),
    admin: vi.fn(async (ctx: any, next: any) => {
      callOrder.push('rateLimit:admin');
      ctx.metadata.rateLimit = { limit: 200, remaining: 199, reset: 60 };
      return await next();
    }),
  },
}));

vi.mock('@withwiz/middleware/response-logger', () => ({
  responseLoggerMiddleware: vi.fn(async (_ctx: any, next: any) => {
    callOrder.push('responseLogger');
    return await next();
  }),
}));

// Create a minimal NextRequest mock
function createMockRequest(method = 'GET', url = 'http://localhost/api/test') {
  return {
    method,
    url,
    headers: new Headers(),
    cookies: { get: () => undefined },
    nextUrl: new URL(url),
  } as any;
}

describe('withOptionalAuthApi', () => {
  beforeEach(() => {
    callOrder.length = 0;
    vi.clearAllMocks();
  });

  it('async 함수를 반환한다', async () => {
    const { withOptionalAuthApi } = await import('@withwiz/middleware/wrappers');
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    const wrapped = withOptionalAuthApi(handler);

    expect(typeof wrapped).toBe('function');
  });

  it('올바른 미들웨어 체인 순서로 실행한다', async () => {
    const { withOptionalAuthApi } = await import('@withwiz/middleware/wrappers');
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    const wrapped = withOptionalAuthApi(handler);
    await wrapped(createMockRequest());

    expect(callOrder).toEqual([
      'errorHandler',
      'security',
      'cors',
      'initRequest',
      'optionalAuth',
      'rateLimit:api',
      'responseLogger',
    ]);
  });

  it('optionalAuthMiddleware를 포함하고 authMiddleware는 포함하지 않는다', async () => {
    const { withOptionalAuthApi } = await import('@withwiz/middleware/wrappers');
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const wrapped = withOptionalAuthApi(handler);
    await wrapped(createMockRequest());

    expect(callOrder).toContain('optionalAuth');
    expect(callOrder).not.toContain('auth');
    expect(callOrder).not.toContain('admin');
  });

  it('핸들러에 올바른 context 구조를 전달한다', async () => {
    const { withOptionalAuthApi } = await import('@withwiz/middleware/wrappers');
    const handler = vi.fn().mockImplementation((ctx) => {
      expect(ctx).toHaveProperty('request');
      expect(ctx).toHaveProperty('locale', 'ko');
      expect(ctx).toHaveProperty('requestId', 'test-request-id');
      expect(ctx).toHaveProperty('startTime');
      expect(ctx).toHaveProperty('metadata');
      expect(typeof ctx.startTime).toBe('number');
      return NextResponse.json({ ok: true });
    });

    const wrapped = withOptionalAuthApi(handler);
    await wrapped(createMockRequest());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('핸들러의 반환값이 최종 응답으로 반환된다', async () => {
    const { withOptionalAuthApi } = await import('@withwiz/middleware/wrappers');
    const expectedResponse = NextResponse.json({ data: 'test-data' });
    const handler = vi.fn().mockResolvedValue(expectedResponse);

    const wrapped = withOptionalAuthApi(handler);
    const response = await wrapped(createMockRequest());

    expect(response).toBe(expectedResponse);
  });

  it('props를 핸들러에 전달한다', async () => {
    const { withOptionalAuthApi } = await import('@withwiz/middleware/wrappers');
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const wrapped = withOptionalAuthApi(handler);
    const props = { params: { id: 'abc-123' } };
    await wrapped(createMockRequest(), props);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'test-request-id' }),
      props,
    );
  });

  it('API rate limit을 사용한다 (admin이 아닌)', async () => {
    const { withOptionalAuthApi } = await import('@withwiz/middleware/wrappers');
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const wrapped = withOptionalAuthApi(handler);
    await wrapped(createMockRequest());

    expect(callOrder).toContain('rateLimit:api');
    expect(callOrder).not.toContain('rateLimit:admin');
  });

  it('POST 요청에서도 정상 동작한다', async () => {
    const { withOptionalAuthApi } = await import('@withwiz/middleware/wrappers');
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ created: true }));

    const wrapped = withOptionalAuthApi(handler);
    const response = await wrapped(createMockRequest('POST', 'http://localhost/api/comments'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response).toBeInstanceOf(NextResponse);
  });
});
