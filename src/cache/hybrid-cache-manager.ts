/**
 * Hybrid Cache Manager
 *
 * Redis + 인메모리 하이브리드 캐시 매니저
 * - Redis 우선 사용
 * - Redis 실패 시 인메모리 폴백
 * - 백엔드 모드에 따른 동적 전환
 * - 전역 Redis 에러 상태와 연동
 */

import { logger } from '@withwiz/logger/logger';
import { InMemoryCacheManager } from './inmemory-cache-manager';
import {
  isRedisGloballyDisabled,
  notifyRedisError,
  resetRedisGlobalState,
} from './cache-redis';
import { getCacheFallbackConfig } from './cache-env';
import type {
  CacheBackendType,
  HybridCacheMetrics,
  HybridConnectionStatus,
  IUnifiedCacheManager,
  InMemoryCacheConfig,
} from './cache-types';

/**
 * Redis 캐시 매니저 인터페이스 (RedisCacheManager와 호환)
 */
interface IRedisCacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  increment(key: string, value?: number): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  getMetrics(): object;
  getConnectionStatus(): object;
  checkConnection(): Promise<boolean>;
}

/**
 * 하이브리드 캐시 매니저 설정
 */
export interface HybridCacheManagerConfig {
  /** 캐시 백엔드 타입 */
  backend: CacheBackendType;
  /** Redis 매니저 인스턴스 (null이면 Redis 비활성화) */
  redisManager: IRedisCacheManager | null;
  /** 인메모리 캐시 설정 */
  inmemoryConfig?: Partial<InMemoryCacheConfig>;
  /** Redis 에러 시 인메모리 폴백 여부 */
  fallbackOnRedisError?: boolean;
  /** hybrid 모드에서 인메모리에도 저장 여부 */
  writeToMemory?: boolean;
  /** Redis 에러 임계값 (이 값 이상이면 일시적으로 Redis 비활성화) */
  redisErrorThreshold?: number;
  /** Redis 재연결 시도 간격 (ms) */
  redisReconnectInterval?: number;
}

/**
 * 기본 설정 가져오기 (환경변수 기반)
 */
function getDefaultHybridConfig(): Required<Omit<HybridCacheManagerConfig, 'redisManager' | 'inmemoryConfig'>> {
  const fallbackConfig = getCacheFallbackConfig();
  return {
    backend: 'hybrid',
    fallbackOnRedisError: fallbackConfig.fallbackOnRedisError,
    writeToMemory: fallbackConfig.writeToMemory,
    redisErrorThreshold: fallbackConfig.redisErrorThresholdLocal,
    redisReconnectInterval: fallbackConfig.redisReconnectInterval,
  };
}

/**
 * 하이브리드 캐시 매니저
 */
export class HybridCacheManager implements IUnifiedCacheManager {
  private prefix: string;
  private config: Required<Omit<HybridCacheManagerConfig, 'inmemoryConfig'>> & {
    inmemoryConfig?: Partial<InMemoryCacheConfig>;
  };
  private redisManager: IRedisCacheManager | null;
  private memoryCache: InMemoryCacheManager;

  // Redis 상태 추적
  private redisErrorCount: number = 0;
  private lastRedisError: Date | null = null;
  private lastRedisErrorMessage: string | null = null;
  private isRedisTemporarilyDisabled: boolean = false;
  private redisReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // 메트릭
  private redisFallbackCount: number = 0;

