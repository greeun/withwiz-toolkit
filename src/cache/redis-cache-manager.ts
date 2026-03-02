/**
 * Redis Cache Manager
 *
 * Redis 기반 캐시 매니저 클래스
 * - 전역 Redis 에러 상태와 연동
 */
import { logger } from "@withwiz/logger/logger";
import { getENV, isCacheEnabled } from "./cache-env";
import {
  getRedisClient,
  CacheMetrics,
  RedisConnectionStatus,
  notifyRedisError,
  resetRedisGlobalState,
  isRedisGloballyDisabled,
} from "./cache-redis";
import type { IUnifiedCacheManager } from "./cache-types";

// ============================================================================
// RedisCacheManager 클래스
// ============================================================================

export class RedisCacheManager implements IUnifiedCacheManager {
  private prefix: string;
  private metrics: CacheMetrics;
  private connectionStatus: RedisConnectionStatus;

  private constructor(prefix: string) {
    this.prefix = prefix;
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      hitRate: 0,
      averageResponseTime: 0,
    };
    this.connectionStatus = {
      isConnected: false,
      connectionErrors: 0,
    };
  }

  // globalThis를 사용하여 프로세스 레벨에서 인스턴스 관리 (HMR 안전)
  private static getGlobalInstances(): Map<string, RedisCacheManager> {
    if (!(globalThis as any).__redisCacheManagerInstances) {
      (globalThis as any).__redisCacheManagerInstances = new Map<
        string,
        RedisCacheManager
      >();
    }
    return (globalThis as any).__redisCacheManagerInstances;
  }

  // 정적 팩토리 메서드로 인스턴스 가져오기
  static getInstance(prefix: string): RedisCacheManager {
    const globalInstances = RedisCacheManager.getGlobalInstances();

    if (!globalInstances.has(prefix)) {
      const instance = new RedisCacheManager(prefix);
      globalInstances.set(prefix, instance);

      // 초기화 로그는 한 번만 출력
      logger.debug(`RedisCacheManager initialization: ${prefix}`, {
        prefix,
        redisAvailable: !!getRedisClient(),
        timestamp: new Date().toISOString(),
      });
    }

    return globalInstances.get(prefix)!;
  }

  // 인스턴스 초기화 (테스트용)
  static clearInstances(): void {
    RedisCacheManager.getGlobalInstances().clear();
  }

  // 메트릭 업데이트
  private updateMetrics(responseTime: number): void {
    this.metrics.hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.hits / this.metrics.totalRequests) * 100
        : 0;

    // 평균 응답 시간 계산 (가중 평균)
    const totalTime =
      this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) +
      responseTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
  }

  // 메트릭 조회
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  // 연결 상태 조회
  getConnectionStatus(): RedisConnectionStatus {
    return { ...this.connectionStatus };
  }

  // Redis 연결 상태 확인 (PING 테스트)
  async checkConnection(): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) {
      this.connectionStatus.isConnected = false;
      return false;
    }

    try {
      const pingResult = await redis.ping();
      if (pingResult === "PONG") {
        this.connectionStatus.isConnected = true;
        this.connectionStatus.lastPingTime = new Date();
        return true;
      } else {
        this.connectionStatus.isConnected = false;
        return false;
      }
    } catch (error) {
      this.connectionStatus.isConnected = false;
      this.connectionStatus.connectionErrors++;
      this.connectionStatus.lastConnectionError =
        error instanceof Error ? error.message : "Unknown error";
      this.connectionStatus.lastConnectionErrorTime = new Date();
      return false;
    }
  }

  // 캐시 설정 정보 조회
  getConfig() {
    const ENV = getENV();
    return {
      prefix: this.prefix,
      enabled: true,
      redisAvailable: !!getRedisClient(),
      envVars: {
        CACHE_ENABLED: ENV.CACHE.ENABLED ? "true" : "false",
        UPSTASH_REDIS_REST_URL: ENV.REDIS.URL ? "설정됨" : "미설정",
        UPSTASH_REDIS_REST_TOKEN: ENV.REDIS.TOKEN ? "설정됨" : "미설정",
      },
    };
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  // BigInt를 Number로 변환하는 헬퍼 함수
  private serializeData<T>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === "bigint") {
      return Number(data) as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.serializeData(item)) as T;
    }

    if (typeof data === "object") {
      const serialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.serializeData(value);
      }
      return serialized as T;
    }

    return data;
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    const fullKey = `${this.prefix}:${key}`;

    this.metrics.totalRequests++;

    // 캐시가 비활성화된 경우 바로 null 반환
    if (!isCacheEnabled()) {
      logger.debug(
        `Cache retrieval skipped due to cache disabled: ${fullKey}`,
        {
          prefix: this.prefix,
          key,
          fullKey,
          cacheEnabled: isCacheEnabled(),
        },
      );
      this.metrics.misses++;
      this.updateMetrics(0);
      return null;
    }

    // 전역적으로 Redis가 비활성화된 경우 바로 null 반환
    if (isRedisGloballyDisabled()) {
      this.metrics.misses++;
      this.updateMetrics(0);
      return null;
    }

    try {
      const redis = getRedisClient();
      if (!redis) {
        logger.warn(
          `Cache retrieval failed due to Redis unavailability: ${fullKey}`,
          {
            prefix: this.prefix,
            key,
            fullKey,
          },
        );
        this.metrics.errors++;
        return null;
      }

      logger.debug(`Cache retrieval started: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        timestamp: new Date().toISOString(),
      });

      const value = await redis.get(fullKey);
      const responseTime = Date.now() - startTime;

      // Redis 작업 성공 - 연결 상태 업데이트 및 전역 상태 리셋
      this.connectionStatus.isConnected = true;
      this.connectionStatus.lastPingTime = new Date();
      resetRedisGlobalState();

      if (value !== null && value !== undefined) {
        this.metrics.hits++;
        this.updateMetrics(responseTime);

        logger.debug(`[Cache:R] hit: ${fullKey}`, {
          prefix: this.prefix,
          key,
          fullKey,
          responseTime: `${responseTime}ms`,
          valueType: typeof value,
          valueSize: JSON.stringify(value)?.length || 0,
        });

        return value as T;
      } else {
        this.metrics.misses++;
        this.updateMetrics(responseTime);

        logger.debug(`[Cache:R] miss: ${fullKey} (${responseTime}ms)`);

        return null;
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";

      this.metrics.errors++;
      this.connectionStatus.connectionErrors++;
      this.connectionStatus.lastConnectionError = errorMessage;
      this.connectionStatus.lastConnectionErrorTime = new Date();
      this.updateMetrics(responseTime);

      // 전역 Redis 에러 상태 업데이트
      notifyRedisError(
        error instanceof Error ? error : new Error(errorMessage),
        `CacheManager.get:${this.prefix}`,
      );

      logger.error(`Cache retrieval failed: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        error: errorMessage,
        responseTime: `${responseTime}ms`,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();
    const fullKey = `${this.prefix}:${key}`;

    if (value === undefined) {
      logger.warn(`[Cache:R] Attempted to set undefined value: ${fullKey}`);
      return;
    }

    // 캐시가 비활성화된 경우 아무것도 하지 않음
    if (!isCacheEnabled()) {
      logger.debug(`Cache storage skipped due to cache disabled: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        cacheEnabled: isCacheEnabled(),
      });
      return;
    }

    // 전역적으로 Redis가 비활성화된 경우 아무것도 하지 않음
    if (isRedisGloballyDisabled()) {
      return;
    }

    try {
      const redis = getRedisClient();
      if (!redis) {
        logger.warn(
          `Cache storage failed due to Redis unavailability: ${fullKey}`,
          {
            prefix: this.prefix,
            key,
            fullKey,
            valueType: typeof value,
            valueSize: JSON.stringify(value)?.length || 0,
            ttl: ttl ? `${ttl}s` : "기본값",
            timestamp: new Date().toISOString(),
          },
        );
        return;
      }

      logger.debug(`Cache storage started: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        valueType: typeof value,
        valueSize: JSON.stringify(value)?.length || 0,
        ttl: ttl ? `${ttl}s` : "기본값",
        timestamp: new Date().toISOString(),
      });

      if (ttl) {
        await redis.set(fullKey, value, { ex: ttl });
      } else {
        await redis.set(fullKey, value);
      }

      const responseTime = Date.now() - startTime;

      // 연결 상태 업데이트 및 전역 상태 리셋
      this.connectionStatus.isConnected = true;
      this.connectionStatus.lastPingTime = new Date();
      resetRedisGlobalState();

      logger.info(`[Cache:R] set: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        responseTime: `${responseTime}ms`,
        ttl: ttl ? `${ttl}s` : "기본값",
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";

      this.connectionStatus.connectionErrors++;
      this.connectionStatus.lastConnectionError = errorMessage;
      this.connectionStatus.lastConnectionErrorTime = new Date();

      // 전역 Redis 에러 상태 업데이트
      notifyRedisError(
        error instanceof Error ? error : new Error(errorMessage),
        `CacheManager.set:${this.prefix}`,
      );

      logger.error(`Cache storage failed: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        error: errorMessage,
        responseTime: `${responseTime}ms`,
        valueType: typeof value,
        ttl,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  async delete(key: string): Promise<void> {
    const startTime = Date.now();
    const fullKey = `${this.prefix}:${key}`;

    try {
      const redis = getRedisClient();
      if (!redis) {
        logger.warn(
          `Cache deletion failed due to Redis unavailability: ${fullKey}`,
          {
            prefix: this.prefix,
            key,
            fullKey,
          },
        );
        return;
      }

      logger.debug(`Cache deletion started: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        timestamp: new Date().toISOString(),
      });

      await redis.del(fullKey);
      const responseTime = Date.now() - startTime;

      // Redis 작업 성공 - 연결 상태 업데이트
      this.connectionStatus.isConnected = true;
      this.connectionStatus.lastPingTime = new Date();

      logger.debug(`Cache deletion completed: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        responseTime: `${responseTime}ms`,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";

      this.connectionStatus.connectionErrors++;
      this.connectionStatus.lastConnectionError = errorMessage;
      this.connectionStatus.lastConnectionErrorTime = new Date();

      logger.error(`Cache deletion failed: ${fullKey}`, {
        prefix: this.prefix,
        key,
        fullKey,
        error: errorMessage,
        responseTime: `${responseTime}ms`,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
      return;
    }

    try {
      // keys 대신 scan 사용 (O(N) 블로킹 방지, Redis 명령 최적화)
      let cursor = 0;
      do {
        const result = await redis.scan(cursor, {
          match: this.getKey(pattern),
          count: 100,
        });
        const nextCursor = result[0];
        const keys = result[1];
        cursor = typeof nextCursor === "string" ? parseInt(nextCursor, 10) : nextCursor;
        if (Array.isArray(keys) && keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== 0);

      // Redis 작업 성공 - 연결 상태 업데이트
      this.connectionStatus.isConnected = true;
      this.connectionStatus.lastPingTime = new Date();
    } catch (error) {
      logger.error("Cache delete pattern error:", error);
      this.connectionStatus.connectionErrors++;
    }
  }

  async exists(key: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) {
      return false;
    }

    try {
      const result = await redis.exists(this.getKey(key));
      // Redis 작업 성공 - 연결 상태 업데이트
      this.connectionStatus.isConnected = true;
      this.connectionStatus.lastPingTime = new Date();
      return result === 1;
    } catch (error) {
      logger.error("Cache exists error:", error);
      this.connectionStatus.connectionErrors++;
      return false;
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    const redis = getRedisClient();
    if (!redis) {
      return 0;
    }

    try {
      const result = await redis.incrby(this.getKey(key), value);
      // Redis 작업 성공 - 연결 상태 업데이트
      this.connectionStatus.isConnected = true;
      this.connectionStatus.lastPingTime = new Date();
      return result;
    } catch (error) {
      logger.error("Cache increment error:", error);
      this.connectionStatus.connectionErrors++;
      return 0;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
      return;
    }

    try {
      await redis.expire(this.getKey(key), ttl);
      // Redis 작업 성공 - 연결 상태 업데이트
      this.connectionStatus.isConnected = true;
      this.connectionStatus.lastPingTime = new Date();
    } catch (error) {
      logger.error("Cache expire error:", error);
      this.connectionStatus.connectionErrors++;
    }
  }
}
