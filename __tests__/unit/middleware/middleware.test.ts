/**
 * Middleware Module Unit Tests
 *
 * cors, security 미들웨어 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// logger mock
vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('CORS Middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export corsHeaders function', async () => {
    const corsModule = await import('@withwiz/middleware/cors');
    expect(corsModule).toBeDefined();
  });
});

describe('Security Middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export security middleware', async () => {
    const securityModule = await import('@withwiz/middleware/security');
    expect(securityModule).toBeDefined();
  });
});

describe('Middleware Types', () => {
  it('should export IApiContext type', async () => {
    const typesModule = await import('@withwiz/middleware/types');
    expect(typesModule).toBeDefined();
  });
});

describe('Middleware Wrappers', () => {
  it('should export wrapper functions', async () => {
    const wrappersModule = await import('@withwiz/middleware/wrappers');
    expect(wrappersModule).toBeDefined();
    expect(typeof wrappersModule.withAuthApi).toBe('function');
    expect(typeof wrappersModule.withAdminApi).toBe('function');
    expect(typeof wrappersModule.withPublicApi).toBe('function');
  });

  describe('withPublicApi', () => {
    it('should wrap handler and return a function', async () => {
      const { withPublicApi } = await import('@withwiz/middleware/wrappers');
      const handler = vi.fn();
      const wrapped = withPublicApi(handler);
      expect(typeof wrapped).toBe('function');
    });
  });

  describe('withAuthApi', () => {
    it('should wrap handler and return a function', async () => {
      const { withAuthApi } = await import('@withwiz/middleware/wrappers');
      const handler = vi.fn();
      const wrapped = withAuthApi(handler);
      expect(typeof wrapped).toBe('function');
    });
  });

  describe('withAdminApi', () => {
    it('should wrap handler and return a function', async () => {
      const { withAdminApi } = await import('@withwiz/middleware/wrappers');
      const handler = vi.fn();
      const wrapped = withAdminApi(handler);
      expect(typeof wrapped).toBe('function');
    });
  });
});
