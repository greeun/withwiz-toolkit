/**
 * 인메모리 고정 윈도 Rate Limit 저장소
 *
 * 키별 요청 수를 윈도 만료 시각과 함께 보관한다. 항목 상한을 넘으면 만료가 가장 이른 항목부터 제거하고,
 * 주기적으로 만료 항목을 정리한다. 분산 저장소(Redis 등) 장애 시 폴백 용도로 쓴다.
 */
import { logger } from '@withwiz/toolkit/core/logger/logger';

export interface RateLimitResult {
  /** Rate limit 통과 여부 */
  success: boolean;
  /** 남은 요청 수 */
  remaining: number;
  /** 현재 사용 중인 요청 수 */
  current: number;
  /** Rate limit 초기화까지 남은 시간 (초) */
  resetIn: number;
}

export interface IInMemoryRateLimitStoreOptions {
  /** 보관할 최대 키 수. 넘으면 만료가 가장 이른 항목부터 제거한다. 기본 50,000 */
  maxEntries?: number;
  /** 만료 항목 정리 주기(ms). 기본 60,000 */
  cleanupIntervalMs?: number;
}

interface RateLimitEntry {
  count: number;
  expiresAt: number; // timestamp in ms
}

/**
 * 인메모리 Rate Limit 저장소
 * Redis 장애 시 폴백으로 사용
 */
export class InMemoryRateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly maxEntries: number;
  private readonly cleanupIntervalMs: number;

  // 메트릭
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    cleanups: 0,
  };

  constructor(options?: IInMemoryRateLimitStoreOptions) {
    this.maxEntries = options?.maxEntries ?? 50000; // 최대 5만 개 항목
    this.cleanupIntervalMs = options?.cleanupIntervalMs ?? 60000; // 60초마다 정리
    this.startCleanup();
  }

  /**
   * Rate limit 체크 및 증가
   */
  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    // 기존 항목이 있고 아직 만료되지 않은 경우
    if (entry && entry.expiresAt > now) {
      entry.count++;
      this.metrics.hits++;

      const resetIn = Math.ceil((entry.expiresAt - now) / 1000);
      const remaining = Math.max(0, limit - entry.count);
      const success = entry.count <= limit;

      return { success, remaining, current: entry.count, resetIn };
    }

    // 새 항목 생성 또는 만료된 항목 갱신
    this.metrics.misses++;

    // 메모리 제한 체크
    if (this.store.size >= this.maxEntries) {
      this.evictOldest();
    }

    const newEntry: RateLimitEntry = {
      count: 1,
      expiresAt: now + windowMs,
    };
    this.store.set(key, newEntry);

    return {
      success: true,
      remaining: limit - 1,
      current: 1,
      resetIn: Math.ceil(windowMs / 1000),
    };
  }

  /**
   * 특정 키 삭제
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * 특정 키 상태 조회
   */
  status(key: string, limit: number, windowSec: number): Omit<RateLimitResult, 'success'> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (entry && entry.expiresAt > now) {
      const resetIn = Math.ceil((entry.expiresAt - now) / 1000);
      const remaining = Math.max(0, limit - entry.count);
      return { remaining, current: entry.count, resetIn };
    }

    return { remaining: limit, current: 0, resetIn: windowSec };
  }

  /**
   * 가장 오래된 항목 제거 (LRU 대신 만료 시간 기준)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < oldestExpiry) {
        oldestExpiry = entry.expiresAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  /**
   * 만료된 항목 정리
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.metrics.cleanups++;
      logger.debug(`[InMemoryRateLimitStore] Cleaned up ${cleaned} expired entries`, {
        remaining: this.store.size,
      });
    }
  }

  /**
   * 정리 타이머 시작
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    // Node.js에서 프로세스 종료 방지하지 않도록 설정
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * 저장소 종료
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }

  /**
   * 메트릭 조회
   */
  getMetrics() {
    return {
      ...this.metrics,
      size: this.store.size,
      maxEntries: this.maxEntries,
    };
  }

  /**
   * 모든 항목 삭제
   */
  clear(): void {
    this.store.clear();
  }
}
