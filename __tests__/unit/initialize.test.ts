import { initialize } from '../../src/initialize';
import { getCommonConfig, resetCommon } from '../../src/config/common';
import { getAuthConfig, resetAuth } from '../../src/auth/config';
import { getLoggerConfig, resetLogger } from '../../src/logger/config';
import { getResolvedCacheConfig, resetCache } from '../../src/cache/config';
import { getStorageConfig, resetStorage } from '../../src/storage/config';
import { getGeolocationConfig, resetGeolocation } from '../../src/geolocation/config';
import { getCorsConfig, resetCors } from '../../src/middleware/cors-config';
import { ConfigurationError } from '../../src/config/errors';

describe('initialize', () => {
  beforeEach(() => {
    resetCommon();
    resetAuth();
    resetLogger();
    resetCache();
    resetStorage();
    resetGeolocation();
    resetCors();
  });

  it('should initialize all modules when full config provided', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initialize({
      nodeEnv: 'production',
      auth: { jwtSecret: 'a-very-long-secret-key-for-testing-32ch' },
      logger: { level: 'error' },
      cache: { enabled: true },
      storage: {
        accountId: 'acc',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucketName: 'bucket',
      },
      geolocation: { ipgeolocationApiKey: 'geo-key' },
      cors: { allowedOrigins: ['https://example.com'] },
    });

    expect(getCommonConfig().nodeEnv).toBe('production');
    expect(getAuthConfig().jwtSecret).toBe('a-very-long-secret-key-for-testing-32ch');
    expect(getLoggerConfig().level).toBe('error');
    expect(getResolvedCacheConfig().enabled).toBe(true);
    expect(getStorageConfig().accountId).toBe('acc');
    expect(getGeolocationConfig().ipgeolocationApiKey).toBe('geo-key');
    expect(getCorsConfig().allowedOrigins).toEqual(['https://example.com']);
    spy.mockRestore();
  });

  it('should only initialize provided modules', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initialize({
      nodeEnv: 'test',
      auth: { jwtSecret: 'a-very-long-secret-key-for-testing-32ch' },
    });

    expect(getCommonConfig().nodeEnv).toBe('test');
    expect(getAuthConfig().jwtSecret).toBe('a-very-long-secret-key-for-testing-32ch');
    expect(() => getResolvedCacheConfig()).toThrow(ConfigurationError);
    expect(() => getStorageConfig()).toThrow(ConfigurationError);
    spy.mockRestore();
  });

  it('should initialize common first even with empty config', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initialize({});
    expect(getCommonConfig().nodeEnv).toBe('development');
    spy.mockRestore();
  });

  it('should propagate ConfigurationError from module', () => {
    expect(() => initialize({
      auth: { jwtSecret: '' },
    })).toThrow(ConfigurationError);
  });
});
