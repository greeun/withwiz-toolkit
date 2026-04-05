import { initializeCache, getResolvedCacheConfig, resetCache } from '../../../src/cache/config';
import { ConfigurationError } from '../../../src/config/errors';
import { INMEMORY_CACHE_DEFAULTS, CACHE_TTL_DEFAULTS } from '../../../src/cache/cache-defaults';

describe('Cache Config', () => {
  beforeEach(() => { resetCache(); });

  describe('getResolvedCacheConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getResolvedCacheConfig()).toThrow(ConfigurationError);
    });
  });

  describe('initializeCache', () => {
    it('should accept minimal config with defaults', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeCache({});
      const config = getResolvedCacheConfig();
      expect(config.enabled).toBe(true);
      expect(config.inmemory.enabled).toBe(true);
      expect(config.inmemory.maxSize).toBe(INMEMORY_CACHE_DEFAULTS.MAX_SIZE);
      expect(config.inmemory.eviction).toBe('lru');
      expect(config.ttl.DEFAULT).toBe(CACHE_TTL_DEFAULTS.DEFAULT);
      spy.mockRestore();
    });

    it('should throw when redis.url is missing but redis provided', () => {
      expect(() => initializeCache({
        redis: { token: 'token-123' } as any,
      })).toThrow('redis.url is required');
    });

    it('should throw when redis.token is missing but redis provided', () => {
      expect(() => initializeCache({
        redis: { url: 'https://redis.example.com' } as any,
      })).toThrow('redis.token is required');
    });

    it('should set redis config when fully provided', () => {
      initializeCache({
        redis: { url: 'https://redis.example.com', token: 'token-123' },
      });
      const config = getResolvedCacheConfig();
      expect(config.redis!.url).toBe('https://redis.example.com');
      expect(config.redis!.token).toBe('token-123');
      expect(config.redis!.enabled).toBe(true);
    });

    it('should override TTL defaults', () => {
      initializeCache({ ttl: { DEFAULT: 120, SHORT: 30 } });
      const config = getResolvedCacheConfig();
      expect(config.ttl.DEFAULT).toBe(120);
      expect(config.ttl.SHORT).toBe(30);
      expect(config.ttl.LONG).toBe(CACHE_TTL_DEFAULTS.LONG);
    });

    it('should disable cache when enabled is false', () => {
      initializeCache({ enabled: false });
      expect(getResolvedCacheConfig().enabled).toBe(false);
    });
  });

  describe('resetCache', () => {
    it('should reset config', () => {
      initializeCache({});
      resetCache();
      expect(() => getResolvedCacheConfig()).toThrow(ConfigurationError);
    });
  });
});
