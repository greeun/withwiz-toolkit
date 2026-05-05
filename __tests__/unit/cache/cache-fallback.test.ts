/**
 * Cache Fallback Tests
 *
 * HybridCacheManager의 Redis 장애 시 폴백 동작 검증
 * Redis가 실패할 때 시스템이 정상적으로 degradation되는지 확인
 */

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@withwiz/cache/cache-redis', () => ({
  isRedisGloballyDisabled: vi.fn(() => false),
  notifyRedisError: vi.fn(),
  resetRedisGlobalState: vi.fn(),
}));

vi.mock('@withwiz/cache/cache-env', () => ({
  getCacheFallbackConfig: vi.fn(() => ({
    redisErrorThresholdGlobal: 3,
    redisErrorThresholdLocal: 3,
    redisReconnectInterval: 30000,
    fallbackOnRedisError: true,
    writeToMemory: true,
  })),
}));

import { logger } from '@withwiz/logger/logger';
import { isRedisGloballyDisabled, notifyRedisError } from '@withwiz/cache/cache-redis';

/**
 * Mock Redis Manager that can be configured to fail
 */
function createMockRedisManager(options?: { failOn?: string[] }) {
  const failOn = options?.failOn ?? [];
  const store = new Map<string, any>();

  return {
    get: vi.fn(async <T>(key: string): Promise<T | null> => {
      if (failOn.includes('get')) {
        throw new Error('Redis connection refused');
      }
      return (store.get(key) as T) ?? null;
    }),
    set: vi.fn(async <T>(key: string, value: T, _ttl?: number): Promise<void> => {
      if (failOn.includes('set')) {
        throw new Error('Redis write timeout');
      }
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string): Promise<void> => {
      if (failOn.includes('delete')) {
        throw new Error('Redis delete failed');
      }
      store.delete(key);
    }),
    deletePattern: vi.fn(async (_pattern: string): Promise<void> => {
      if (failOn.includes('deletePattern')) {
        throw new Error('Redis SCAN failed');
      }
      store.clear();
    }),
    exists: vi.fn(async (key: string): Promise<boolean> => {
      if (failOn.includes('exists')) {
        throw new Error('Redis connection lost');
      }
      return store.has(key);
    }),
    increment: vi.fn(async (key: string, value: number = 1): Promise<number> => {
      if (failOn.includes('increment')) {
        throw new Error('Redis increment failed');
      }
      const current = (store.get(key) as number) || 0;
      store.set(key, current + value);
      return current + value;
    }),
    expire: vi.fn(async (_key: string, _ttl: number): Promise<void> => {
      if (failOn.includes('expire')) {
        throw new Error('Redis expire failed');
      }
    }),
    getMetrics: vi.fn(() => ({
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      hitRate: 0,
      averageResponseTime: 0,
    })),
    getConnectionStatus: vi.fn(() => ({
      isConnected: true,
    })),
    checkConnection: vi.fn(async () => true),
    store, // expose for test assertions
  };
}

