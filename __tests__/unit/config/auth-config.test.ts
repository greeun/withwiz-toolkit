// __tests__/unit/config/auth-config.test.ts
import { initializeAuth, getAuthConfig, resetAuth } from '@withwiz/toolkit/core/auth/config';
import { ConfigurationError } from '@withwiz/toolkit/core/config/errors';

describe('Auth Config', () => {
  beforeEach(() => { resetAuth(); });

  describe('getAuthConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getAuthConfig()).toThrow(ConfigurationError);
      expect(() => getAuthConfig()).toThrow('[Auth] Not initialized. Call initializeAuth() first.');
    });
  });

  describe('initializeAuth', () => {
    it('should throw ConfigurationError when jwtSecret is missing', () => {
      expect(() => initializeAuth({} as any)).toThrow(ConfigurationError);
      expect(() => initializeAuth({} as any)).toThrow('jwtSecret is required');
    });
    it('should throw ConfigurationError when jwtSecret is empty string', () => {
      expect(() => initializeAuth({ jwtSecret: '' })).toThrow(ConfigurationError);
    });
    it('should set all values when fully provided', () => {
      initializeAuth({ jwtSecret: 'my-secret-key-that-is-long-enough-32chars', accessTokenExpiry: '1h', refreshTokenExpiry: '7d' });
      const config = getAuthConfig();
      expect(config.jwtSecret).toBe('my-secret-key-that-is-long-enough-32chars');
      expect(config.accessTokenExpiry).toBe('1h');
      expect(config.refreshTokenExpiry).toBe('7d');
    });
    it('should warn and use default for accessTokenExpiry when not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: 'my-secret-key-that-is-long-enough-32chars' });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('accessTokenExpiry not provided'));
      expect(getAuthConfig().accessTokenExpiry).toBe('7d');
      spy.mockRestore();
    });
    it('should warn and use default for refreshTokenExpiry when not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: 'my-secret-key-that-is-long-enough-32chars' });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('refreshTokenExpiry not provided'));
      expect(getAuthConfig().refreshTokenExpiry).toBe('30d');
      spy.mockRestore();
    });
  });

  describe('long-lived access warning (C-2)', () => {
    const SECRET = 'my-secret-key-that-is-long-enough-32chars';

    it('warns when accessTokenExpiry exceeds 24h', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: SECRET, accessTokenExpiry: '2d', refreshTokenExpiry: '30d' });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('24h를 초과'));
      spy.mockRestore();
    });

    it('warns for the default 7d access expiry when not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: SECRET });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('24h를 초과'));
      spy.mockRestore();
    });

    it('does NOT warn about long access when accessTokenExpiry <= 24h', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: SECRET, accessTokenExpiry: '15m', refreshTokenExpiry: '30d' });
      expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('24h를 초과'));
      spy.mockRestore();
    });

    it('does NOT warn at the 24h boundary (strictly greater triggers)', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: SECRET, accessTokenExpiry: '24h', refreshTokenExpiry: '30d' });
      expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('24h를 초과'));
      spy.mockRestore();
    });

    it('keeps the 7d default constant unchanged (warning only, no value change)', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: SECRET });
      expect(getAuthConfig().accessTokenExpiry).toBe('7d');
      spy.mockRestore();
    });
  });

  describe('resetAuth', () => {
    it('should reset config', () => {
      initializeAuth({ jwtSecret: 'my-secret-key-that-is-long-enough-32chars' });
      resetAuth();
      expect(() => getAuthConfig()).toThrow(ConfigurationError);
    });
  });
});
