/**
 * Cache Default Constants
 *
 * 캐시 관련 기본값 상수 정의
 * 환경 변수가 설정되지 않았을 때 사용되는 폴백 값들
 */

// ============================================================================
// 시간 단위 상수 (초 단위)
// ============================================================================

/** 1분 (초) */
export const ONE_MINUTE = 60;

/** 5분 (초) */
export const FIVE_MINUTES = 300;

/** 10분 (초) */
export const TEN_MINUTES = 600;

/** 15분 (초) */
export const FIFTEEN_MINUTES = 900;

/** 30분 (초) */
export const THIRTY_MINUTES = 1800;

/** 1시간 (초) */
export const ONE_HOUR = 3600;

/** 24시간 (초) */
export const ONE_DAY = 86400;

/** 30일 (초) */
export const THIRTY_DAYS = 2592000;

// ============================================================================
// 인메모리 캐시 기본 설정
// ============================================================================

export const INMEMORY_CACHE_DEFAULTS = {
  /** 최대 캐시 항목 수 */
  MAX_SIZE: 100000,
  /** 최대 메모리 사용량 (MB) */
  MAX_MB: 200,
  /** 제거 정책: 'lru' | 'fifo' | 'ttl' */
  EVICTION: 'lru' as const,
  /** 정리 간격 (밀리초) */
  CLEANUP_INTERVAL: 60000,
} as const;

// ============================================================================
// 캐시 TTL 기본값 (초 단위)
// ============================================================================

export const CACHE_TTL_DEFAULTS = {
  /** 기본 TTL (1시간) */
  DEFAULT: ONE_HOUR,
  /** 짧은 TTL (5분) - 자주 변경되는 데이터 */
  SHORT: FIVE_MINUTES,
  /** 긴 TTL (24시간) - 거의 변경되지 않는 데이터 */
  LONG: ONE_DAY,
  /** GeoIP TTL (30일) - IP 위치 정보는 거의 변경되지 않음 */
  GEOIP: THIRTY_DAYS,
  /** 설정 TTL (1시간) */
  SETTINGS: ONE_HOUR,
  /** 분석 데이터 TTL (30분) */
  ANALYTICS: THIRTY_MINUTES,
  /** 사용자 데이터 TTL (30분) */
  USER: THIRTY_MINUTES,
} as const;

// ============================================================================
// 카테고리별 캐시 Duration 기본값 (초 단위)
// ============================================================================

export const CACHE_DURATION_DEFAULTS = {
  /** 분석 데이터 (30분) */
  ANALYTICS: THIRTY_MINUTES,
  /** 사용자 데이터 (10분) */
  USER: TEN_MINUTES,
  /** GeoIP 데이터 (30일) */
  GEOIP: THIRTY_DAYS,
  /** 설정 데이터 (30분) */
  SETTINGS: THIRTY_MINUTES,
  /** Rate Limit (1분) */
  RATE_LIMIT: ONE_MINUTE,
} as const;

// ============================================================================
// 환경 변수 이름 매핑
// ============================================================================

// ============================================================================
// 캐시 폴백 기본 설정
// ============================================================================

export const CACHE_FALLBACK_DEFAULTS = {
  /** 전역 Redis 에러 임계값 (이 값 이상이면 즉시 전역 비활성화) */
  REDIS_ERROR_THRESHOLD_GLOBAL: 1,
  /** 인스턴스별 Redis 에러 임계값 (이 값 이상이면 해당 인스턴스만 일시 비활성화) */
  REDIS_ERROR_THRESHOLD_LOCAL: 5,
  /** Redis 재연결 시도 간격 (밀리초) */
  REDIS_RECONNECT_INTERVAL: 30000,
  /** Redis 에러 시 인메모리 폴백 허용 여부 */
  FALLBACK_ON_REDIS_ERROR: true,
  /** hybrid 모드에서 인메모리에도 저장 여부 */
  WRITE_TO_MEMORY: true,
} as const;

// ============================================================================
// 캐시 건강상태 평가 기본 설정
// ============================================================================

