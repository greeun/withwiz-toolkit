/**
 * In-Memory Cache Types
 *
 * 인메모리 캐시 관련 타입 정의
 */

// ============================================================================
// 인메모리 캐시 설정
// ============================================================================

/**
 * 인메모리 캐시 설정 인터페이스
 */
export interface InMemoryCacheConfig {
  /** 최대 항목 수 (기본: 100,000) */
  maxSize: number;
  /** 최대 메모리 MB (기본: 200) */
  maxMemoryMB: number;
  /** 교체 정책: lru | fifo | ttl */
  evictionPolicy: 'lru' | 'fifo' | 'ttl';
  /** 만료 항목 정리 주기 (ms, 기본: 60000) */
  cleanupInterval: number;
  /** 기본 TTL (초, 기본: 3600) */
  defaultTTL: number;
}

/**
 * 인메모리 캐시 설정 기본값
 */
export const DEFAULT_INMEMORY_CONFIG: InMemoryCacheConfig = {
  maxSize: 100_000,
  maxMemoryMB: 200,
  evictionPolicy: 'lru',
  cleanupInterval: 60_000,
  defaultTTL: 3600,
};

// ============================================================================
// 캐시 엔트리
// ============================================================================

/**
 * 캐시 엔트리 인터페이스
 */
export interface CacheEntry<T> {
  /** 저장된 값 */
  value: T;
  /** 만료 시간 (Unix timestamp, ms) */
  expiresAt: number;
  /** 추정 메모리 크기 (bytes) */
  size: number;
  /** 마지막 접근 시간 (LRU용, Unix timestamp, ms) */
  accessedAt: number;
  /** 생성 시간 (FIFO용, Unix timestamp, ms) */
  createdAt: number;
}

// ============================================================================
// 캐시 메트릭
// ============================================================================

/**
 * 인메모리 캐시 메트릭
 */
export interface InMemoryCacheMetrics {
  /** 캐시 히트 수 */
  hits: number;
  /** 캐시 미스 수 */
  misses: number;
  /** 교체로 인한 제거 수 */
  evictions: number;
  /** TTL 만료로 인한 제거 수 */
  expirations: number;
  /** 총 요청 수 */
  totalRequests: number;
  /** 히트율 (%) */
  hitRate: number;
}

/**
 * 인메모리 캐시 통계
 */
export interface InMemoryCacheStats {
  /** 현재 항목 수 */
  itemCount: number;
  /** 현재 메모리 사용량 (MB) */
  memoryUsageMB: number;
  /** 최대 항목 수 */
  maxSize: number;
  /** 최대 메모리 (MB) */
  maxMemoryMB: number;
  /** 사용률 (%) */
  utilizationPercent: number;
  /** 메모리 사용률 (%) */
  memoryUtilizationPercent: number;
}

// ============================================================================
// 하이브리드 캐시 설정
// ============================================================================

/**
 * 캐시 백엔드 타입
 */
export type CacheBackendType = 'redis' | 'memory' | 'hybrid';

/**
 * 하이브리드 캐시 설정
 */
export interface HybridCacheConfig {
  /** 백엔드 타입 */
  backend: CacheBackendType;
  /** Redis 에러 시 인메모리 폴백 여부 */
  fallbackOnRedisError: boolean;
  /** Redis 실패 시 인메모리에 저장 여부 */
  writeToMemoryOnRedisError: boolean;
  /** 인메모리 캐시 설정 */
  inmemory: InMemoryCacheConfig;
}

/**
 * 하이브리드 캐시 설정 기본값
 */
export const DEFAULT_HYBRID_CONFIG: HybridCacheConfig = {
  backend: 'hybrid',
  fallbackOnRedisError: true,
  writeToMemoryOnRedisError: true,
  inmemory: DEFAULT_INMEMORY_CONFIG,
};

// ============================================================================
// 하이브리드 캐시 메트릭
// ============================================================================

/**
 * 하이브리드 캐시 메트릭
 */
export interface HybridCacheMetrics {
  /** Redis 캐시 메트릭 (null이면 Redis 비활성화) */
  redis: {
    hits: number;
    misses: number;
    errors: number;
    totalRequests: number;
    hitRate: number;
    averageResponseTime: number;
  } | null;
  /** 인메모리 캐시 메트릭 */
  memory: InMemoryCacheMetrics;
  /** 통합 메트릭 */
  combined: {
    totalHits: number;
    totalMisses: number;
    /** Redis 실패로 인메모리 폴백한 횟수 */
    redisFallbacks: number;
    hitRate: number;
  };
}

/**
 * 하이브리드 캐시 연결 상태
 */
export interface HybridConnectionStatus {
  /** Redis 연결 상태 */
  redisConnected: boolean;
  /** 인메모리 캐시 활성화 여부 */
  memoryActive: boolean;
  /** 현재 사용 중인 백엔드 */
  currentBackend: CacheBackendType;
  /** Redis 에러 카운트 */
  redisErrorCount: number;
  /** 마지막 Redis 에러 시간 */
  lastRedisError: Date | null;
  /** 마지막 Redis 에러 메시지 */
  lastRedisErrorMessage: string | null;
  /** Redis가 전역적으로 비활성화되었는지 여부 */
  redisGloballyDisabled?: boolean;
}

// ============================================================================
// 통합 캐시 매니저 인터페이스
// ============================================================================

/**
 * 통합 캐시 매니저 인터페이스
 * CacheManager, HybridCacheManager, InMemoryCache 모두 이 인터페이스를 구현
 */
export interface IUnifiedCacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getMetrics(): InMemoryCacheMetrics | HybridCacheMetrics | object;
  getConnectionStatus(): HybridConnectionStatus | object;
  checkConnection(): Promise<boolean>;
}
