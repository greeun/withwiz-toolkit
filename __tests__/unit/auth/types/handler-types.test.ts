import type { AuthHandlerOptions, AuthHandlerHooks, AuthHandlerDependencies } from '../../../../src/auth/types/handler-types';

describe('AuthHandlerTypes', () => {
  it('should allow minimal AuthHandlerOptions', () => {
    const opts: AuthHandlerOptions = {
      dependencies: {
        userRepository: {} as any,
        oauthAccountRepository: {} as any,
        emailTokenRepository: {} as any,
      },
      jwt: { secret: 'a'.repeat(32) },
      urls: { baseUrl: 'http://localhost:3000' },
    };
    expect(opts.jwt.secret.length).toBeGreaterThanOrEqual(32);
  });

  it('should allow hooks to be optional', () => {
    const hooks: AuthHandlerHooks = {};
    expect(hooks.onBeforeLogin).toBeUndefined();
  });

  it('should type-check extendUserResponse', () => {
    const hooks: AuthHandlerHooks = {
      extendUserResponse: async (user) => ({ plan: 'PRO' }),
    };
    expect(hooks.extendUserResponse).toBeDefined();
  });
});
