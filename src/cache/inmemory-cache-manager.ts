/**
 * In-Memory Cache Manager
 *
 * LRU + TTL 기반 인메모리 캐시 매니저
 * - LRU (Least Recently Used): 가장 오래 접근되지 않은 항목 제거
 * - TTL (Time To Live): 만료 시간 기반 항목 제거
 * - 메모리 제한: 최대 항목 수 및 메모리 크기 제한
 */

import { logger } from '@withwiz/logger/logger';
import type {
  InMemoryCacheConfig,
  CacheEntry,
  InMemoryCacheMetrics,
  InMemoryCacheStats,
  IUnifiedCacheManager,
} from './cache-types';
import { DEFAULT_INMEMORY_CONFIG } from './cache-types';

/**
 * 인메모리 캐시 매니저 클래스
 * RedisCacheManager와 동일한 인터페이스를 구현하여 호환성 보장
 */
export class InMemoryCacheManager implements IUnifiedCacheManager {
  private cache: Map<string, CacheEntry<unknown>>;
  private accessOrder: string[] = [];  // LRU 추적용
  private config: InMemoryCacheConfig;
  private currentMemoryBytes: number = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private metrics: InMemoryCacheMetrics;
  private prefix: string;

  constructor(prefix: string, config?: Partial<InMemoryCacheConfig>) {
    this.prefix = prefix;
    this.cache = new Map();
    this.config = { ...DEFAULT_INMEMORY_CONFIG, ...config };
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      totalRequests: 0,
      hitRate: 0,
    };

    // 정기적인 만료 항목 정리 시작
    this.startCleanupTimer();

