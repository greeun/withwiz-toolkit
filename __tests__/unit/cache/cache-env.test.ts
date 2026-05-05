/**
 * Cache Env Tests
 *
 * src/cache/cache-env.ts 유닛 테스트
 * 환경 설정 관리 함수들 검증
 */

const mockResolvedConfig = {
  enabled: true,
  redis: { url: 'https://redis.test', token: 'token123', enabled: true },
  inmemory: { enabled: true, maxSize: 1000, maxMb: 50, eviction: 'lru' as const, cleanupInterval: 60000 },
  ttl: {
    DEFAULT: 300,
    SHORT: 60,
    LONG: 3600,
    GEOIP: 2592000,
    SETTINGS: 1800,
    ANALYTICS: 1800,
    USER: 600,
  },
  categories: {
    ANALYTICS: { enabled: true, duration: 1800 },
    USER: { enabled: true, duration: 600 },
    GEOIP: { enabled: true, duration: 2592000 },
    SETTINGS: { enabled: true, duration: 1800 },
    RATE_LIMIT: { enabled: true, duration: 60 },
  },
  fallback: {
    redisErrorThresholdGlobal: 3,
    redisErrorThresholdLocal: 3,
    redisReconnectInterval: 30000,
    fallbackOnRedisError: true,
    writeToMemory: true,
  },
  health: {
    errorRateThreshold: 5,
    hitRateThreshold: 50,
    reportHitRateThreshold: 70,
    reportResponseTimeThreshold: 100,
    reportInvalidationThreshold: 10,
    reportMinRequests: 100,
  },
};

vi.mock('@withwiz/cache/config', () => ({
  getResolvedCacheConfig: vi.fn(() => mockResolvedConfig),
}));

vi.mock('@withwiz/config/common', () => ({
  getCommonConfig: vi.fn(() => ({ nodeEnv: 'test' })),
}));

import { getResolvedCacheConfig } from '@withwiz/cache/config';
import { getCommonConfig } from '@withwiz/config/common';

