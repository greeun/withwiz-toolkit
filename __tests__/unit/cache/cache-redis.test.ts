/**
 * Cache Redis Tests
 *
 * src/cache/cache-redis.ts 유닛 테스트
 * Redis 전역 상태 관리 및 연결 확인 로직 검증
 */

let mockPingResult: any = 'PONG';
let mockPingError: any = null;

vi.mock('@upstash/redis', () => {
  return {
    Redis: vi.fn(function (this: any) {
      this.ping = vi.fn(() => {
        if (mockPingError) {
          return Promise.reject(mockPingError);
        }
        return Promise.resolve(mockPingResult);
      });
      this.get = vi.fn();
      this.set = vi.fn();
      this.del = vi.fn();
    }),
  };
});

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the cache-env module at the correct path (relative to the source file)
vi.mock('@withwiz/cache/cache-env', () => ({
  getEnv: vi.fn(() => ({
    NODE_ENV: 'test',
    REDIS_REST_URL: 'https://test-redis.upstash.io',
    REDIS_REST_TOKEN: 'test-token-123',
  })),
  getConfig: vi.fn(() => ({
    isRedisAvailable: () => true,
  })),
  isCacheEnabled: vi.fn(() => true),
  validateRedisEnvironment: vi.fn(() => ({ isValid: true, errors: [] })),
  getCacheFallbackConfig: vi.fn(() => ({
    redisErrorThresholdGlobal: 3,
    redisErrorThresholdLocal: 3,
    redisReconnectInterval: 30000,
    fallbackOnRedisError: true,
    writeToMemory: true,
  })),
}));

import { logger } from '@withwiz/logger/logger';
import { isCacheEnabled, getEnv, getConfig, validateRedisEnvironment, getCacheFallbackConfig } from '@withwiz/cache/cache-env';