export const CACHE_HEALTH_DEFAULTS = {
  /** 건강상태 판단: 에러율 임계값 (%) - 이 값 이상이면 unhealthy */
  ERROR_RATE_THRESHOLD: 10,
  /** 건강상태 판단: 히트율 임계값 (%) - 이 값 미만이면 unhealthy */
  HIT_RATE_THRESHOLD: 50,
  /** 성능 리포트: 권장 히트율 (%) - 이 값 미만이면 TTL 조정 권장 */
  REPORT_HIT_RATE_THRESHOLD: 70,
  /** 성능 리포트: 응답시간 임계값 (ms) - 이 값 초과 시 성능 확인 권장 */
  REPORT_RESPONSE_TIME_THRESHOLD: 500,
  /** 성능 리포트: 무효화 빈도 임계값 (/분) - 이 값 초과 시 최적화 권장 */
  REPORT_INVALIDATION_THRESHOLD: 100,
  /** 성능 리포트: 최소 요청 수 - 이 값 미만이면 리포트 판단 생략 */
  REPORT_MIN_REQUESTS: 100,
} as const;

// ============================================================================
// 환경 변수 이름 매핑
// ============================================================================

export const CACHE_ENV_VARS = {
  // 전역 설정
  CACHE_ENABLED: 'CACHE_ENABLED',
  CACHE_REDIS_ENABLED: 'CACHE_REDIS_ENABLED',
  CACHE_INMEMORY_ENABLED: 'CACHE_INMEMORY_ENABLED',

  // 인메모리 설정
  CACHE_INMEMORY_MAX_SIZE: 'CACHE_INMEMORY_MAX_SIZE',
  CACHE_INMEMORY_MAX_MB: 'CACHE_INMEMORY_MAX_MB',
  CACHE_INMEMORY_EVICTION: 'CACHE_INMEMORY_EVICTION',
  CACHE_INMEMORY_CLEANUP_INTERVAL: 'CACHE_INMEMORY_CLEANUP_INTERVAL',

  // Redis 설정
  REDIS_REST_URL: 'REDIS_REST_URL',
  REDIS_REST_TOKEN: 'REDIS_REST_TOKEN',

  // TTL 설정
  CACHE_TTL_DEFAULT: 'CACHE_TTL_DEFAULT',
  CACHE_TTL_SHORT: 'CACHE_TTL_SHORT',
  CACHE_TTL_LONG: 'CACHE_TTL_LONG',
  CACHE_TTL_GEOIP: 'CACHE_TTL_GEOIP',
  CACHE_TTL_SETTINGS: 'CACHE_TTL_SETTINGS',
  CACHE_TTL_ANALYTICS: 'CACHE_TTL_ANALYTICS',
  CACHE_TTL_USER: 'CACHE_TTL_USER',

  // 폴백 설정
  CACHE_REDIS_ERROR_THRESHOLD_GLOBAL: 'CACHE_REDIS_ERROR_THRESHOLD_GLOBAL',
  CACHE_REDIS_ERROR_THRESHOLD_LOCAL: 'CACHE_REDIS_ERROR_THRESHOLD_LOCAL',
  CACHE_REDIS_RECONNECT_INTERVAL: 'CACHE_REDIS_RECONNECT_INTERVAL',
  CACHE_FALLBACK_ON_REDIS_ERROR: 'CACHE_FALLBACK_ON_REDIS_ERROR',
  CACHE_WRITE_TO_MEMORY: 'CACHE_WRITE_TO_MEMORY',

  // 건강상태 평가 설정
  CACHE_HEALTH_ERROR_RATE_THRESHOLD: 'CACHE_HEALTH_ERROR_RATE_THRESHOLD',
  CACHE_HEALTH_HIT_RATE_THRESHOLD: 'CACHE_HEALTH_HIT_RATE_THRESHOLD',
  CACHE_REPORT_HIT_RATE_THRESHOLD: 'CACHE_REPORT_HIT_RATE_THRESHOLD',
  CACHE_REPORT_RESPONSE_TIME_THRESHOLD: 'CACHE_REPORT_RESPONSE_TIME_THRESHOLD',
  CACHE_REPORT_INVALIDATION_THRESHOLD: 'CACHE_REPORT_INVALIDATION_THRESHOLD',
  CACHE_REPORT_MIN_REQUESTS: 'CACHE_REPORT_MIN_REQUESTS',
} as const;