describe('Cache Env', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue(mockResolvedConfig);
    (getCommonConfig as ReturnType<typeof vi.fn>).mockReturnValue({ nodeEnv: 'test' });
  });

  describe('getConfig', () => {
    it('should return ISharedEnvConfig with correct env mapping', async () => {
      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.env.NODE_ENV).toBe('test');
      expect(config.env.REDIS_REST_URL).toBe('https://redis.test');
      expect(config.env.REDIS_REST_TOKEN).toBe('token123');
      expect(config.env.CACHE_ENABLED).toBe(true);
    });

    it('should return ISharedEnvConfig with correct ENV.REDIS mapping', async () => {
      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.ENV.REDIS.URL).toBe('https://redis.test');
      expect(config.ENV.REDIS.TOKEN).toBe('token123');
      expect(config.ENV.REDIS.IS_AVAILABLE).toBe(true);
      expect(config.ENV.REDIS.ENABLED).toBe(true);
    });

    it('should return ENV.REDIS.IS_AVAILABLE as false when url is missing', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: { url: '', token: 'token123', enabled: true },
      });

      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.ENV.REDIS.IS_AVAILABLE).toBe(false);
    });

    it('should return ENV.REDIS.IS_AVAILABLE as false when token is missing', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: { url: 'https://redis.test', token: '', enabled: true },
      });

      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.ENV.REDIS.IS_AVAILABLE).toBe(false);
    });

    it('should return correct CACHE categories in ENV', async () => {
      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.ENV.CACHE.ANALYTICS.ENABLED).toBe(true);
      expect(config.ENV.CACHE.ANALYTICS.DURATION).toBe(1800);
      expect(config.ENV.CACHE.USER.ENABLED).toBe(true);
      expect(config.ENV.CACHE.USER.DURATION).toBe(600);
      expect(config.ENV.CACHE.GEOIP.ENABLED).toBe(true);
      expect(config.ENV.CACHE.GEOIP.DURATION).toBe(2592000);
      expect(config.ENV.CACHE.SETTINGS.ENABLED).toBe(true);
      expect(config.ENV.CACHE.SETTINGS.DURATION).toBe(1800);
      expect(config.ENV.CACHE.RATE_LIMIT.ENABLED).toBe(true);
      expect(config.ENV.CACHE.RATE_LIMIT.DURATION).toBe(60);
    });

    it('should return isCacheEnabled function that reflects config', async () => {
      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.isCacheEnabled()).toBe(true);
    });

    it('should return isRedisAvailable function that reflects redis config', async () => {
      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.isRedisAvailable()).toBe(true);
    });

    it('should handle redis undefined gracefully', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: undefined,
      });

      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.ENV.REDIS.URL).toBeUndefined();
      expect(config.ENV.REDIS.TOKEN).toBeUndefined();
      expect(config.ENV.REDIS.IS_AVAILABLE).toBe(false);
      expect(config.ENV.REDIS.ENABLED).toBe(false);
      expect(config.isRedisAvailable()).toBe(false);
    });

    it('should fallback to development when getCommonConfig throws', async () => {
      (getCommonConfig as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Config not initialized');
      });

      const { getConfig } = await import('@withwiz/cache/cache-env');

      const config = getConfig();
      expect(config.env.NODE_ENV).toBe('development');
    });
  });

  describe('getEnv', () => {
    it('should return raw env values from config', async () => {
      const { getEnv } = await import('@withwiz/cache/cache-env');

      const env = getEnv();
      expect(env.NODE_ENV).toBe('test');
      expect(env.REDIS_REST_URL).toBe('https://redis.test');
      expect(env.REDIS_REST_TOKEN).toBe('token123');
      expect(env.CACHE_ENABLED).toBe(true);
    });
  });

  describe('getENV', () => {
    it('should return structured ENV with REDIS and CACHE sections', async () => {
      const { getENV } = await import('@withwiz/cache/cache-env');

      const ENV = getENV();
      expect(ENV.REDIS).toBeDefined();
      expect(ENV.CACHE).toBeDefined();
      expect(ENV.CACHE.ENABLED).toBe(true);
      expect(ENV.CACHE.INMEMORY.ENABLED).toBe(true);
      expect(ENV.CACHE.INMEMORY.MAX_SIZE).toBe(1000);
      expect(ENV.CACHE.INMEMORY.MAX_MB).toBe(50);
      expect(ENV.CACHE.INMEMORY.EVICTION).toBe('lru');
      expect(ENV.CACHE.INMEMORY.CLEANUP_INTERVAL).toBe(60000);
      expect(ENV.CACHE.TTL).toEqual({
        DEFAULT: 300,
        SHORT: 60,
        LONG: 3600,
        GEOIP: 2592000,
        SETTINGS: 1800,
        ANALYTICS: 1800,
        USER: 600,
      });
    });
  });

  describe('isCacheEnabled', () => {
    it('should return true when config.enabled is true', async () => {
      const { isCacheEnabled } = await import('@withwiz/cache/cache-env');
      expect(isCacheEnabled()).toBe(true);
    });

    it('should return false when config.enabled is false', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        enabled: false,
      });

      const { isCacheEnabled } = await import('@withwiz/cache/cache-env');
      expect(isCacheEnabled()).toBe(false);
    });
  });

  describe('validateRedisEnvironment', () => {
    it('should return isValid true when url and token are present', async () => {
      const { validateRedisEnvironment } = await import('@withwiz/cache/cache-env');

      const result = validateRedisEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return isValid false when URL is empty string (falsy)', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: { url: '', token: 'token123', enabled: true },
      });

      const { validateRedisEnvironment } = await import('@withwiz/cache/cache-env');

      const result = validateRedisEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Redis URL is not configured.');
    });

    it('should return isValid false when URL is undefined', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: { url: undefined, token: 'token123', enabled: true },
      });

      const { validateRedisEnvironment } = await import('@withwiz/cache/cache-env');

      const result = validateRedisEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Redis URL is not configured.');
    });

    it('should return isValid false when token is empty string (falsy)', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: { url: 'https://redis.test', token: '', enabled: true },
      });

      const { validateRedisEnvironment } = await import('@withwiz/cache/cache-env');

      const result = validateRedisEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Redis token is not configured.');
    });

    it('should return isValid false when token is undefined', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: { url: 'https://redis.test', token: undefined, enabled: true },
      });

      const { validateRedisEnvironment } = await import('@withwiz/cache/cache-env');

      const result = validateRedisEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Redis token is not configured.');
    });

    it('should return multiple errors when both url and token are missing', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: undefined,
      });

      const { validateRedisEnvironment } = await import('@withwiz/cache/cache-env');

      const result = validateRedisEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should return isValid false when URL is whitespace only', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockResolvedConfig,
        redis: { url: '   ', token: 'token123', enabled: true },
      });

      const { validateRedisEnvironment } = await import('@withwiz/cache/cache-env');

      const result = validateRedisEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Redis URL is an empty string.');
    });
  });

  describe('getCacheFallbackConfig', () => {
    it('should return fallback config with threshold values', async () => {
      const { getCacheFallbackConfig } = await import('@withwiz/cache/cache-env');

      const fallback = getCacheFallbackConfig();
      expect(fallback.redisErrorThresholdGlobal).toBe(3);
      expect(fallback.redisErrorThresholdLocal).toBe(3);
      expect(fallback.redisReconnectInterval).toBe(30000);
      expect(fallback.fallbackOnRedisError).toBe(true);
      expect(fallback.writeToMemory).toBe(true);
    });
  });

  describe('getCacheHealthConfig', () => {
    it('should return health config with threshold values', async () => {
      const { getCacheHealthConfig } = await import('@withwiz/cache/cache-env');

      const health = getCacheHealthConfig();
      expect(health.errorRateThreshold).toBe(5);
      expect(health.hitRateThreshold).toBe(50);
      expect(health.reportHitRateThreshold).toBe(70);
      expect(health.reportResponseTimeThreshold).toBe(100);
      expect(health.reportInvalidationThreshold).toBe(10);
      expect(health.reportMinRequests).toBe(100);
    });
  });
});