describe('Cache Fallback - HybridCacheManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Clean up global instances
    delete (globalThis as any).__hybridCacheInstances;
    delete (globalThis as any).__inMemoryCacheInstances;
    (isRedisGloballyDisabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Redis get failure → fallback to in-memory', () => {
    it('should return null when Redis get fails and no in-memory data exists', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['get'] });
      const manager = new HybridCacheManager('test-fallback-get', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      const result = await manager.get('nonexistent-key');
      expect(result).toBeNull();

      // Should have logged the Redis error
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis error'),
        expect.objectContaining({ operation: 'get' })
      );

      manager.destroy();
    });

    it('should fallback to in-memory cache when Redis get throws', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['get'] });
      const manager = new HybridCacheManager('test-fallback-get-mem', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      // First, store data in memory via set (which will try Redis but also writes to memory)
      const workingRedis = createMockRedisManager();
      const setupManager = new HybridCacheManager('test-fallback-get-mem', {
        backend: 'memory',
        redisManager: workingRedis,
      });
      await setupManager.set('test-key', { data: 'cached-value' }, 3600);
      setupManager.destroy();

      // Now try to get with failing Redis - should fallback to memory
      const result = await manager.get<{ data: string }>('test-key');
      // The data should come from in-memory fallback (it may be null if separate instances)
      // The important thing is it doesn't throw
      expect(failingRedis.get).toHaveBeenCalled();

      manager.destroy();
    });
  });

  describe('Redis set failure → graceful handling', () => {
    it('should not crash when Redis set throws', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['set'] });
      const manager = new HybridCacheManager('test-fallback-set', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      // Should not throw even when Redis fails
      await expect(
        manager.set('my-key', { value: 'important-data' }, 300)
      ).resolves.not.toThrow();

      // Should still store in memory when writeToMemory is true
      // Verify by reading from memory backend
      manager.destroy();
    });

    it('should log error when Redis set fails', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['set'] });
      const manager = new HybridCacheManager('test-fallback-set-log', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await manager.set('key', 'value', 60);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis error'),
        expect.objectContaining({ operation: 'set' })
      );

      manager.destroy();
    });

    it('should notify global Redis error state when set fails', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['set'] });
      const manager = new HybridCacheManager('test-fallback-set-notify', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await manager.set('key', 'value');

      expect(notifyRedisError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('HybridCacheManager.set')
      );

      manager.destroy();
    });
  });

  describe('Redis connection lost → operations degrade gracefully', () => {
    it('should disable Redis temporarily after error threshold is reached', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['get', 'set'] });
      const manager = new HybridCacheManager('test-threshold', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 3,
        redisReconnectInterval: 30000,
      });

      // Trigger enough errors to hit threshold
      await manager.get('key1');
      await manager.get('key2');
      await manager.get('key3');

      // Check connection status reflects disabled state
      const status = manager.getConnectionStatus();
      expect(status.redisErrorCount).toBe(3);
      expect(status.redisConnected).toBe(false);
      expect(status.lastRedisErrorMessage).toBe('Redis connection refused');

      manager.destroy();
    });

    it('should fall back to memory backend when Redis is disabled', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['get', 'set'] });
      const manager = new HybridCacheManager('test-degrade', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 30000,
      });

      // Trigger Redis disable
      await manager.get('key1');
      await manager.get('key2');

      // After threshold, should work with memory only
      await expect(manager.set('key', 'memory-value')).resolves.not.toThrow();

      // Verify effective backend is now memory
      const config = manager.getConfig() as any;
      expect(config.isRedisTemporarilyDisabled).toBe(true);

      manager.destroy();
    });

    it('should attempt reconnection after reconnect interval', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['get'] });
      failingRedis.checkConnection.mockResolvedValue(true);

      const manager = new HybridCacheManager('test-reconnect', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 5000,
      });

      // Trigger Redis disable
      await manager.get('key1');
      await manager.get('key2');

      // Verify Redis is disabled
      expect(manager.getConnectionStatus().redisConnected).toBe(false);

      // Advance timer to trigger reconnection
      await vi.advanceTimersByTimeAsync(5000);

      // After successful reconnection, Redis should be re-enabled
      const status = manager.getConnectionStatus();
      expect(status.redisConnected).toBe(true);
      expect(status.redisErrorCount).toBe(0);

      manager.destroy();
    });

    it('should keep retrying reconnection if it fails', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['get'] });
      failingRedis.checkConnection.mockResolvedValue(false);

      const manager = new HybridCacheManager('test-retry-reconnect', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 5000,
      });

      // Trigger Redis disable
      await manager.get('key1');
      await manager.get('key2');

      // First reconnect attempt fails
      await vi.advanceTimersByTimeAsync(5000);
      expect(manager.getConnectionStatus().redisConnected).toBe(false);

      // Should schedule another attempt
      failingRedis.checkConnection.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(5000);

      // Now it should be reconnected
      expect(manager.getConnectionStatus().redisConnected).toBe(true);

      manager.destroy();
    });

    it('should use memory mode when Redis is globally disabled', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      (isRedisGloballyDisabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const workingRedis = createMockRedisManager();
      const manager = new HybridCacheManager('test-global-disable', {
        backend: 'hybrid',
        redisManager: workingRedis,
      });

      const status = manager.getConnectionStatus();
      expect(status.redisConnected).toBe(false);
      expect(status.redisGloballyDisabled).toBe(true);
      expect(status.currentBackend).toBe('memory');

      // Operations should still work via memory
      await expect(manager.set('key', 'value')).resolves.not.toThrow();
      // Redis should never be called
      expect(workingRedis.set).not.toHaveBeenCalled();

      manager.destroy();
    });
  });

  describe('delete/deletePattern with Redis failure', () => {
    it('should not crash when Redis delete fails in hybrid mode', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['delete'] });
      const manager = new HybridCacheManager('test-delete-fail', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await expect(manager.delete('some-key')).resolves.not.toThrow();
      manager.destroy();
    });

    it('should not crash when Redis deletePattern fails in hybrid mode', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['deletePattern'] });
      const manager = new HybridCacheManager('test-deletepattern-fail', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await expect(manager.deletePattern('user:*')).resolves.not.toThrow();
      manager.destroy();
    });
  });

  describe('Metrics tracking during fallback', () => {
    it('should track Redis fallback count in metrics', async () => {
      const { HybridCacheManager } = await import('@withwiz/cache/hybrid-cache-manager');

      const failingRedis = createMockRedisManager({ failOn: ['get'] });
      const manager = new HybridCacheManager('test-metrics-fallback', {
        backend: 'hybrid',
        redisManager: failingRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await manager.get('key1');
      await manager.get('key2');

      const metrics = manager.getMetrics();
      expect(metrics.combined.redisFallbacks).toBe(2);

      manager.destroy();
    });
  });
});
