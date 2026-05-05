/**
 * HybridCacheManager Unit Tests
 *
 * 재연결 로직, static factory methods, 에러 임계값 동작,
 * destroy/resetRedisErrorState 등 미커버된 영역 중심 테스트
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
    redisErrorThresholdGlobal: 5,
    redisErrorThresholdLocal: 3,
    redisReconnectInterval: 5000,
    fallbackOnRedisError: true,
    writeToMemory: true,
  })),
}));

import { logger } from '@withwiz/logger/logger';
import { isRedisGloballyDisabled, notifyRedisError, resetRedisGlobalState } from '@withwiz/cache/cache-redis';
import { HybridCacheManager } from '@withwiz/cache/hybrid-cache-manager';

/**
 * Mock Redis Manager factory
 */
function createMockRedisManager(overrides: Record<string, any> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deletePattern: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    increment: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockReturnValue({ hits: 0, misses: 0, errors: 0, totalRequests: 0, hitRate: 0, averageResponseTime: 0 }),
    getConnectionStatus: vi.fn().mockReturnValue({ isConnected: true }),
    checkConnection: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('HybridCacheManager', () => {
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

  // ==========================================================================
  // tryReconnectRedis
  // ==========================================================================
  describe('tryReconnectRedis', () => {
    it('should not attempt reconnection when redisManager is null', async () => {
      const manager = new HybridCacheManager('test-no-redis', {
        backend: 'hybrid',
        redisManager: null,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 1,
        redisReconnectInterval: 3000,
      });

      // Manually trigger the reconnect logic by causing a threshold breach
      // Since redisManager is null, no Redis calls will happen
      // We just verify that the manager works without errors
      await manager.get('key');
      const status = manager.getConnectionStatus();
      expect(status.redisConnected).toBe(false);

      manager.destroy();
    });

    it('should reset error state when checkConnection returns true', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection lost')),
        checkConnection: vi.fn().mockResolvedValue(true),
      });

      const manager = new HybridCacheManager('test-reconnect-success', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 3000,
      });

      // Trigger threshold to disable Redis
      await manager.get('key1');
      await manager.get('key2');

      expect(manager.getConnectionStatus().redisConnected).toBe(false);
      expect(manager.getConnectionStatus().redisErrorCount).toBe(2);

      // Advance timer to trigger reconnect
      await vi.advanceTimersByTimeAsync(3000);

      // After successful reconnection
      expect(manager.getConnectionStatus().redisConnected).toBe(true);
      expect(manager.getConnectionStatus().redisErrorCount).toBe(0);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('reconnection successful'),
        expect.any(Object)
      );

      manager.destroy();
    });

    it('should schedule another timer when checkConnection returns false', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection lost')),
        checkConnection: vi.fn().mockResolvedValue(false),
      });

      const manager = new HybridCacheManager('test-reconnect-fail', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 3000,
      });

      // Trigger threshold
      await manager.get('key1');
      await manager.get('key2');

      // First reconnect attempt fails
      await vi.advanceTimersByTimeAsync(3000);
      expect(manager.getConnectionStatus().redisConnected).toBe(false);

      // Still disabled, will retry
      mockRedis.checkConnection.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(3000);

      expect(manager.getConnectionStatus().redisConnected).toBe(true);

      manager.destroy();
    });

    it('should schedule another timer when checkConnection throws', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection lost')),
        checkConnection: vi.fn().mockRejectedValue(new Error('network error')),
      });

      const manager = new HybridCacheManager('test-reconnect-throw', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 3000,
      });

      // Trigger threshold
      await manager.get('key1');
      await manager.get('key2');

      // First reconnect attempt throws
      await vi.advanceTimersByTimeAsync(3000);
      expect(manager.getConnectionStatus().redisConnected).toBe(false);

      // Make it succeed on next attempt
      mockRedis.checkConnection.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(3000);

      expect(manager.getConnectionStatus().redisConnected).toBe(true);

      manager.destroy();
    });
  });

  // ==========================================================================
  // resetRedisErrorState
  // ==========================================================================
  describe('resetRedisErrorState (via successful Redis operation)', () => {
    it('should reset error count after a successful Redis get', async () => {
      const mockRedis = createMockRedisManager();
      // First call fails, second succeeds
      mockRedis.get
        .mockRejectedValueOnce(new Error('transient error'))
        .mockResolvedValueOnce('some-value');

      const manager = new HybridCacheManager('test-reset-on-success', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 5,
        redisReconnectInterval: 5000,
      });

      // Trigger an error
      await manager.get('key1');
      expect(manager.getConnectionStatus().redisErrorCount).toBe(1);

      // Successful get resets
      await manager.get('key2');
      expect(manager.getConnectionStatus().redisErrorCount).toBe(0);

      manager.destroy();
    });

    it('should clear reconnect timer when error state is reset', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection lost')),
        checkConnection: vi.fn().mockResolvedValue(true),
      });

      const manager = new HybridCacheManager('test-clear-timer', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 5000,
      });

      // Trigger threshold to set reconnect timer
      await manager.get('key1');
      await manager.get('key2');

      expect(manager.getConnectionStatus().redisConnected).toBe(false);

      // Advance timer to trigger reconnect -> resets state
      await vi.advanceTimersByTimeAsync(5000);

      // Timer should be cleared now
      expect(manager.getConnectionStatus().redisConnected).toBe(true);
      expect(manager.getConnectionStatus().redisErrorCount).toBe(0);

      manager.destroy();
    });
  });

  // ==========================================================================
  // destroy
  // ==========================================================================
  describe('destroy', () => {
    it('should clear reconnect timer and log destruction', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection lost')),
      });

      const manager = new HybridCacheManager('test-destroy', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 5000,
      });

      // Trigger threshold to create reconnect timer
      await manager.get('key1');
      await manager.get('key2');

      vi.clearAllMocks();

      // Destroy the instance
      manager.destroy();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Instance destroyed'),
        expect.objectContaining({ prefix: 'test-destroy' })
      );

      // Timer should not fire after destroy
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockRedis.checkConnection).not.toHaveBeenCalled();
    });

    it('should be safe to call destroy when no timer is active', () => {
      const mockRedis = createMockRedisManager();
      const manager = new HybridCacheManager('test-destroy-no-timer', {
        backend: 'hybrid',
        redisManager: mockRedis,
      });

      // Should not throw
      expect(() => manager.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // Static getInstance
  // ==========================================================================
  describe('static getInstance', () => {
    it('should create a new instance on first call', () => {
      const mockRedis = createMockRedisManager();
      const instance = HybridCacheManager.getInstance('singleton-test', {
        backend: 'hybrid',
        redisManager: mockRedis,
      });

      expect(instance).toBeInstanceOf(HybridCacheManager);
      instance.destroy();
    });

    it('should return the same instance for the same prefix', () => {
      const mockRedis = createMockRedisManager();
      const config = { backend: 'hybrid' as const, redisManager: mockRedis };

      const instance1 = HybridCacheManager.getInstance('same-prefix', config);
      const instance2 = HybridCacheManager.getInstance('same-prefix', config);

      expect(instance1).toBe(instance2);
      instance1.destroy();
    });

    it('should return different instances for different prefixes', () => {
      const mockRedis = createMockRedisManager();
      const config = { backend: 'hybrid' as const, redisManager: mockRedis };

      const instance1 = HybridCacheManager.getInstance('prefix-a', config);
      const instance2 = HybridCacheManager.getInstance('prefix-b', config);

      expect(instance1).not.toBe(instance2);
      instance1.destroy();
      instance2.destroy();
    });
  });

  // ==========================================================================
  // Static destroyAll
  // ==========================================================================
  describe('static destroyAll', () => {
    it('should destroy all instances and clear the global map', () => {
      const mockRedis = createMockRedisManager();
      const config = { backend: 'hybrid' as const, redisManager: mockRedis };

      const instance1 = HybridCacheManager.getInstance('destroy-all-1', config);
      const instance2 = HybridCacheManager.getInstance('destroy-all-2', config);

      expect(instance1).toBeInstanceOf(HybridCacheManager);
      expect(instance2).toBeInstanceOf(HybridCacheManager);

      HybridCacheManager.destroyAll();

      // After destroyAll, getInstance should create new instances
      const instance3 = HybridCacheManager.getInstance('destroy-all-1', config);
      expect(instance3).not.toBe(instance1);

      HybridCacheManager.destroyAll();
    });

    it('should log destruction for each instance', () => {
      const mockRedis = createMockRedisManager();
      const config = { backend: 'hybrid' as const, redisManager: mockRedis };

      HybridCacheManager.getInstance('log-destroy-1', config);
      HybridCacheManager.getInstance('log-destroy-2', config);

      vi.clearAllMocks();
      HybridCacheManager.destroyAll();

      // Each HybridCacheManager instance logs destruction
      const destroyedCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('[HybridCacheManager] Instance destroyed')
      );
      expect(destroyedCalls.length).toBe(2);
    });
  });

  // ==========================================================================
  // handleRedisError threshold behavior
  // ==========================================================================
  describe('handleRedisError threshold behavior', () => {
    it('should not disable Redis when errors are below threshold', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('transient')),
      });

      const manager = new HybridCacheManager('test-below-threshold', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 5,
        redisReconnectInterval: 5000,
      });

      await manager.get('key1');
      await manager.get('key2');

      const status = manager.getConnectionStatus();
      // Below threshold of 5 → not disabled
      expect(status.redisErrorCount).toBe(2);
      expect(status.redisConnected).toBe(true);

      manager.destroy();
    });

    it('should disable Redis exactly at threshold', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('persistent error')),
      });

      const manager = new HybridCacheManager('test-at-threshold', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 3,
        redisReconnectInterval: 5000,
      });

      await manager.get('key1');
      await manager.get('key2');
      await manager.get('key3');

      const status = manager.getConnectionStatus();
      expect(status.redisErrorCount).toBe(3);
      expect(status.redisConnected).toBe(false);

      manager.destroy();
    });

    it('should not re-disable Redis if already disabled', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('persistent error')),
      });

      const manager = new HybridCacheManager('test-already-disabled', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 5000,
      });

      // Trigger threshold
      await manager.get('key1');
      await manager.get('key2');

      // The warn about "temporarily disabled" should have been called once
      const disableCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('temporarily disabled')
      );
      expect(disableCalls.length).toBe(1);

      // Further get calls should go to memory directly (no more Redis calls)
      vi.clearAllMocks();
      await manager.get('key3');
      await manager.get('key4');

      // Redis get should not have been called again (disabled state)
      expect(mockRedis.get).not.toHaveBeenCalled();

      manager.destroy();
    });

    it('should schedule reconnect timer when threshold is reached', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection refused')),
        checkConnection: vi.fn().mockResolvedValue(true),
      });

      const manager = new HybridCacheManager('test-reconnect-schedule', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 4000,
      });

      await manager.get('key1');
      await manager.get('key2');

      // Should be disabled now
      expect(manager.getConnectionStatus().redisConnected).toBe(false);

      // After reconnect interval, checkConnection should be called
      await vi.advanceTimersByTimeAsync(4000);

      expect(mockRedis.checkConnection).toHaveBeenCalled();
      expect(manager.getConnectionStatus().redisConnected).toBe(true);

      manager.destroy();
    });
  });

  // ==========================================================================
  // get with Redis error and fallback
  // ==========================================================================
  describe('get with Redis error and fallback', () => {
    it('should fall back to memory and increment fallback count when Redis throws', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection refused')),
      });

      const manager = new HybridCacheManager('test-fallback-count', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 10,
        redisReconnectInterval: 5000,
      });

      await manager.get('key1');
      await manager.get('key2');
      await manager.get('key3');

      const metrics = manager.getMetrics();
      expect(metrics.combined.redisFallbacks).toBe(3);

      manager.destroy();
    });

    it('should use memory directly when Redis is temporarily disabled', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection lost')),
      });

      const manager = new HybridCacheManager('test-disabled-memory', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 2,
        redisReconnectInterval: 5000,
      });

      // Disable Redis via threshold
      await manager.get('key1');
      await manager.get('key2');

      vi.clearAllMocks();

      // Now memory is used directly, no Redis call
      await manager.set('memory-key', 'memory-value', 60);
      await manager.get('memory-key');

      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();

      manager.destroy();
    });

    it('should return null when Redis throws and fallback is disabled', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('connection refused')),
      });

      const manager = new HybridCacheManager('test-no-fallback', {
        backend: 'redis',
        redisManager: mockRedis,
        fallbackOnRedisError: false,
        writeToMemory: false,
        redisErrorThreshold: 10,
        redisReconnectInterval: 5000,
      });

      const result = await manager.get('key1');
      expect(result).toBeNull();

      manager.destroy();
    });
  });

  // ==========================================================================
  // set in hybrid mode (writeToMemory=true)
  // ==========================================================================
  describe('set in hybrid mode', () => {
    it('should write to both Redis and memory when writeToMemory is true', async () => {
      const mockRedis = createMockRedisManager();

      const manager = new HybridCacheManager('test-hybrid-set', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 5,
        redisReconnectInterval: 5000,
      });

      await manager.set('dual-key', { name: 'test' }, 300);

      // Redis should be called
      expect(mockRedis.set).toHaveBeenCalledWith('dual-key', { name: 'test' }, 300);

      // Memory should also have the value (verify via get after disabling Redis)
      mockRedis.get.mockRejectedValueOnce(new Error('down'));
      const result = await manager.get<{ name: string }>('dual-key');
      expect(result).toEqual({ name: 'test' });

      manager.destroy();
    });

    it('should still write to memory when Redis set fails', async () => {
      const mockRedis = createMockRedisManager({
        set: vi.fn().mockRejectedValue(new Error('write timeout')),
        get: vi.fn().mockRejectedValue(new Error('down')),
      });

      const manager = new HybridCacheManager('test-set-redis-fail', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
        redisErrorThreshold: 10,
        redisReconnectInterval: 5000,
      });

      await manager.set('failover-key', 'failover-value', 120);

      // Even though Redis failed, memory should have the data
      // (fallback get from memory)
      const result = await manager.get<string>('failover-key');
      expect(result).toBe('failover-value');

      manager.destroy();
    });

    it('should not write to memory when writeToMemory is false in redis mode', async () => {
      const mockRedis = createMockRedisManager();

      const manager = new HybridCacheManager('test-redis-only', {
        backend: 'redis',
        redisManager: mockRedis,
        fallbackOnRedisError: false,
        writeToMemory: false,
        redisErrorThreshold: 5,
        redisReconnectInterval: 5000,
      });

      await manager.set('redis-only-key', 'redis-value', 300);
      expect(mockRedis.set).toHaveBeenCalledWith('redis-only-key', 'redis-value', 300);

      // When Redis is down, memory should not have it
      mockRedis.get.mockResolvedValue(null);
      const result = await manager.get('redis-only-key');
      expect(result).toBeNull();

      manager.destroy();
    });
  });

  // ==========================================================================
  // deletePattern
  // ==========================================================================
  describe('deletePattern', () => {
    it('should call Redis deletePattern and memory deletePattern in hybrid mode', async () => {
      const mockRedis = createMockRedisManager();

      const manager = new HybridCacheManager('test-delete-pattern', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await manager.deletePattern('user:*');

      expect(mockRedis.deletePattern).toHaveBeenCalledWith('user:*');

      manager.destroy();
    });

    it('should handle Redis deletePattern failure gracefully', async () => {
      const mockRedis = createMockRedisManager({
        deletePattern: vi.fn().mockRejectedValue(new Error('SCAN failed')),
      });

      const manager = new HybridCacheManager('test-delete-pattern-fail', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      // Should not throw
      await expect(manager.deletePattern('user:*')).resolves.not.toThrow();

      // Should have handled the error
      expect(notifyRedisError).toHaveBeenCalled();

      manager.destroy();
    });

    it('should only delete from memory when in memory mode', async () => {
      const mockRedis = createMockRedisManager();

      const manager = new HybridCacheManager('test-delete-pattern-memory', {
        backend: 'memory',
        redisManager: mockRedis,
      });

      await manager.deletePattern('session:*');

      // Redis should not be called in memory mode
      expect(mockRedis.deletePattern).not.toHaveBeenCalled();

      manager.destroy();
    });
  });

  // ==========================================================================
  // Additional coverage: exists, increment, expire with errors
  // ==========================================================================
  describe('exists with Redis error', () => {
    it('should fall back to memory when Redis exists throws in hybrid mode', async () => {
      const mockRedis = createMockRedisManager({
        exists: vi.fn().mockRejectedValue(new Error('timeout')),
      });

      const manager = new HybridCacheManager('test-exists-fallback', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      // First set a value to memory
      await manager.set('exists-key', 'value', 300);

      // Disable the set mock failure, just exists fails
      const result = await manager.exists('exists-key');
      // Memory should have it
      expect(result).toBe(true);

      manager.destroy();
    });
  });

  describe('increment with fallback', () => {
    it('should fall back to memory increment when Redis fails', async () => {
      const mockRedis = createMockRedisManager({
        increment: vi.fn().mockRejectedValue(new Error('INCR failed')),
      });

      const manager = new HybridCacheManager('test-increment-fallback', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      const result = await manager.increment('counter', 1);
      expect(result).toBe(1);

      const result2 = await manager.increment('counter', 1);
      expect(result2).toBe(2);

      manager.destroy();
    });

    it('should return 0 when increment fails and no fallback in redis mode', async () => {
      const mockRedis = createMockRedisManager({
        increment: vi.fn().mockRejectedValue(new Error('INCR failed')),
      });

      const manager = new HybridCacheManager('test-increment-no-fallback', {
        backend: 'redis',
        redisManager: mockRedis,
        fallbackOnRedisError: false,
        writeToMemory: false,
      });

      const result = await manager.increment('counter', 1);
      expect(result).toBe(0);

      manager.destroy();
    });
  });

  describe('expire with Redis error', () => {
    it('should handle Redis expire failure gracefully', async () => {
      const mockRedis = createMockRedisManager({
        expire: vi.fn().mockRejectedValue(new Error('EXPIRE failed')),
      });

      const manager = new HybridCacheManager('test-expire-fail', {
        backend: 'hybrid',
        redisManager: mockRedis,
        fallbackOnRedisError: true,
        writeToMemory: true,
      });

      await expect(manager.expire('key', 300)).resolves.not.toThrow();
      expect(notifyRedisError).toHaveBeenCalled();

      manager.destroy();
    });
  });

  // ==========================================================================
  // checkConnection
  // ==========================================================================
  describe('checkConnection', () => {
    it('should return true in memory mode without calling Redis', async () => {
      const mockRedis = createMockRedisManager();
      const manager = new HybridCacheManager('test-check-memory', {
        backend: 'memory',
        redisManager: mockRedis,
      });

      const result = await manager.checkConnection();
      expect(result).toBe(true);
      expect(mockRedis.checkConnection).not.toHaveBeenCalled();

      manager.destroy();
    });

    it('should return true and reset error state when Redis checkConnection succeeds', async () => {
      const mockRedis = createMockRedisManager({
        get: vi.fn().mockRejectedValue(new Error('error')),
        checkConnection: vi.fn().mockResolvedValue(true),
      });

      const manager = new HybridCacheManager('test-check-success', {
        backend: 'hybrid',
        redisManager: mockRedis,
        redisErrorThreshold: 10,
      });

      // Create some errors
      await manager.get('k1');
      expect(manager.getConnectionStatus().redisErrorCount).toBe(1);

      // checkConnection succeeds → resets
      const result = await manager.checkConnection();
      expect(result).toBe(true);
      expect(manager.getConnectionStatus().redisErrorCount).toBe(0);

      manager.destroy();
    });

    it('should return true in hybrid mode even when Redis check fails', async () => {
      const mockRedis = createMockRedisManager({
        checkConnection: vi.fn().mockRejectedValue(new Error('network error')),
      });

      const manager = new HybridCacheManager('test-check-hybrid-fail', {
        backend: 'hybrid',
        redisManager: mockRedis,
      });

      const result = await manager.checkConnection();
      // hybrid mode → still returns true (memory available)
      expect(result).toBe(true);

      manager.destroy();
    });

    it('should return false in redis mode when Redis check fails', async () => {
      const mockRedis = createMockRedisManager({
        checkConnection: vi.fn().mockResolvedValue(false),
      });

      const manager = new HybridCacheManager('test-check-redis-fail', {
        backend: 'redis',
        redisManager: mockRedis,
      });

      const result = await manager.checkConnection();
      expect(result).toBe(false);

      manager.destroy();
    });
  });

  // ==========================================================================
  // clearInstances (static)
  // ==========================================================================
  describe('static clearInstances', () => {
    it('should clear the instance map without destroying them', () => {
      const mockRedis = createMockRedisManager();
      const config = { backend: 'hybrid' as const, redisManager: mockRedis };

      const instance1 = HybridCacheManager.getInstance('clear-test', config);
      HybridCacheManager.clearInstances();

      // New getInstance should create a new instance
      const instance2 = HybridCacheManager.getInstance('clear-test', config);
      expect(instance2).not.toBe(instance1);

      instance1.destroy();
      instance2.destroy();
    });
  });
});
