// __tests__/unit/config/registry.test.ts
import { initConfig, config, resetConfig } from '../../../src/config/registry';
import { ConfigurationError } from '../../../src/config/errors';
import type { ConfigRegistry } from '../../../src/config/registry';

const mockCommon = { nodeEnv: 'test' as const };
const mockAuth = { jwtSecret: 'secret', accessTokenExpiry: '7d', refreshTokenExpiry: '30d' };
const mockLogger = { level: 'info', dir: './logs', file: 'app.log', fileEnabled: true, consoleEnabled: true };

function makeRegistry(overrides?: Partial<ConfigRegistry>): ConfigRegistry {
  return { common: mockCommon, auth: mockAuth, logger: mockLogger, ...overrides };
}

describe('Config Registry', () => {
  beforeEach(() => {
    resetConfig();
  });

  describe('config proxy before initConfig', () => {
    it('should throw ConfigurationError when accessing config.common before initConfig()', () => {
      expect(() => config.common).toThrow(ConfigurationError);
      expect(() => config.common).toThrow('[Config] Not initialized. Call initConfig() first.');
    });

    it('should throw ConfigurationError when accessing config.auth before initConfig()', () => {
      expect(() => config.auth).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when accessing config.logger before initConfig()', () => {
      expect(() => config.logger).toThrow(ConfigurationError);
    });
  });

  describe('initConfig', () => {
    it('should store values and make them accessible via config proxy', () => {
      initConfig(makeRegistry());
      expect(config.common).toEqual(mockCommon);
      expect(config.auth).toEqual(mockAuth);
      expect(config.logger).toEqual(mockLogger);
    });

    it('should return undefined for optional modules when not provided', () => {
      initConfig(makeRegistry());
      expect(config.cache).toBeUndefined();
      expect(config.storage).toBeUndefined();
      expect(config.geolocation).toBeUndefined();
      expect(config.cors).toBeUndefined();
    });

    it('should store optional modules when provided', () => {
      const mockCors = { allowedOrigins: ['http://localhost'], baseUrl: 'http://localhost' };
      initConfig(makeRegistry({ cors: mockCors }));
      expect(config.cors).toEqual(mockCors);
    });

    it('should be idempotent - second call is ignored', () => {
      initConfig(makeRegistry());
      const originalAuth = config.auth;
      initConfig(makeRegistry({ auth: { jwtSecret: 'different', accessTokenExpiry: '1d', refreshTokenExpiry: '2d' } }));
      expect(config.auth).toEqual(originalAuth);
    });
  });

  describe('frozen config', () => {
    it('should freeze the stored object so assignment throws TypeError', () => {
      initConfig(makeRegistry());
      const stored = globalThis.__withwiz_config!;
      expect(() => {
        (stored as any).auth = { jwtSecret: 'hacked' };
      }).toThrow(TypeError);
    });
  });

  describe('config proxy setter', () => {
    it('should throw TypeError on assignment to config proxy', () => {
      initConfig(makeRegistry());
      expect(() => {
        (config as any).auth = { jwtSecret: 'hacked' };
      }).toThrow(TypeError);
      expect(() => {
        (config as any).auth = { jwtSecret: 'hacked' };
      }).toThrow('config is read-only');
    });
  });

  describe('resetConfig', () => {
    it('should make config access throw again after reset', () => {
      initConfig(makeRegistry());
      expect(config.common).toEqual(mockCommon);
      resetConfig();
      expect(() => config.common).toThrow(ConfigurationError);
    });
  });
});