describe('Cache Redis - Global State Management', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset global state before each test
    delete (globalThis as any).__globalRedisState;
    delete (globalThis as any).__redisCacheInitLogged;
    // Reset ping mock to default
    mockPingResult = 'PONG';
    mockPingError = null;
    // Restore default mock implementations after clearAllMocks
    (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
      NODE_ENV: 'test',
      REDIS_REST_URL: 'https://test-redis.upstash.io',
      REDIS_REST_TOKEN: 'test-token-123',
    });
    (getConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      isRedisAvailable: () => true,
    });
    (validateRedisEnvironment as ReturnType<typeof vi.fn>).mockReturnValue({ isValid: true, errors: [] });
    (getCacheFallbackConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      redisErrorThresholdGlobal: 3,
      redisErrorThresholdLocal: 3,
      redisReconnectInterval: 30000,
      fallbackOnRedisError: true,
      writeToMemory: true,
    });
    // Reset module registry to get fresh state each time
    vi.resetModules();
  });

  describe('isRedisGloballyDisabled', () => {
    it('should return false by default', async () => {
      const { isRedisGloballyDisabled } = await import('@withwiz/cache/cache-redis');
      expect(isRedisGloballyDisabled()).toBe(false);
    });
  });

  describe('notifyRedisError', () => {
    it('should increment error count', async () => {
      const { notifyRedisError, getRedisGlobalStatus } = await import('@withwiz/cache/cache-redis');

      notifyRedisError(new Error('Connection refused'), 'test');
      const status = getRedisGlobalStatus();

      expect(status.errorCount).toBe(1);
      expect(status.lastErrorMessage).toBe('Connection refused');
      expect(status.lastErrorTime).toBeInstanceOf(Date);
    });

    it('should disable Redis globally after threshold is reached', async () => {
      const { notifyRedisError, isRedisGloballyDisabled } = await import('@withwiz/cache/cache-redis');

      // Default threshold is 3
      notifyRedisError(new Error('err1'), 'test');
      notifyRedisError(new Error('err2'), 'test');
      expect(isRedisGloballyDisabled()).toBe(false);

      notifyRedisError(new Error('err3'), 'test');
      expect(isRedisGloballyDisabled()).toBe(true);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis globally disabled'),
        expect.any(Object)
      );
    });
  });

  describe('resetRedisGlobalState', () => {
    it('should reset all error state', async () => {
      const { notifyRedisError, resetRedisGlobalState, getRedisGlobalStatus } = await import('@withwiz/cache/cache-redis');

      // Accumulate errors
      notifyRedisError(new Error('err1'), 'test');
      notifyRedisError(new Error('err2'), 'test');
      notifyRedisError(new Error('err3'), 'test');

      resetRedisGlobalState();
      const status = getRedisGlobalStatus();

      expect(status.isDisabled).toBe(false);
      expect(status.errorCount).toBe(0);
      expect(status.lastErrorTime).toBeNull();
      expect(status.lastErrorMessage).toBeNull();
    });
  });

  describe('getRedisGlobalStatus', () => {
    it('should return current state snapshot', async () => {
      const { getRedisGlobalStatus } = await import('@withwiz/cache/cache-redis');

      const status = getRedisGlobalStatus();
      expect(status).toEqual({
        isDisabled: false,
        errorCount: 0,
        lastErrorTime: null,
        lastErrorMessage: null,
      });
    });
  });

  describe('isRedisAvailableNow', () => {
    it('should return false when Redis is globally disabled', async () => {
      const { notifyRedisError, isRedisAvailableNow } = await import('@withwiz/cache/cache-redis');

      // Trigger global disable
      notifyRedisError(new Error('err1'), 'test');
      notifyRedisError(new Error('err2'), 'test');
      notifyRedisError(new Error('err3'), 'test');

      expect(isRedisAvailableNow()).toBe(false);
    });

    it('should return true when cache is enabled and Redis is available', async () => {
      const { isRedisAvailableNow } = await import('@withwiz/cache/cache-redis');
      expect(isRedisAvailableNow()).toBe(true);
    });
  });

  describe('checkRedisConnection', () => {
    it('should return failure when cache is disabled', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('CACHE_ENABLED=false');
    });

    it('should return failure when Redis environment validation fails', async () => {
      const { validateRedisEnvironment, getConfig: getCacheConfig } = await import('@withwiz/cache/cache-env');
      // Ensure isCacheEnabled and getConfig().isRedisAvailable pass
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (validateRedisEnvironment as ReturnType<typeof vi.fn>).mockReturnValue({
        isValid: false,
        errors: ['Redis URL is not configured.'],
      });

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis environment variable validation failed');
    });

    it('should return failure when Redis backend is disabled', async () => {
      const { getConfig: getCacheConfig } = await import('@withwiz/cache/cache-env');
      // Ensure isCacheEnabled passes but getConfig().isRedisAvailable fails
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => false,
      });

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('CACHE_REDIS_ENABLED=false');
    });
  });

  describe('getRedisClient', () => {
    it('should return null when Redis is globally disabled', async () => {
      const { notifyRedisError, getRedisClient } = await import('@withwiz/cache/cache-redis');

      // Trigger global disable
      notifyRedisError(new Error('err1'), 'test');
      notifyRedisError(new Error('err2'), 'test');
      notifyRedisError(new Error('err3'), 'test');

      const client = getRedisClient();
      expect(client).toBeNull();
    });

    it('should return cached client when already initialized', async () => {
      const { getRedisClient } = await import('@withwiz/cache/cache-redis');

      // First call initializes
      const client1 = getRedisClient();
      expect(client1).not.toBeNull();

      // Second call returns cached instance
      const client2 = getRedisClient();
      expect(client2).toBe(client1);
    });

    it('should return null when isRedisAvailableNow returns false', async () => {
      const { getConfig: getCacheConfig } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => false,
      });

      const { getRedisClient } = await import('@withwiz/cache/cache-redis');

      const client = getRedisClient();
      expect(client).toBeNull();
    });

    it('should return null when REDIS_REST_URL is missing', async () => {
      const { getEnv, getConfig: getCacheConfig } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: '',
        REDIS_REST_TOKEN: 'test-token-123',
      });

      const { getRedisClient } = await import('@withwiz/cache/cache-redis');

      const client = getRedisClient();
      expect(client).toBeNull();
    });

    it('should return null when REDIS_REST_TOKEN is missing', async () => {
      const { getEnv, getConfig: getCacheConfig } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: 'https://test-redis.upstash.io',
        REDIS_REST_TOKEN: '',
      });

      const { getRedisClient } = await import('@withwiz/cache/cache-redis');

      const client = getRedisClient();
      expect(client).toBeNull();
    });

    it('should create and return Redis instance with valid config', async () => {
      const { Redis } = await import('@upstash/redis');
      const { getRedisClient } = await import('@withwiz/cache/cache-redis');

      const client = getRedisClient();
      expect(client).not.toBeNull();
      expect(Redis).toHaveBeenCalledWith({
        url: 'https://test-redis.upstash.io',
        token: 'test-token-123',
      });
    });
  });

  describe('checkRedisConnection - additional cases', () => {
    it('should return success when ping returns PONG', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { getConfig: getCacheConfig, validateRedisEnvironment, getEnv } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (validateRedisEnvironment as ReturnType<typeof vi.fn>).mockReturnValue({
        isValid: true,
        errors: [],
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: 'https://test-redis.upstash.io',
        REDIS_REST_TOKEN: 'test-token-123',
      });

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(true);
      expect(result.details).toBeDefined();
      expect(result.details.pingResult).toBe('PONG');
      expect(result.details.responseTime).toBeDefined();
    });

    it('should return failure when ping returns non-PONG value', async () => {
      mockPingResult = 'ERROR';

      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { getConfig: getCacheConfig, validateRedisEnvironment, getEnv } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (validateRedisEnvironment as ReturnType<typeof vi.fn>).mockReturnValue({
        isValid: true,
        errors: [],
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: 'https://test-redis.upstash.io',
        REDIS_REST_TOKEN: 'test-token-123',
      });

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis PING response differs from expected');
    });

    it('should return failure when Redis throws an exception', async () => {
      mockPingError = new Error('Connection timeout');

      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { getConfig: getCacheConfig, validateRedisEnvironment, getEnv } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (validateRedisEnvironment as ReturnType<typeof vi.fn>).mockReturnValue({
        isValid: true,
        errors: [],
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: 'https://test-redis.upstash.io',
        REDIS_REST_TOKEN: 'test-token-123',
      });

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
      expect(result.details).toBeDefined();
      expect(result.details.responseTime).toBeDefined();
    });

    it('should return failure when REDIS_REST_URL is empty string', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { getConfig: getCacheConfig, validateRedisEnvironment, getEnv } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (validateRedisEnvironment as ReturnType<typeof vi.fn>).mockReturnValue({
        isValid: true,
        errors: [],
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: '   ',
        REDIS_REST_TOKEN: 'test-token-123',
      });

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis environment variables are not configured');
    });

    it('should return failure when REDIS_REST_TOKEN is empty string', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { getConfig: getCacheConfig, validateRedisEnvironment, getEnv } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (validateRedisEnvironment as ReturnType<typeof vi.fn>).mockReturnValue({
        isValid: true,
        errors: [],
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: 'https://test-redis.upstash.io',
        REDIS_REST_TOKEN: '   ',
      });

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis environment variables are not configured');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockPingError = 'string error';

      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { getConfig: getCacheConfig, validateRedisEnvironment, getEnv } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => true,
      });
      (validateRedisEnvironment as ReturnType<typeof vi.fn>).mockReturnValue({
        isValid: true,
        errors: [],
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: 'https://test-redis.upstash.io',
        REDIS_REST_TOKEN: 'test-token-123',
      });

      const { checkRedisConnection } = await import('@withwiz/cache/cache-redis');

      const result = await checkRedisConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('logRedisInitialization', () => {
    it('should skip logging when already logged', async () => {
      (globalThis as any).__redisCacheInitLogged = true;

      const { logRedisInitialization } = await import('@withwiz/cache/cache-redis');

      logRedisInitialization();
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log info when Redis is available', async () => {
      const { logRedisInitialization } = await import('@withwiz/cache/cache-redis');

      logRedisInitialization();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Redis cache connection initialization complete'),
        expect.any(Object)
      );
      expect((globalThis as any).__redisCacheInitLogged).toBe(true);
    });

    it('should log info when cache is disabled', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { getConfig: getCacheConfig } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => false,
      });

      const { logRedisInitialization } = await import('@withwiz/cache/cache-redis');

      logRedisInitialization();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Redis cache disabled'),
        expect.objectContaining({ cacheEnabled: false })
      );
    });

    it('should log warning when Redis env vars are missing', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { getConfig: getCacheConfig, getEnv } = await import('@withwiz/cache/cache-env');
      (getCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        isRedisAvailable: () => false,
      });
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValue({
        NODE_ENV: 'test',
        REDIS_REST_URL: '',
        REDIS_REST_TOKEN: '',
      });

      const { logRedisInitialization } = await import('@withwiz/cache/cache-redis');

      logRedisInitialization();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache disabled due to missing Redis environment variables'),
        expect.any(Object)
      );
    });
  });
});