  constructor(prefix: string, config: HybridCacheManagerConfig) {
    this.prefix = prefix;
    this.config = { ...getDefaultHybridConfig(), ...config };
    this.redisManager = config.redisManager;
    this.memoryCache = InMemoryCacheManager.getInstance(prefix, config.inmemoryConfig);

    logger.info(`[HybridCacheManager] Initialized: prefix=${prefix}, backend=${this.config.backend}, redis=${this.redisManager ? 'Y' : 'N'}`);
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * 캐시에서 값 조회
   */
  async get<T>(key: string): Promise<T | null> {
    const effectiveBackend = this.getEffectiveBackend();

    // memory 모드: 인메모리만 사용
    if (effectiveBackend === 'memory') {
      return this.memoryCache.get<T>(key);
    }

    // redis 또는 hybrid 모드: Redis 먼저 시도
    if (this.redisManager && !this.isRedisTemporarilyDisabled) {
      try {
        const result = await this.redisManager.get<T>(key);
        if (result !== null) {
          this.resetRedisErrorState();
          return result;
        }
      } catch (error) {
        this.handleRedisError(error as Error, 'get');

        // hybrid 모드에서 폴백 허용 시 인메모리에서 조회
        if (effectiveBackend === 'hybrid' && this.config.fallbackOnRedisError) {
          this.redisFallbackCount++;
          return this.memoryCache.get<T>(key);
        }
      }
    }

    // hybrid 모드: Redis 미스 시 인메모리에서 조회
    if (effectiveBackend === 'hybrid') {
      return this.memoryCache.get<T>(key);
    }

    return null;
  }

  /**
   * 캐시에 값 저장
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveBackend = this.getEffectiveBackend();

    // memory 모드: 인메모리만 저장
    if (effectiveBackend === 'memory') {
      await this.memoryCache.set(key, value, ttl);
      return;
    }

    // redis 모드: Redis에만 저장
    if (effectiveBackend === 'redis') {
      if (this.redisManager && !this.isRedisTemporarilyDisabled) {
        try {
          await this.redisManager.set(key, value, ttl);
          this.resetRedisErrorState();
        } catch (error) {
          this.handleRedisError(error as Error, 'set');
        }
      }
      return;
    }

    // hybrid 모드: 둘 다 저장 시도
    const promises: Promise<void>[] = [];

    // Redis 저장 시도
    if (this.redisManager && !this.isRedisTemporarilyDisabled) {
      promises.push(
        this.redisManager.set(key, value, ttl)
          .then(() => this.resetRedisErrorState())
          .catch((error: Error) => {
            this.handleRedisError(error, 'set');
          })
      );
    }

    // 인메모리 저장 (항상 또는 Redis 실패 시)
    if (this.config.writeToMemory || this.isRedisTemporarilyDisabled) {
      promises.push(this.memoryCache.set(key, value, ttl));
    }

    await Promise.allSettled(promises);
  }

  /**
   * 캐시에서 항목 삭제
   */
  async delete(key: string): Promise<void> {
    const effectiveBackend = this.getEffectiveBackend();
    const promises: Promise<void>[] = [];

    // Redis 삭제
    if (effectiveBackend !== 'memory' && this.redisManager && !this.isRedisTemporarilyDisabled) {
      promises.push(
        this.redisManager.delete(key).catch((error: Error) => {
          this.handleRedisError(error, 'delete');
        })
      );
    }

    // 인메모리 삭제 (memory 또는 hybrid 모드)
    if (effectiveBackend !== 'redis') {
      promises.push(this.memoryCache.delete(key));
    }

    await Promise.allSettled(promises);
  }

  /**
   * 패턴 매칭으로 캐시 삭제
   */
  async deletePattern(pattern: string): Promise<void> {
    const effectiveBackend = this.getEffectiveBackend();
    const promises: Promise<void>[] = [];

    // Redis 패턴 삭제
    if (effectiveBackend !== 'memory' && this.redisManager && !this.isRedisTemporarilyDisabled) {
      promises.push(
        this.redisManager.deletePattern(pattern).catch((error: Error) => {
          this.handleRedisError(error, 'deletePattern');
        })
      );
    }

    // 인메모리 패턴 삭제
    if (effectiveBackend !== 'redis') {
      promises.push(this.memoryCache.deletePattern(pattern));
    }

    await Promise.allSettled(promises);
  }

  /**
   * 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    const effectiveBackend = this.getEffectiveBackend();

    if (effectiveBackend === 'memory') {
      return this.memoryCache.exists(key);
    }

    if (this.redisManager && !this.isRedisTemporarilyDisabled) {
      try {
        const exists = await this.redisManager.exists(key);
        if (exists) {
          this.resetRedisErrorState();
          return true;
        }
      } catch (error) {
        this.handleRedisError(error as Error, 'exists');
      }
    }

    // hybrid 모드: 인메모리도 확인
    if (effectiveBackend === 'hybrid') {
      return this.memoryCache.exists(key);
    }

    return false;
  }

  /**
   * 값 증가
   */
  async increment(key: string, value: number = 1): Promise<number> {
    const effectiveBackend = this.getEffectiveBackend();

    if (effectiveBackend === 'memory') {
      return this.memoryCache.increment(key, value);
    }

    if (this.redisManager && !this.isRedisTemporarilyDisabled) {
      try {
        const result = await this.redisManager.increment(key, value);
        this.resetRedisErrorState();
        return result;
      } catch (error) {
        this.handleRedisError(error as Error, 'increment');
      }
    }

    // 폴백
    if (effectiveBackend === 'hybrid' && this.config.fallbackOnRedisError) {
      return this.memoryCache.increment(key, value);
    }

    return 0;
  }

  /**
   * TTL 설정
   */
  async expire(key: string, ttl: number): Promise<void> {
    const effectiveBackend = this.getEffectiveBackend();
    const promises: Promise<void>[] = [];

    if (effectiveBackend !== 'memory' && this.redisManager && !this.isRedisTemporarilyDisabled) {
      promises.push(
        this.redisManager.expire(key, ttl).catch((error: Error) => {
          this.handleRedisError(error, 'expire');
        })
      );
    }

    if (effectiveBackend !== 'redis') {
      promises.push(this.memoryCache.expire(key, ttl));
    }

    await Promise.allSettled(promises);
  }

  // ============================================================================
  // Metrics & Status
  // ============================================================================

  /**
   * 하이브리드 캐시 메트릭 조회
   */
  getMetrics(): HybridCacheMetrics {
    const memoryMetrics = this.memoryCache.getMetrics();
    let redisMetrics: HybridCacheMetrics['redis'] = null;

    if (this.redisManager) {
      const raw = this.redisManager.getMetrics() as {
        hits?: number;
        misses?: number;
        errors?: number;
        totalRequests?: number;
        hitRate?: number;
        averageResponseTime?: number;
      };
      redisMetrics = {
        hits: raw.hits ?? 0,
        misses: raw.misses ?? 0,
        errors: raw.errors ?? 0,
        totalRequests: raw.totalRequests ?? 0,
        hitRate: raw.hitRate ?? 0,
        averageResponseTime: raw.averageResponseTime ?? 0,
      };
    }

    const totalHits = (redisMetrics?.hits ?? 0) + memoryMetrics.hits;
    const totalMisses = (redisMetrics?.misses ?? 0) + memoryMetrics.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      redis: redisMetrics,
      memory: memoryMetrics,
      combined: {
        totalHits,
        totalMisses,
        redisFallbacks: this.redisFallbackCount,
        hitRate: totalRequests > 0 ? Math.round((totalHits / totalRequests) * 10000) / 100 : 0,
      },
    };
  }

