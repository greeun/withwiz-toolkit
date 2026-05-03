/**
 * Middleware Wrappers Behavioral Tests
 *
 * Tests that withPublicApi, withAuthApi, and withAdminApi compose the correct
 * middleware chain and invoke the handler with proper context.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock all middleware dependencies
vi.mock('@withwiz/logger/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
}));

// Track middleware invocations in order
const callOrder: string[] = [];

vi.mock('@withwiz/middleware/error-handler', () => ({
  errorHandlerMiddleware: vi.fn(async (_ctx, next) => {
    callOrder.push('errorHandler');
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/security', () => ({
  securityMiddleware: vi.fn(async (_ctx, next) => {
    callOrder.push('security');
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/cors', () => ({
  corsMiddleware: vi.fn(async (_ctx, next) => {
    callOrder.push('cors');
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/init-request', () => ({
  initRequestMiddleware: vi.fn(async (ctx, next) => {
    callOrder.push('initRequest');
    ctx.requestId = 'test-request-id';
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/auth', () => ({
  authMiddleware: vi.fn(async (ctx, next) => {
    callOrder.push('auth');
    ctx.user = { id: 'user-1', email: 'test@test.com', role: 'USER' };
    return await next();
  }),
  adminMiddleware: vi.fn(async (ctx, next) => {
    callOrder.push('admin');
    if (!ctx.user || ctx.user.role !== 'ADMIN') {
      throw new Error('Forbidden');
    }
    return await next();
  }),
  optionalAuthMiddleware: vi.fn(async (_ctx, next) => {
    callOrder.push('optionalAuth');
    return await next();
  }),
}));

vi.mock('@withwiz/middleware/rate-limit', () => ({
  rateLimitMiddleware: {
    api: vi.fn(async (ctx, next) => {
      callOrder.push('rateLimit:api');
      ctx.metadata.rateLimit = { limit: 120, remaining: 119, reset: 60 };
      return await next();
    }),
    admin: vi.fn(async (ctx, next) => {
      callOrder.push('rateLimit:admin');
      ctx.metadata.rateLimit = { limit: 200, remaining: 199, reset: 60 };
      return await next();
    }),
  },
}));

vi.mock('@withwiz/middleware/response-logger', () => ({
  responseLoggerMiddleware: vi.fn(async (_ctx, next) => {
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

describe('Middleware Wrappers', () => {
  beforeEach(() => {
    callOrder.length = 0;
    vi.clearAllMocks();
  });

  describe('withPublicApi', () => {
    it('should execute middleware chain in correct order and call handler', async () => {
      const { withPublicApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockResolvedValue(
        NextResponse.json({ ok: true })
      );

      const wrapped = withPublicApi(handler);
      const request = createMockRequest();
      const response = await wrapped(request);

      expect(callOrder).toEqual([
        'errorHandler',
        'security',
        'cors',
        'initRequest',
        'rateLimit:api',
        'responseLogger',
      ]);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should pass context with requestId to handler', async () => {
      const { withPublicApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockImplementation((ctx) => {
        expect(ctx.requestId).toBe('test-request-id');
        return NextResponse.json({ ok: true });
      });

      const wrapped = withPublicApi(handler);
      await wrapped(createMockRequest());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should NOT include auth middleware', async () => {
      const { withPublicApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withPublicApi(handler);
      await wrapped(createMockRequest());

      expect(callOrder).not.toContain('auth');
      expect(callOrder).not.toContain('admin');
    });

    it('should forward props to handler', async () => {
      const { withPublicApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withPublicApi(handler);
      const props = { params: { id: '123' } };
      await wrapped(createMockRequest(), props);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'test-request-id' }),
        props
      );
    });
  });

  describe('withAuthApi', () => {
    it('should include authMiddleware between initRequest and rateLimit', async () => {
      const { withAuthApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withAuthApi(handler);
      await wrapped(createMockRequest());

      expect(callOrder).toEqual([
        'errorHandler',
        'security',
        'cors',
        'initRequest',
        'auth',
        'rateLimit:api',
        'responseLogger',
      ]);
    });

    it('should populate context.user from authMiddleware', async () => {
      const { withAuthApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockImplementation((ctx) => {
        expect(ctx.user).toEqual({
          id: 'user-1',
          email: 'test@test.com',
          role: 'USER',
        });
        return NextResponse.json({});
      });

      const wrapped = withAuthApi(handler);
      await wrapped(createMockRequest());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should use api rate limit (not admin)', async () => {
      const { withAuthApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withAuthApi(handler);
      await wrapped(createMockRequest());

      expect(callOrder).toContain('rateLimit:api');
      expect(callOrder).not.toContain('rateLimit:admin');
    });
  });

  describe('withAdminApi', () => {
    it('should include both authMiddleware and adminMiddleware', async () => {
      // Override auth mock to set ADMIN role so adminMiddleware passes
      const { authMiddleware } = await import('@withwiz/middleware/auth');
      (authMiddleware as any).mockImplementation(async (ctx: any, next: any) => {
        callOrder.push('auth');
        ctx.user = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };
        return await next();
      });

      const { withAdminApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withAdminApi(handler);
      await wrapped(createMockRequest());

      expect(callOrder).toEqual([
        'errorHandler',
        'security',
        'cors',
        'initRequest',
        'auth',
        'admin',
        'rateLimit:admin',
        'responseLogger',
      ]);
    });

    it('should use admin rate limit', async () => {
      const { authMiddleware } = await import('@withwiz/middleware/auth');
      (authMiddleware as any).mockImplementation(async (ctx: any, next: any) => {
        callOrder.push('auth');
        ctx.user = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };
        return await next();
      });

      const { withAdminApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withAdminApi(handler);
      await wrapped(createMockRequest());

      expect(callOrder).toContain('rateLimit:admin');
      expect(callOrder).not.toContain('rateLimit:api');
    });

    it('should block non-admin users via adminMiddleware', async () => {
      const { authMiddleware } = await import('@withwiz/middleware/auth');
      (authMiddleware as any).mockImplementation(async (ctx: any, next: any) => {
        callOrder.push('auth');
        ctx.user = { id: 'user-1', email: 'user@test.com', role: 'USER' };
        return await next();
      });

      const { withAdminApi } = await import('@withwiz/middleware/wrappers');

      const handler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withAdminApi(handler);

      await expect(wrapped(createMockRequest())).rejects.toThrow('Forbidden');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('withCustomApi', () => {
    it('should allow building a custom middleware chain', async () => {
      const { withCustomApi } = await import('@withwiz/middleware/wrappers');
      const { errorHandlerMiddleware } = await import('@withwiz/middleware/error-handler');
      const { initRequestMiddleware } = await import('@withwiz/middleware/init-request');
      const { responseLoggerMiddleware } = await import('@withwiz/middleware/response-logger');

      const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

      const wrapped = withCustomApi(handler, (chain) =>
        chain
          .use(errorHandlerMiddleware)
          .use(initRequestMiddleware)
          .use(responseLoggerMiddleware)
      );

      await wrapped(createMockRequest());

      expect(callOrder).toEqual(['errorHandler', 'initRequest', 'responseLogger']);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
