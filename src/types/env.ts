/**
 * Shared Environment Configuration Types
 *
 * @deprecated Use types from '@withwiz/toolkit/initialize' and individual config modules instead.
 * These types are kept for backward compatibility and will be removed in 0.4.0.
 *
 * New config types:
 * - AuthConfig from '@withwiz/toolkit/auth/config'
 * - CacheConfigInput from '@withwiz/toolkit/cache/config'
 * - LoggerConfig from '@withwiz/toolkit/logger/config'
 * - StorageConfig from '@withwiz/toolkit/storage/config'
 * - GeolocationConfig from '@withwiz/toolkit/geolocation/config'
 * - CorsConfig from '@withwiz/toolkit/middleware/cors-config'
 * - ToolkitConfig from '@withwiz/toolkit/initialize'
 */

/**
 * Redis 환경 설정
 * @deprecated Use CacheConfigInput from '@withwiz/toolkit/cache/config' instead
 */
export interface IRedisEnv {
  URL?: string;
  TOKEN?: string;
  IS_AVAILABLE: boolean;
  /** Redis 캐시 사용 여부 (CACHE_REDIS_ENABLED) */
  ENABLED: boolean;
}

/**
 * 카테고리별 캐시 설정
 */
export interface ICacheCategoryConfig {
  ENABLED: boolean;
  DURATION: number;
}

/**
 * 캐시 TTL 설정
 */
export interface ICacheTTLConfig {
  DEFAULT: number;
  SHORT: number;
  LONG: number;
  GEOIP: number;
  SETTINGS: number;
  ANALYTICS: number;
  USER: number;
  LINK: number;
  ALIAS: number;
  COMMUNITY: number;
  RESERVED_WORDS: number;
}

/**
 * 캐시 백엔드 타입
 */
export type CacheBackendType = 'redis' | 'memory' | 'hybrid';

/**
 * 인메모리 캐시 환경 설정
 */
export interface IInMemoryCacheEnv {
  /** 인메모리 캐시 활성화 여부 */
  ENABLED: boolean;
  /** 최대 항목 수 */
  MAX_SIZE: number;
  /** 최대 메모리 (MB) */
  MAX_MB: number;
  /** 교체 정책: lru | fifo | ttl */
  EVICTION: 'lru' | 'fifo' | 'ttl';
  /** 만료 항목 정리 주기 (ms) */
  CLEANUP_INTERVAL: number;
}

/**
 * 캐시 환경 설정
 */
export interface ICacheEnv {
  ENABLED: boolean;
  /** Redis 캐시 설정 */
  REDIS: {
    /** Redis 캐시 사용 여부 (CACHE_REDIS_ENABLED) */
    ENABLED: boolean;
  };
  /** 인메모리 캐시 설정 */
  INMEMORY: IInMemoryCacheEnv;
  TTL: ICacheTTLConfig;
  ANALYTICS: ICacheCategoryConfig;
  USER: ICacheCategoryConfig;
  GEOIP: ICacheCategoryConfig;
  SETTINGS: ICacheCategoryConfig;
  RESERVED_WORDS: ICacheCategoryConfig;
  ALIAS: ICacheCategoryConfig;
  COMMUNITY: ICacheCategoryConfig;
  LINK: ICacheCategoryConfig;
  RATE_LIMIT: ICacheCategoryConfig;
  URL_TOKEN: ICacheCategoryConfig;
  API_KEY: ICacheCategoryConfig;
  API_CONFIG: ICacheCategoryConfig;
}

/**
 * Raw 환경 변수 인터페이스 (직접 접근용)
 */
export interface IRawEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  CACHE_ENABLED: boolean;
}

/**
 * Shared 모듈용 환경 설정 인터페이스
 */
export interface ISharedEnvConfig {
  env: IRawEnv;
  ENV: {
    REDIS: IRedisEnv;
    CACHE: ICacheEnv;
  };
  isCacheEnabled: () => boolean;
  isRedisAvailable: () => boolean;
}
