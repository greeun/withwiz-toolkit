/**
 * Cache Advanced module tests
 *
 * Test Scope:
 * - RedisCacheManager: Redis operations, connection status, metrics
 * - HybridCacheManager: Basic initialization and configuration tests
 *
 * Note: Detailed behavior of HybridCacheManager is verified in integration tests
 */

import { RedisCacheManager } from "@withwiz/cache/redis-cache-manager";
import { HybridCacheManager } from "@withwiz/cache/hybrid-cache-manager";

// Mock Redis client
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisScan = vi.fn();
const mockRedisExists = vi.fn();
const mockRedisIncrby = vi.fn();
const mockRedisExpire = vi.fn();
const mockRedisPing = vi.fn();

vi.mock("@withwiz/cache/cache-redis", () => ({
  getRedisClient: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    scan: mockRedisScan,
    exists: mockRedisExists,
    incrby: mockRedisIncrby,
    expire: mockRedisExpire,
    ping: mockRedisPing,
  })),
  notifyRedisError: vi.fn(),
  resetRedisGlobalState: vi.fn(),
  isRedisGloballyDisabled: vi.fn(() => false),
}));

// Mock global cache functions
const mockIsCacheEnabled = vi.fn(() => true);

vi.mock("@withwiz/cache/cache-env", () => ({
  isCacheEnabled: () => mockIsCacheEnabled(),
  getENV: vi.fn(() => ({
    CACHE: { ENABLED: true },
    REDIS: { URL: "mock-url", TOKEN: "mock-token" },
  })),
  getEnv: vi.fn(() => ({})),
  getConfig: vi.fn(() => ({
    enabled: true,
  })),
  validateRedisEnvironment: vi.fn(() => true),
  getCacheFallbackConfig: vi.fn(() => ({
    redisErrorThresholdGlobal: 5,
    redisReconnectInterval: 5000,
  })),
  getDefaultHybridConfig: vi.fn(() => ({
    backend: "hybrid",
    fallbackOnRedisError: true,
    writeToMemory: true,
    redisErrorThreshold: 5,
    redisReconnectInterval: 5000,
  })),
}));

