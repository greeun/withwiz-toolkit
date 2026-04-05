/**
 * Cache Managers tests
 *
 * 테스트 범위:
 * - InMemoryCacheManager: LRU, TTL, eviction
 * - NoopCacheManager: Disabled behavior
 */

import { InMemoryCacheManager } from "@withwiz/cache/inmemory-cache-manager";
import { NoopCacheManager } from "@withwiz/cache/noop-cache-manager";
import { HybridCacheManager } from "@withwiz/cache/hybrid-cache-manager";
import { initializeCache, resetCache } from "../../../src/cache/config";

// Mock Logger to avoid issues in test environment (e.g., setImmediate missing in jsdom/fakeTimers)
vi.mock("@withwiz/logger/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock timers
vi.useFakeTimers();

describe("Cache Managers", () => {
  describe("InMemoryCacheManager", () => {
    let cache: InMemoryCacheManager;

    beforeEach(() => {
      InMemoryCacheManager.clearInstances();
      cache = new InMemoryCacheManager("test", {
        maxSize: 100,
        maxMemoryMB: 10,
        defaultTTL: 3600,
        evictionPolicy: "lru",
        cleanupInterval: 60000,
      });
    });

    afterEach(() => {
      cache.destroy();
      vi.clearAllTimers();
    });

    describe("Basic CRUD", () => {
      it("should set and get value", async () => {
        await cache.set("key1", "value1");
        const result = await cache.get<string>("key1");

        expect(result).toBe("value1");
      });

      it("should return null for non-existent key", async () => {
        const result = await cache.get("nonexistent");
        expect(result).toBeNull();
      });

      it("should delete value", async () => {
        await cache.set("key1", "value1");
        await cache.delete("key1");
        const result = await cache.get("key1");

        expect(result).toBeNull();
      });

      it("should check if key exists", async () => {
        await cache.set("key1", "value1");

        expect(await cache.exists("key1")).toBe(true);
        expect(await cache.exists("nonexistent")).toBe(false);
      });

      it("should clear all cache", async () => {
        await cache.set("key1", "value1");
        await cache.set("key2", "value2");

        cache.clear();

        expect(await cache.get("key1")).toBeNull();
        expect(await cache.get("key2")).toBeNull();
      });
    });

    describe("TTL Processing", () => {
      it("should expire value after TTL", async () => {
        await cache.set("key1", "value1", 1); // 1s TTL

        // Immediate check - value exists
        expect(await cache.get("key1")).toBe("value1");

        // After 1.5s - expired
        vi.advanceTimersByTime(1500);
        expect(await cache.get("key1")).toBeNull();
      });

      it("should update TTL with expire method", async () => {
        await cache.set("key1", "value1", 1); // 1s TTL

        // Update TTL
        await cache.expire("key1", 10); // Extend to 10s

        // After 1.5s - still valid
        vi.advanceTimersByTime(1500);
        expect(await cache.get("key1")).toBe("value1");
      });

      it("should not return expired value on exists check", async () => {
        await cache.set("key1", "value1", 1);

        vi.advanceTimersByTime(1500);

        expect(await cache.exists("key1")).toBe(false);
      });
    });

    describe("Pattern Delete", () => {
      it("should delete by pattern with wildcard", async () => {
        await cache.set("user:1:profile", "data1");
        await cache.set("user:1:settings", "data2");
        await cache.set("user:2:profile", "data3");

        await cache.deletePattern("user:1:*");

        expect(await cache.get("user:1:profile")).toBeNull();
        expect(await cache.get("user:1:settings")).toBeNull();
        expect(await cache.get("user:2:profile")).toBe("data3");
      });

      it("should handle pattern without matches", async () => {
        await cache.set("key1", "value1");

        await cache.deletePattern("nonexistent:*");

        expect(await cache.get("key1")).toBe("value1");
      });
    });

    describe("Counter (increment)", () => {
      it("should increment value", async () => {
        const result1 = await cache.increment("counter");
        expect(result1).toBe(1);

        const result2 = await cache.increment("counter");
        expect(result2).toBe(2);

        const result3 = await cache.increment("counter", 5);
        expect(result3).toBe(7);
      });

      it("should handle increment on expired key", async () => {
        await cache.set("counter", 10, 1);

        vi.advanceTimersByTime(1500);

        const result = await cache.increment("counter");
        expect(result).toBe(1); // Expired, begins from 0
      });

      it("should handle increment on non-number value", async () => {
        await cache.set("counter", "not-a-number");

        const result = await cache.increment("counter");
        expect(result).toBe(1); // Treated as 0 then +1
      });
    });

    describe("LRU Eviction", () => {
      it("should evict least recently used item when maxSize reached", async () => {
        const smallCache = new InMemoryCacheManager("lru-test", {
          maxSize: 3,
          evictionPolicy: "lru",
        });

        await smallCache.set("key1", "value1");
        await smallCache.set("key2", "value2");
        await smallCache.set("key3", "value3");

        // key1 접근 (가장 최근)
        await smallCache.get("key1");

        // key4 추가 → key2가 제거되어야 함 (LRU)
        await smallCache.set("key4", "value4");

        expect(await smallCache.get("key1")).toBe("value1");
        expect(await smallCache.get("key2")).toBeNull(); // 제거됨
        expect(await smallCache.get("key3")).toBe("value3");
        expect(await smallCache.get("key4")).toBe("value4");

        smallCache.destroy();
      });

      it("should update access order on get", async () => {
        const smallCache = new InMemoryCacheManager("lru-test2", {
          maxSize: 2,
          evictionPolicy: "lru",
        });

        await smallCache.set("key1", "value1");
        await smallCache.set("key2", "value2");

        // key1 접근
        await smallCache.get("key1");

        // key3 추가 → key2가 제거됨
        await smallCache.set("key3", "value3");

        expect(await smallCache.get("key1")).toBe("value1");
        expect(await smallCache.get("key2")).toBeNull();
        expect(await smallCache.get("key3")).toBe("value3");

        smallCache.destroy();
      });
    });

    describe("Metrics", () => {
      it("should track hits and misses", async () => {
        await cache.set("key1", "value1");

        await cache.get("key1"); // hit
        await cache.get("key1"); // hit
        await cache.get("key2"); // miss
        await cache.get("key3"); // miss

        const metrics = cache.getMetrics();

        expect(metrics.hits).toBe(2);
        expect(metrics.misses).toBe(2);
        expect(metrics.totalRequests).toBe(4);
        expect(metrics.hitRate).toBe(50);
      });

      it("should track evictions", async () => {
        const smallCache = new InMemoryCacheManager("metrics-test", {
          maxSize: 2,
        });

        await smallCache.set("key1", "value1");
        await smallCache.set("key2", "value2");
        await smallCache.set("key3", "value3"); // eviction

        const metrics = smallCache.getMetrics();
        expect(metrics.evictions).toBeGreaterThan(0);

        smallCache.destroy();
      });

      it("should track expirations", async () => {
        await cache.set("key1", "value1", 1);

        vi.advanceTimersByTime(1500);

        await cache.get("key1"); // Expired

        const metrics = cache.getMetrics();
        expect(metrics.expirations).toBe(1);
      });
    });

    describe("Statistics", () => {
      it("should provide cache stats", async () => {
        await cache.set("key1", "value1");
        await cache.set("key2", "value2");

        const stats = cache.getStats();

        expect(stats.itemCount).toBe(2);
        expect(stats.maxSize).toBe(100);
        expect(stats.memoryUsageMB).toBeGreaterThanOrEqual(0); // Could be 0 (rounded)
        expect(stats.utilizationPercent).toBe(2);
      });
    });

    describe("Connection Status", () => {
      it("should always return connected for in-memory", async () => {
        expect(await cache.checkConnection()).toBe(true);

        const status = cache.getConnectionStatus() as any;
        expect(status.isConnected).toBe(true);
        expect(status.type).toBe("memory");
      });
    });

    describe("Configuration", () => {
      it("should return config", () => {
        const config = cache.getConfig();

        expect(config.prefix).toBe("test");
        expect(config.maxSize).toBe(100);
        expect(config.evictionPolicy).toBe("lru");
      });
    });

    describe("Singleton", () => {
      it("should return same instance for same prefix", () => {
        const instance1 = InMemoryCacheManager.getInstance("singleton-test");
        const instance2 = InMemoryCacheManager.getInstance("singleton-test");

        expect(instance1).toBe(instance2);

        instance1.destroy();
      });

      it("should return different instances for different prefixes", () => {
        const instance1 = InMemoryCacheManager.getInstance("prefix1");
        const instance2 = InMemoryCacheManager.getInstance("prefix2");

        expect(instance1).not.toBe(instance2);

        instance1.destroy();
        instance2.destroy();
      });

      it("should get all stats from all instances", () => {
        const instance1 = InMemoryCacheManager.getInstance("stats1");
        const instance2 = InMemoryCacheManager.getInstance("stats2");

        const allStats = InMemoryCacheManager.getAllStats();

        expect(allStats["stats1"]).toBeDefined();
        expect(allStats["stats2"]).toBeDefined();

        InMemoryCacheManager.destroyAll();
      });

      it("should destroy all instances", () => {
        InMemoryCacheManager.getInstance("test1");
        InMemoryCacheManager.getInstance("test2");

        InMemoryCacheManager.destroyAll();

        const allStats = InMemoryCacheManager.getAllStats();
        expect(Object.keys(allStats).length).toBe(0);
      });
    });

    describe("Auto Cleanup", () => {
      it("should cleanup expired items periodically", async () => {
        const cleanupCache = new InMemoryCacheManager("cleanup-test", {
          cleanupInterval: 1000, // 1s
        });

        await cleanupCache.set("key1", "value1", 0.5); // 0.5s TTL
        await cleanupCache.set("key2", "value2", 100); // 100s TTL

        // Before cleanup - both exist
        expect(cleanupCache.getStats().itemCount).toBe(2);

        // After 0.7s, key1 expired
        vi.advanceTimersByTime(700);

        // Run cleanup timer (additional 300ms)
        vi.advanceTimersByTime(300);
        vi.runOnlyPendingTimers();

        // After cleanup - key1 should be removed
        expect(await cleanupCache.get("key1")).toBeNull();
        // key2 is still valid (100s TTL)
        expect(await cleanupCache.get("key2")).toBe("value2");

        cleanupCache.destroy();
      });
    });

    describe("Edge Cases", () => {
      it("should handle very large values", async () => {
        const largeValue = "x".repeat(10000);
        await cache.set("large", largeValue);

        const result = await cache.get<string>("large");
        expect(result).toBe(largeValue);
      });

      it("should handle complex objects", async () => {
        const complexObj = {
          nested: {
            array: [1, 2, 3],
            object: { key: "value" },
          },
        };

        await cache.set("complex", complexObj);

        const result = await cache.get("complex");
        expect(result).toEqual(complexObj);
      });

      it("should handle null and undefined values", async () => {
        await cache.set("null", null);
        await cache.set("undefined", undefined);

        expect(await cache.get("null")).toBeNull();
        // undefined는 저장되지 않거나 undefined로 반환될 수 있음
        const undefinedValue = await cache.get("undefined");
        expect(undefinedValue === null || undefinedValue === undefined).toBe(
          true,
        );
      });

      it("should handle empty string", async () => {
        await cache.set("empty", "");

        const result = await cache.get<string>("empty");
        expect(result).toBe("");
      });
    });
  });

  describe("NoopCacheManager", () => {
    let noop: NoopCacheManager;

    beforeEach(() => {
      // Cache config 초기화 (NoopCacheManager.getConfig()가 cache config를 읽으므로)
      resetCache();
      initializeCache({ enabled: true, inmemory: { enabled: true } });
      noop = new NoopCacheManager("noop-test");
    });

    describe("All operations are no-op", () => {
      it("should always return null on get", async () => {
        await noop.set("key1", "value1");

        const result = await noop.get("key1");
        expect(result).toBeNull();
      });

      it("should do nothing on set", async () => {
        // 에러 없이 완료되어야 함
        await expect(noop.set("key", "value")).resolves.toBeUndefined();
      });

      it("should do nothing on delete", async () => {
        await expect(noop.delete("key")).resolves.toBeUndefined();
      });

      it("should do nothing on deletePattern", async () => {
        await expect(noop.deletePattern("pattern:*")).resolves.toBeUndefined();
      });

      it("should always return false on exists", async () => {
        await noop.set("key", "value");

        expect(await noop.exists("key")).toBe(false);
      });

      it("should always return 0 on increment", async () => {
        const result = await noop.increment();
        expect(result).toBe(0);
      });

      it("should do nothing on expire", async () => {
        await expect(noop.expire()).resolves.toBeUndefined();
      });
    });

    describe("메트릭", () => {
      it("should return zero metrics", () => {
        const metrics = noop.getMetrics();

        expect(metrics.hits).toBe(0);
        expect(metrics.misses).toBe(0);
        expect(metrics.totalRequests).toBe(0);
        expect(metrics.hitRate).toBe(0);
      });
    });

    describe("연결 상태", () => {
      it("should always return not connected", async () => {
        expect(await noop.checkConnection()).toBe(false);

        const status = noop.getConnectionStatus();
        expect(status.isConnected).toBe(false);
      });
    });

    describe("설정", () => {
      it("should return config with disabled reason", () => {
        const config = noop.getConfig();

        expect(config.prefix).toBe("noop-test");
        expect(config.enabled).toBe(false);
        expect(config.reason).toBeDefined();
      });
    });

    describe("성능 오버헤드", () => {
      it("should have minimal overhead", async () => {
        const iterations = 10000;
        const start = Date.now();

        for (let i = 0; i < iterations; i++) {
          await noop.get(`key${i}`);
          await noop.set(`key${i}`, `value${i}`);
        }

        const duration = Date.now() - start;

        // 10,000 작업이 100ms 이내에 완료되어야 함
        expect(duration).toBeLessThan(100);
      });
    });
  });
});

  describe("HybridCacheManager", () => {
    let hybridCache: any;

    beforeEach(() => {
      // Cache config 초기화
      resetCache();
      initializeCache({ enabled: true, inmemory: { enabled: true } });

      // Clear instances before each test
      if (HybridCacheManager.clearInstances) {
        HybridCacheManager.clearInstances();
      }
    });

    afterEach(() => {
      if (hybridCache && typeof hybridCache.destroy === "function") {
        hybridCache.destroy();
      }
    });

    describe("Basic Operations with Memory Backend", () => {
      it("should store and retrieve value when Redis is disabled", async () => {
        hybridCache = new HybridCacheManager("hybrid-test", {
          backend: "hybrid",
          redisManager: null, // Redis disabled
          writeToMemory: true,
          fallbackOnRedisError: true,
        });

        const key = "hybrid:test";
        const value = { data: "test" };

        await hybridCache.set(key, value);
        const result = await hybridCache.get(key);

        expect(result).toEqual(value);
      });

      it("should return null for non-existent key", async () => {
        hybridCache = new HybridCacheManager("hybrid-test-2", {
          backend: "hybrid",
          redisManager: null,
          writeToMemory: true,
          fallbackOnRedisError: true,
        });

        const result = await hybridCache.get("nonexistent:key");
        expect(result).toBeNull();
      });
    });

    describe("Fallback Behavior", () => {
      it("should fallback to InMemory when Redis is disabled", async () => {
        hybridCache = new HybridCacheManager("hybrid-fallback", {
          backend: "hybrid",
          redisManager: null,
          writeToMemory: true,
          fallbackOnRedisError: true,
        });

        const key = "fallback:test";
        const value = { id: 1 };

        await hybridCache.set(key, value);

        const status = hybridCache.getConnectionStatus();
        expect(status.redisConnected).toBe(false);
        expect(status.memoryActive).toBe(true);

        const result = await hybridCache.get(key);
        expect(result).toEqual(value);
      });

      it("should handle TTL in memory backend", async () => {
        hybridCache = new HybridCacheManager("hybrid-ttl", {
          backend: "hybrid",
          redisManager: null,
          writeToMemory: true,
          fallbackOnRedisError: true,
        });

        await hybridCache.set("ttl:test", "value", 1); // 1 second TTL

        expect(await hybridCache.get("ttl:test")).toBe("value");

        // Advance time by 1.1 seconds
        vi.advanceTimersByTime(1100);

        expect(await hybridCache.get("ttl:test")).toBeNull();
      });
    });

    describe("Delete Operations", () => {
      it("should delete key from memory backend", async () => {
        hybridCache = new HybridCacheManager("hybrid-delete", {
          backend: "hybrid",
          redisManager: null,
          writeToMemory: true,
          fallbackOnRedisError: true,
        });

        await hybridCache.set("delete:test", "value");
        expect(await hybridCache.get("delete:test")).toBe("value");

        await hybridCache.delete("delete:test");
        expect(await hybridCache.get("delete:test")).toBeNull();
      });

      it("should handle pattern-based deletion", async () => {
        hybridCache = new HybridCacheManager("hybrid-pattern", {
          backend: "hybrid",
          redisManager: null,
          writeToMemory: true,
          fallbackOnRedisError: true,
        });

        await hybridCache.set("user:1", { id: 1 });
        await hybridCache.set("user:2", { id: 2 });
        await hybridCache.set("link:1", { id: 1 });

        await hybridCache.deletePattern("user:*");

        expect(await hybridCache.get("user:1")).toBeNull();
        expect(await hybridCache.get("user:2")).toBeNull();
        expect(await hybridCache.get("link:1")).not.toBeNull();
      });
    });

    describe("Exists Operation", () => {
      it("should check key existence in memory backend", async () => {
        hybridCache = new HybridCacheManager("hybrid-exists", {
          backend: "hybrid",
          redisManager: null,
          writeToMemory: true,
          fallbackOnRedisError: true,
        });

        await hybridCache.set("exists:test", "value");

        expect(await hybridCache.exists("exists:test")).toBe(true);
        expect(await hybridCache.exists("nonexistent")).toBe(false);
      });
    });

    describe("Connection Status", () => {
      it("should report correct connection status when Redis is disabled", async () => {
        hybridCache = new HybridCacheManager("hybrid-status", {
          backend: "hybrid",
          redisManager: null,
          writeToMemory: true,
          fallbackOnRedisError: true,
        });

        const status = hybridCache.getConnectionStatus();
        expect(status.redisConnected).toBe(false);
        expect(status.memoryActive).toBe(true);
        expect(status.currentBackend).toBe("memory");
      });
    });
  });