  /**
   * 연결 상태 조회
   */
  getConnectionStatus(): HybridConnectionStatus {
    const isGloballyDisabled = isRedisGloballyDisabled();
    return {
      redisConnected: !!this.redisManager && !this.isRedisTemporarilyDisabled && !isGloballyDisabled,
      memoryActive: true,
      currentBackend: this.getEffectiveBackend(),
      redisErrorCount: this.redisErrorCount,
      lastRedisError: this.lastRedisError,
      lastRedisErrorMessage: this.lastRedisErrorMessage,
      redisGloballyDisabled: isGloballyDisabled,
    };
  }

  /**
   * 연결 체크
   */
  async checkConnection(): Promise<boolean> {
    const effectiveBackend = this.getEffectiveBackend();

    if (effectiveBackend === 'memory') {
      return true;
    }

    if (this.redisManager) {
      try {
        const connected = await this.redisManager.checkConnection();
        if (connected) {
          this.resetRedisErrorState();
          return true;
        }
      } catch {
        // Redis 연결 실패
      }
    }

    // hybrid 모드에서는 인메모리라도 있으면 true
    return effectiveBackend === 'hybrid';
  }

  /**
   * 설정 조회
   */
  getConfig(): object {
    return {
      prefix: this.prefix,
      backend: this.config.backend,
      effectiveBackend: this.getEffectiveBackend(),
      fallbackOnRedisError: this.config.fallbackOnRedisError,
      writeToMemory: this.config.writeToMemory,
      redisAvailable: !!this.redisManager,
      isRedisTemporarilyDisabled: this.isRedisTemporarilyDisabled,
      memoryConfig: this.memoryCache.getConfig(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 실제 사용할 백엔드 결정
   * - 전역 Redis 비활성화 상태도 확인
   */
  private getEffectiveBackend(): CacheBackendType {
    // 설정된 백엔드가 memory면 항상 memory
    if (this.config.backend === 'memory') {
      return 'memory';
    }

    // 전역적으로 Redis가 비활성화된 경우 또는 로컬 비활성화 상태
    const isRedisDisabled = isRedisGloballyDisabled() || this.isRedisTemporarilyDisabled;

    // Redis가 없거나 비활성화 상태
    if (!this.redisManager || isRedisDisabled) {
      // hybrid 모드에서는 memory로 폴백
      if (this.config.backend === 'hybrid') {
        return 'memory';
      }
      // redis 모드에서 Redis 없으면 사실상 캐시 없음
      return 'redis';
    }

    return this.config.backend;
  }

  /**
   * Redis 에러 처리
   * - 전역 Redis 상태도 함께 업데이트
   */
  private handleRedisError(error: Error, operation: string): void {
    this.redisErrorCount++;
    this.lastRedisError = new Date();
    this.lastRedisErrorMessage = error.message;

    // 전역 Redis 에러 상태 업데이트 (다른 캐시 인스턴스에도 전파)
    notifyRedisError(error, `HybridCacheManager.${operation}:${this.prefix}`);

    logger.warn('[HybridCacheManager] Redis error', {
      prefix: this.prefix,
      operation,
      error: error.message,
      errorCount: this.redisErrorCount,
      threshold: this.config.redisErrorThreshold,
      globallyDisabled: isRedisGloballyDisabled(),
    });

    // 에러 임계값 초과 시 일시적으로 Redis 비활성화 (로컬 상태)
    if (this.redisErrorCount >= this.config.redisErrorThreshold) {
      this.disableRedisTemporarily();
    }
  }

  /**
   * Redis 일시 비활성화
   */
  private disableRedisTemporarily(): void {
    if (this.isRedisTemporarilyDisabled) {
      return;
    }

    this.isRedisTemporarilyDisabled = true;

    logger.warn('[HybridCacheManager] Redis temporarily disabled', {
      prefix: this.prefix,
      errorCount: this.redisErrorCount,
      reconnectIn: this.config.redisReconnectInterval,
    });

    // 재연결 타이머 설정
    this.redisReconnectTimer = setTimeout(() => {
      this.tryReconnectRedis();
    }, this.config.redisReconnectInterval);
  }

  /**
   * Redis 재연결 시도
   */
  private async tryReconnectRedis(): Promise<void> {
    if (!this.redisManager) {
      return;
    }

    logger.info('[HybridCacheManager] Redis reconnection attempt', { prefix: this.prefix });

    try {
      const connected = await this.redisManager.checkConnection();
      if (connected) {
        this.resetRedisErrorState();
        logger.info('[HybridCacheManager] Redis reconnection successful', { prefix: this.prefix });
      } else {
        // 다시 타이머 설정
        this.redisReconnectTimer = setTimeout(() => {
          this.tryReconnectRedis();
        }, this.config.redisReconnectInterval);
      }
    } catch {
      // 재연결 실패, 다시 타이머 설정
      this.redisReconnectTimer = setTimeout(() => {
        this.tryReconnectRedis();
      }, this.config.redisReconnectInterval);
    }
  }

  /**
   * Redis 에러 상태 초기화 (로컬 상태만)
   * - 전역 상태는 cache-redis.ts에서 관리 (Redis 성공 시 자동 리셋)
   */
  private resetRedisErrorState(): void {
    if (this.redisErrorCount > 0 || this.isRedisTemporarilyDisabled) {
      logger.debug('[HybridCacheManager] Redis local error state reset', {
        prefix: this.prefix,
        previousErrorCount: this.redisErrorCount,
      });
    }

    this.redisErrorCount = 0;
    this.isRedisTemporarilyDisabled = false;

    if (this.redisReconnectTimer) {
      clearTimeout(this.redisReconnectTimer);
      this.redisReconnectTimer = null;
    }
    // 전역 상태는 여기서 리셋하지 않음 - Redis가 실제로 성공해야 리셋됨
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    if (this.redisReconnectTimer) {
      clearTimeout(this.redisReconnectTimer);
      this.redisReconnectTimer = null;
    }
    // memoryCache는 InMemoryCacheManager.destroyAll()로 정리

    logger.info('[HybridCacheManager] Instance destroyed', { prefix: this.prefix });
  }

  // ============================================================================
  // Static Factory (globalThis 사용으로 프로세스 레벨 싱글톤 보장)
  // ============================================================================

  /**
   * 전역 인스턴스 맵 가져오기 (HMR 안전)
   */
  private static getGlobalInstances(): Map<string, HybridCacheManager> {
    if (!(globalThis as any).__hybridCacheInstances) {
      (globalThis as any).__hybridCacheInstances = new Map<string, HybridCacheManager>();
    }
    return (globalThis as any).__hybridCacheInstances;
  }

  /**
   * 싱글톤 인스턴스 가져오기
   */
  static getInstance(
    prefix: string,
    config: HybridCacheManagerConfig
  ): HybridCacheManager {
    const instances = HybridCacheManager.getGlobalInstances();
    if (!instances.has(prefix)) {
      instances.set(prefix, new HybridCacheManager(prefix, config));
    }
    return instances.get(prefix)!;
  }

  /**
   * 모든 인스턴스 종료
   */
  static destroyAll(): void {
    const instances = HybridCacheManager.getGlobalInstances();
    for (const instance of instances.values()) {
      instance.destroy();
    }
    instances.clear();
    InMemoryCacheManager.destroyAll();
  }

  /**
   * 인스턴스 초기화 (테스트용)
   */
  static clearInstances(): void {
    HybridCacheManager.getGlobalInstances().clear();
  }
}
