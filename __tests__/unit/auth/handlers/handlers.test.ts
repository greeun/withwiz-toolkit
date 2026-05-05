import { createLoginHandler, createLogoutHandler, createAuthHandlers } from '../../../../src/auth/handlers';
import type { AuthHandlerOptions } from '../../../../src/auth/types/handler-types';

const mockOptions: AuthHandlerOptions = {
  dependencies: {
    userRepository: {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateLastLoginAt: vi.fn(),
      verifyEmail: vi.fn(),
    },
    oauthAccountRepository: {
      findByProvider: vi.fn(),
      findByUserId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    emailTokenRepository: {
      create: vi.fn(),
      findByEmailAndToken: vi.fn(),
      delete: vi.fn(),
      deleteExpired: vi.fn(),
      markAsUsed: vi.fn(),
    },
  },
  jwt: { secret: 'a'.repeat(32) },
  urls: { baseUrl: 'http://localhost:3000' },
};

describe('Auth Handlers', () => {
  it('createLoginHandler should return a function', () => {
    const handler = createLoginHandler(mockOptions);
    expect(typeof handler).toBe('function');
  });

  it('createLogoutHandler should return a function', () => {
    const handler = createLogoutHandler(mockOptions);
    expect(typeof handler).toBe('function');
  });

  it('createAuthHandlers should return all handlers', () => {
    const handlers = createAuthHandlers(mockOptions);
    expect(handlers.login).toBeDefined();
    expect(handlers.register).toBeDefined();
    expect(handlers.logout).toBeDefined();
    expect(handlers.refresh).toBeDefined();
    expect(handlers.me).toBeDefined();
    expect(handlers.oauthAuthorize).toBeDefined();
    expect(handlers.oauthCallback).toBeDefined();
    expect(handlers.forgotPassword).toBeDefined();
    expect(handlers.resetPassword).toBeDefined();
    expect(handlers.verifyEmail).toBeDefined();
  });

  it('login handler should return 400 for empty body', async () => {
    (mockOptions.dependencies.userRepository.findByEmail as any).mockResolvedValue(null);
    const handler = createLoginHandler(mockOptions);

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await handler(req as any);
    expect(res.status).toBe(400);
  });
});