    logger.debug('[InMemoryCache] Initialized', {
      prefix,
      maxSize: this.config.maxSize,
      maxMemoryMB: this.config.maxMemoryMB,
      evictionPolicy: this.config.evictionPolicy,
    });
  }

  // ============================================================================
  // Public Methods (CacheManager 인터페이스와 동일)
  // ============================================================================

  /**
   * 캐시에서 값 조회
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);
    this.metrics.totalRequests++;

    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.metrics.misses++;
      this.updateHitRate();
      logger.debug(`[Cache:M] miss: ${fullKey}`);
      return null;
    }

    // TTL 만료 체크
    if (this.isExpired(entry)) {
      this.deleteEntry(fullKey);
      this.metrics.misses++;
      this.metrics.expirations++;
      this.updateHitRate();
      logger.debug(`[Cache:M] miss (expired): ${fullKey}`);
      return null;
    }

    // LRU: 접근 순서 업데이트
    entry.accessedAt = Date.now();
    this.updateAccessOrder(fullKey);

    this.metrics.hits++;
    this.updateHitRate();

    logger.debug(`[Cache:M] hit: ${fullKey}`, {
      key: fullKey,
      prefix: this.prefix,
    });

    return entry.value as T;
  }

  /**
   * 캐시에 값 저장
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const actualTTL = ttl ?? this.config.defaultTTL;
    const size = this.estimateSize(value);

    // 용량 확보 (eviction)
    while (this.needsEviction(size)) {
      this.evict();
    }

    // 기존 항목이 있으면 메모리 사용량 조정
    const existingEntry = this.cache.get(fullKey);
    if (existingEntry) {
      this.currentMemoryBytes -= existingEntry.size;
      this.removeFromAccessOrder(fullKey);
    }

    // 새 항목 저장
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + actualTTL * 1000,
      size,
      accessedAt: now,
      createdAt: now,
    };

    this.cache.set(fullKey, entry);
    this.accessOrder.push(fullKey);
    this.currentMemoryBytes += size;
  }

  /**
   * 캐시에서 항목 삭제
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    this.deleteEntry(fullKey);

    logger.debug('[InMemoryCache] Cache deleted', {
      key: fullKey,
      prefix: this.prefix,
    });
  }

  /**
   * 패턴 매칭으로 캐시 삭제
   * 간단한 glob 패턴 지원 (* 와일드카드)
   */
  async deletePattern(pattern: string): Promise<void> {
    const fullPattern = this.getFullKey(pattern);
    const regex = this.patternToRegex(fullPattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.deleteEntry(key);
    }

    logger.debug('[InMemoryCache] Pattern deleted', {
      pattern: fullPattern,
      deletedCount: keysToDelete.length,
      prefix: this.prefix,
    });
  }

  /**
   * 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.deleteEntry(fullKey);
      return false;
    }

    return true;
  }

  /**
   * 값 증가 (카운터용)
   */
  async increment(key: string, value: number = 1): Promise<number> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    let currentValue = 0;

    if (entry && !this.isExpired(entry)) {
      currentValue = typeof entry.value === 'number' ? entry.value : 0;
    }

    const newValue = currentValue + value;
    await this.set(key, newValue);

    return newValue;
  }

  /**
   * TTL 설정/갱신
   */
  async expire(key: string, ttl: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (entry) {
      entry.expiresAt = Date.now() + ttl * 1000;
    }
  }

  /**
   * 전체 캐시 초기화
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentMemoryBytes = 0;

    logger.info('[InMemoryCache] Cache cleared', { prefix: this.prefix });
  }

  /**
   * 리소스 정리 (서버 종료 시 호출)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();

    logger.info('[InMemoryCache] Instance destroyed', { prefix: this.prefix });
  }

  // ============================================================================
  // Metrics & Stats
  // ============================================================================

  /**
   * 캐시 메트릭 조회
   */
  getMetrics(): InMemoryCacheMetrics {
    return { ...this.metrics };
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): InMemoryCacheStats {
    const memoryUsageMB = this.currentMemoryBytes / (1024 * 1024);
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;

    return {
      itemCount: this.cache.size,
      memoryUsageMB: Math.round(memoryUsageMB * 100) / 100,
      maxSize: this.config.maxSize,
      maxMemoryMB: this.config.maxMemoryMB,
      utilizationPercent: Math.round((this.cache.size / this.config.maxSize) * 100),
      memoryUtilizationPercent: Math.round((this.currentMemoryBytes / maxMemoryBytes) * 100),
    };
  }

  /**
   * 연결 상태 조회 (인메모리는 항상 연결됨)
   */
  getConnectionStatus(): object {
    return {
      isConnected: true,
      type: 'memory',
      prefix: this.prefix,
    };
  }

  /**
   * 연결 체크 (인메모리는 항상 true)
   */
  async checkConnection(): Promise<boolean> {
    return true;
  }

  /**
   * 설정 조회
   */
  getConfig(): InMemoryCacheConfig & { prefix: string } {
    return {
      ...this.config,
      prefix: this.prefix,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 전체 키 생성 (prefix 포함)
   */
  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * 항목 만료 여부 확인
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * 항목 삭제 (내부용)
   */
  private deleteEntry(fullKey: string): void {
    const entry = this.cache.get(fullKey);
    if (entry) {
      this.currentMemoryBytes -= entry.size;
      this.cache.delete(fullKey);
      this.removeFromAccessOrder(fullKey);
    }
  }

  /**
   * 메모리 크기 추정
   * JSON 직렬화 크기 * 2 (UTF-16) + 객체 오버헤드
   */
  private estimateSize(value: unknown): number {
    try {
      const jsonSize = JSON.stringify(value).length;
      return jsonSize * 2 + 100;  // UTF-16 + 객체 오버헤드
    } catch {
      return 200;  // 직렬화 실패 시 기본값
    }
  }

  /**
   * eviction 필요 여부 확인
   */
  private needsEviction(newItemSize: number): boolean {
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;

    return (
      this.cache.size >= this.config.maxSize ||
      this.currentMemoryBytes + newItemSize > maxMemoryBytes
    );
  }

  /**
   * 교체 정책에 따른 항목 제거
   */
  private evict(): void {
    if (this.cache.size === 0) {
      return;
    }

    // 1단계: 만료된 항목 먼저 제거
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.deleteEntry(key);
        this.metrics.evictions++;
        this.metrics.expirations++;
        return;
      }
    }

    // 2단계: 교체 정책에 따라 제거
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'fifo':
        this.evictFIFO();
        break;
      case 'ttl':
        this.evictTTL();
        break;
      default:
        this.evictLRU();
    }

    this.metrics.evictions++;
  }

  /**
   * LRU 교체: 가장 오래 접근되지 않은 항목 제거
   */
  private evictLRU(): void {
    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      this.deleteEntry(lruKey);

      logger.debug('[InMemoryCache] LRU eviction', {
        evictedKey: lruKey,
        prefix: this.prefix,
      });
    }
  }

  /**
   * FIFO 교체: 가장 먼저 들어온 항목 제거
   */
  private evictFIFO(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.deleteEntry(oldestKey);

      logger.debug('[InMemoryCache] FIFO eviction', {
        evictedKey: oldestKey,
        prefix: this.prefix,
      });
    }
  }

  /**
   * TTL 교체: 가장 빨리 만료될 항목 제거
   */
  private evictTTL(): void {
    let nearestExpiryKey: string | null = null;
    let nearestExpiryTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < nearestExpiryTime) {
        nearestExpiryTime = entry.expiresAt;
        nearestExpiryKey = key;
      }
    }

    if (nearestExpiryKey) {
      this.deleteEntry(nearestExpiryKey);

      logger.debug('[InMemoryCache] TTL eviction', {
        evictedKey: nearestExpiryKey,
        prefix: this.prefix,
      });
    }
  }

  /**
   * 접근 순서 업데이트 (LRU용)
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * 접근 순서에서 제거
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * 히트율 업데이트
   */
  private updateHitRate(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.hitRate =
        Math.round((this.metrics.hits / this.metrics.totalRequests) * 10000) / 100;
    }
  }

  /**
   * glob 패턴을 정규식으로 변환
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * 만료 항목 정리 타이머 시작
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);

    // Node.js에서 프로세스 종료를 막지 않도록 unref
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * 만료된 항목 일괄 정리
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.deleteEntry(key);
        this.metrics.expirations++;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('[InMemoryCache] Expired items cleaned', {
        cleanedCount,
        remainingCount: this.cache.size,
        prefix: this.prefix,
      });
    }
  }

  // ============================================================================
  // Static Factory (globalThis 사용으로 프로세스 레벨 싱글톤 보장)
  // ============================================================================

  /**
   * 전역 인스턴스 맵 가져오기 (HMR 안전)
   */
  private static getGlobalInstances(): Map<string, InMemoryCacheManager> {
    if (!(globalThis as any).__inMemoryCacheManagerInstances) {
      (globalThis as any).__inMemoryCacheManagerInstances = new Map<string, InMemoryCacheManager>();
    }
    return (globalThis as any).__inMemoryCacheManagerInstances;
  }

  /**
   * 싱글톤 인스턴스 가져오기
   */
  static getInstance(
    prefix: string,
    config?: Partial<InMemoryCacheConfig>
  ): InMemoryCacheManager {
    const instances = InMemoryCacheManager.getGlobalInstances();
    if (!instances.has(prefix)) {
      instances.set(prefix, new InMemoryCacheManager(prefix, config));
    }
    return instances.get(prefix)!;
  }

  /**
   * 모든 인스턴스 종료
   */
  static destroyAll(): void {
    const instances = InMemoryCacheManager.getGlobalInstances();
    for (const instance of instances.values()) {
      instance.destroy();
    }
    instances.clear();
  }

  /**
   * 인스턴스 초기화 (테스트용)
   */
  static clearInstances(): void {
    InMemoryCacheManager.getGlobalInstances().clear();
  }

  /**
   * 모든 인스턴스의 통계 조회
   */
  static getAllStats(): Record<string, InMemoryCacheStats> {
    const stats: Record<string, InMemoryCacheStats> = {};
    const instances = InMemoryCacheManager.getGlobalInstances();
    for (const [prefix, instance] of instances) {
      stats[prefix] = instance.getStats();
    }
    return stats;
  }
}
