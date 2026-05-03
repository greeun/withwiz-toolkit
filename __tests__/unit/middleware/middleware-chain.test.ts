import { vi } from 'vitest';

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { MiddlewareChain } from '@withwiz/middleware/middleware-chain';
import type { IApiContext, TApiMiddleware, TApiHandler } from '@withwiz/middleware/types';

function createMockContext(): IApiContext {
  return {
    request: {} as any,
    locale: 'ko',
    requestId: 'test-req-id',
    startTime: Date.now(),
    metadata: {},
  };
}

function createMockResponse(data: any = { ok: true }, status = 200) {
  return { status, data, json: async () => data } as any;
}

describe('MiddlewareChain', () => {
  describe('use', () => {
    it('returns this for chaining', () => {
      const chain = new MiddlewareChain();
      const middleware: TApiMiddleware = async (_ctx, next) => next();
      const result = chain.use(middleware);
      expect(result).toBe(chain);
    });
  });

  describe('length', () => {
    it('returns the number of middlewares added', () => {
      const chain = new MiddlewareChain();
      expect(chain.length).toBe(0);

      chain.use(async (_ctx, next) => next());
      expect(chain.length).toBe(1);

      chain.use(async (_ctx, next) => next());
      expect(chain.length).toBe(2);
    });
  });

  describe('clear', () => {
    it('empties the middleware chain', () => {
      const chain = new MiddlewareChain();
      chain.use(async (_ctx, next) => next());
      chain.use(async (_ctx, next) => next());
      expect(chain.length).toBe(2);

      chain.clear();
      expect(chain.length).toBe(0);
    });
  });

  describe('execute', () => {
    it('calls middlewares in order then the handler', async () => {
      const order: string[] = [];
      const chain = new MiddlewareChain();

      chain.use(async (_ctx, next) => {
        order.push('middleware-1');
        return next();
      });
      chain.use(async (_ctx, next) => {
        order.push('middleware-2');
        return next();
      });

      const handler: TApiHandler = async () => {
        order.push('handler');
        return createMockResponse();
      };

      const ctx = createMockContext();
      await chain.execute(ctx, handler);

      expect(order).toEqual(['middleware-1', 'middleware-2', 'handler']);
    });

    it('returns the handler response when all middlewares call next', async () => {
      const chain = new MiddlewareChain();
      chain.use(async (_ctx, next) => next());

      const handler: TApiHandler = async () => createMockResponse({ success: true });
      const ctx = createMockContext();
      const result = await chain.execute(ctx, handler);

      expect(result.data).toEqual({ success: true });
    });

    it('allows middleware to short-circuit by not calling next', async () => {
      const chain = new MiddlewareChain();
      const earlyResponse = createMockResponse({ blocked: true }, 403);

      chain.use(async () => earlyResponse);
      chain.use(async (_ctx, next) => next());

      const handler: TApiHandler = async () => createMockResponse({ reached: true });
      const ctx = createMockContext();
      const result = await chain.execute(ctx, handler);

      expect(result).toBe(earlyResponse);
      expect(result.data).toEqual({ blocked: true });
    });

    it('calls handler directly when no middlewares are added', async () => {
      const chain = new MiddlewareChain();
      const handler: TApiHandler = async () => createMockResponse({ direct: true });
      const ctx = createMockContext();
      const result = await chain.execute(ctx, handler);

      expect(result.data).toEqual({ direct: true });
    });

    it('propagates middleware errors by default', async () => {
      const chain = new MiddlewareChain({ timeout: undefined });

      chain.use(async () => {
        throw new Error('middleware failure');
      });

      const handler: TApiHandler = async () => createMockResponse();
      const ctx = createMockContext();

      await expect(chain.execute(ctx, handler)).rejects.toThrow('middleware failure');
    });

    it('skips erroring middleware and continues when continueOnError is true', async () => {
      const chain = new MiddlewareChain({ continueOnError: true, timeout: undefined });

      chain.use(async () => {
        throw new Error('skip me');
      });
      chain.use(async (_ctx, next) => next());

      const handler: TApiHandler = async () => createMockResponse({ reached: true });
      const ctx = createMockContext();
      const result = await chain.execute(ctx, handler);

      expect(result.data).toEqual({ reached: true });
    });

    it('rejects after specified timeout', async () => {
      const chain = new MiddlewareChain({ timeout: 50 });

      chain.use(async (_ctx, next) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return next();
      });

      const handler: TApiHandler = async () => createMockResponse();
      const ctx = createMockContext();

      await expect(chain.execute(ctx, handler)).rejects.toThrow('Timeout after 50ms');
    });

    it('passes context through middleware chain', async () => {
      const chain = new MiddlewareChain({ timeout: undefined });

      chain.use(async (ctx, next) => {
        ctx.metadata.enriched = true;
        return next();
      });

      let capturedMetadata: Record<string, unknown> = {};
      const handler: TApiHandler = async (ctx) => {
        capturedMetadata = ctx.metadata;
        return createMockResponse();
      };

      const ctx = createMockContext();
      await chain.execute(ctx, handler);

      expect(capturedMetadata.enriched).toBe(true);
    });
  });
});