// Mock logger
vi.mock("@withwiz/logger/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Cache Advanced Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCacheEnabled.mockReturnValue(true);
    mockRedisGet.mockClear();
    mockRedisSet.mockClear();
    mockRedisDel.mockClear();
    mockRedisScan.mockClear();
    mockRedisExists.mockClear();
    mockRedisIncrby.mockClear();
    mockRedisExpire.mockClear();
    mockRedisPing.mockClear();
  });

  describe("RedisCacheManager", () => {
    let manager: RedisCacheManager;

    beforeEach(() => {
      manager = RedisCacheManager.getInstance("test");
    });

    describe("Configuration", () => {
      it("should initialize with prefix", () => {
        expect(manager).toBeDefined();
        expect(manager.getMetrics()).toBeDefined();
        expect(manager.getConnectionStatus()).toBeDefined();
      });

      it("should have initial connection status", () => {
        const status = manager.getConnectionStatus();
        expect(status.isConnected).toBe(false); // Initially false, true after ping
        expect(status.connectionErrors).toBe(0);
      });

      it("should have zero metrics initially", () => {
        const metrics = manager.getMetrics();
        expect(metrics.hits).toBe(0);
        expect(metrics.misses).toBe(0);
        expect(metrics.errors).toBe(0);
        expect(metrics.totalRequests).toBe(0);
      });
    });

    describe("get operation", () => {
      it("should get value from Redis", async () => {
        mockRedisGet.mockResolvedValue("cached-value");

        const result = await manager.get<string>("key1");

        expect(result).toBe("cached-value");
        expect(mockRedisGet).toHaveBeenCalledWith("test:key1");
        expect(manager.getMetrics().hits).toBe(1);
        expect(manager.getMetrics().totalRequests).toBe(1);
      });

      it("should return null for non-existent key", async () => {
        mockRedisGet.mockResolvedValue(null);

        const result = await manager.get<string>("nonexistent");

        expect(result).toBe(null);
        expect(manager.getMetrics().misses).toBe(1);
      });

      it("should return null when cache disabled", async () => {
        mockIsCacheEnabled.mockReturnValue(false);

        // Use new prefix to reset metrics from getInstance
        const newManager = RedisCacheManager.getInstance("test-disabled");
        const result = await newManager.get<string>("key1");

        expect(result).toBeNull();
        expect(mockRedisGet).not.toHaveBeenCalled();
        expect(newManager.getMetrics().misses).toBe(1);
      });

      it("should handle Redis errors", async () => {
        mockRedisGet.mockRejectedValue(new Error("Redis connection error"));

        // Use new prefix to reset metrics from getInstance
        const newManager = RedisCacheManager.getInstance("test-error");
        const result = await newManager.get<string>("key1");

        expect(result).toBeNull();
        expect(newManager.getMetrics().errors).toBe(1);
      });
    });

    describe("set operation", () => {
      it("should set value in Redis without TTL", async () => {
        mockRedisSet.mockResolvedValue("OK");

        await manager.set("key1", "value1");

        expect(mockRedisSet).toHaveBeenCalledWith("test:key1", "value1");
      });

      it("should set value in Redis with TTL", async () => {
        mockRedisSet.mockResolvedValue("OK");

        await manager.set("key1", "value1", 300);

        expect(mockRedisSet).toHaveBeenCalledWith("test:key1", "value1", { ex: 300 });
      });

      it("should not set when cache disabled", async () => {
        mockIsCacheEnabled.mockReturnValue(false);

        await manager.set("key1", "value1");

        expect(mockRedisSet).not.toHaveBeenCalled();
      });

      it("should handle set errors gracefully", async () => {
        mockRedisSet.mockRejectedValue(new Error("Redis error"));

        await expect(manager.set("key1", "value1")).resolves.not.toThrow();
      });
    });

    describe("delete operation", () => {
      it("should delete key from Redis", async () => {
        mockRedisDel.mockResolvedValue(1);

        await manager.delete("key1");

        expect(mockRedisDel).toHaveBeenCalledWith("test:key1");
      });

      it("should handle delete errors gracefully", async () => {
        mockRedisDel.mockRejectedValue(new Error("Redis error"));

        await expect(manager.delete("key1")).resolves.not.toThrow();
      });
    });

    describe("exists operation", () => {
      it("should return true for existing key", async () => {
        mockRedisExists.mockResolvedValue(1);

        const result = await manager.exists("key1");

        expect(result).toBe(true);
        expect(mockRedisExists).toHaveBeenCalledWith("test:key1");
      });

      it("should return false for non-existent key", async () => {
        mockRedisExists.mockResolvedValue(0);

        const result = await manager.exists("key1");

        expect(result).toBe(false);
      });

      it("should handle exists errors", async () => {
        mockRedisExists.mockRejectedValue(new Error("Redis error"));

        const result = await manager.exists("key1");

        expect(result).toBe(false);
      });
    });

    describe("deletePattern operation", () => {
      it("should delete all keys matching pattern using scan", async () => {
        // scan returns [cursor, keys] - cursor 0 means scan complete
        mockRedisScan.mockResolvedValue([0, ["test:key1", "test:key2"]]);
        mockRedisDel.mockResolvedValue(2);

        await manager.deletePattern("*");

        expect(mockRedisScan).toHaveBeenCalledWith(0, { match: "test:*", count: 100 });
        expect(mockRedisDel).toHaveBeenCalledWith("test:key1", "test:key2");
      });

      it("should handle no keys to delete", async () => {
        mockRedisScan.mockResolvedValue([0, []]);

        await manager.deletePattern("*");

        expect(mockRedisScan).toHaveBeenCalled();
        expect(mockRedisDel).not.toHaveBeenCalled();
      });

      it("should handle deletePattern errors", async () => {
        mockRedisScan.mockRejectedValue(new Error("Redis error"));

        await expect(manager.deletePattern("*")).resolves.not.toThrow();
      });
    });

    describe("increment operation", () => {
      it("should increment key value", async () => {
        mockRedisIncrby.mockResolvedValue(5);

        const result = await manager.increment("counter", 2);

        expect(result).toBe(5);
        expect(mockRedisIncrby).toHaveBeenCalledWith("test:counter", 2);
      });

      it("should use default increment of 1", async () => {
        mockRedisIncrby.mockResolvedValue(1);

        const result = await manager.increment("counter");

        expect(result).toBe(1);
        expect(mockRedisIncrby).toHaveBeenCalledWith("test:counter", 1);
      });

      it("should handle increment errors", async () => {
        mockRedisIncrby.mockRejectedValue(new Error("Redis error"));

        const result = await manager.increment("counter");

        expect(result).toBe(0);
      });
    });

    describe("expire operation", () => {
      it("should set expiry on key", async () => {
        mockRedisExpire.mockResolvedValue(1);

        await manager.expire("key1", 300);

        expect(mockRedisExpire).toHaveBeenCalledWith("test:key1", 300);
      });

      it("should handle expire errors", async () => {
        mockRedisExpire.mockRejectedValue(new Error("Redis error"));

        await expect(manager.expire("key1", 300)).resolves.not.toThrow();
      });
    });

    describe("checkConnection operation", () => {
      it("should return true on successful ping", async () => {
        mockRedisPing.mockResolvedValue("PONG");

        const result = await manager.checkConnection();

        expect(result).toBe(true);
        expect(mockRedisPing).toHaveBeenCalled();
        expect(manager.getConnectionStatus().isConnected).toBe(true);
      });

      it("should return false on failed ping", async () => {
        mockRedisPing.mockRejectedValue(new Error("Connection failed"));

        const result = await manager.checkConnection();

        expect(result).toBe(false);
        expect(manager.getConnectionStatus().isConnected).toBe(false);
      });
    });
  });

  describe("HybridCacheManager", () => {
    describe("Configuration", () => {
      it("should create instance with proper config", () => {
        const manager = HybridCacheManager.getInstance("hybrid-test", {
          backend: "hybrid",
          redisManager: RedisCacheManager.getInstance("redis-for-hybrid"),
          fallbackOnRedisError: true,
        });

        expect(manager).toBeDefined();
        expect(manager.getMetrics()).toBeDefined();
        expect(manager.getConnectionStatus()).toBeDefined();
      });

      it("should support memory-only mode", () => {
        const manager = HybridCacheManager.getInstance("memory-test", {
          backend: "memory",
          redisManager: null,
        });

        expect(manager).toBeDefined();
        const status = manager.getConnectionStatus();
        expect(status.memoryActive).toBe(true);
      });

      it("should provide metrics structure", () => {
        const manager = HybridCacheManager.getInstance("metrics-test", {
          backend: "hybrid",
          redisManager: RedisCacheManager.getInstance("redis-metrics"),
        });

        const metrics = manager.getMetrics();
        expect(metrics.combined).toBeDefined();
        expect(metrics.memory).toBeDefined();
      });

      it("should provide connection status structure", () => {
        const manager = HybridCacheManager.getInstance("status-test", {
          backend: "hybrid",
          redisManager: RedisCacheManager.getInstance("redis-status"),
        });

        const status = manager.getConnectionStatus();
        expect(status.redisConnected).toBeDefined();
        expect(status.memoryActive).toBeDefined();
        expect(status.currentBackend).toBeDefined();
        expect(status.redisErrorCount).toBeDefined();
      });
    });
  });
});
