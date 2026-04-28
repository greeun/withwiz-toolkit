/**
 * Redis Client Management
 *
 * Redis 클라이언트 초기화 및 연결 상태 관리
 * - 전역 Redis 에러 상태 관리 (싱글톤)
 * - 에러 발생 시 즉시 폴백 지원
 */
import { Redis } from '@upstash/redis';
import { logger } from '@withwiz/logger/logger';
import { getEnv, getConfig, isCacheEnabled, validateRedisEnvironment, getCacheFallbackConfig } from './cache-env';

// ============================================================================
// 전역 Redis 에러 상태 관리 (싱글톤)
// ============================================================================

/**
 * 전역 Redis 상태 인터페이스
 */
interface GlobalRedisState {
  /** Redis가 일시적으로 비활성화되었는지 여부 */
  isDisabled: boolean;
  /** 에러 발생 횟수 */
  errorCount: number;
  /** 마지막 에러 발생 시간 */
  lastErrorTime: Date | null;
  /** 마지막 에러 메시지 */
  lastErrorMessage: string | null;
  /** 재연결 타이머 ID */
  reconnectTimerId: ReturnType<typeof setTimeout> | null;
}

/**
 * 전역 Redis 상태 가져오기 (HMR 안전)
 */
function getGlobalRedisState(): GlobalRedisState {
  if (!(globalThis as any).__globalRedisState) {
    (globalThis as any).__globalRedisState = {
      isDisabled: false,
      errorCount: 0,
      lastErrorTime: null,
      lastErrorMessage: null,
      reconnectTimerId: null,
    };
  }
  return (globalThis as any).__globalRedisState;
}

/**
 * Redis 에러 임계값 가져오기 (환경변수 기반)
 */
function getRedisErrorThreshold(): number {
  return getCacheFallbackConfig().redisErrorThresholdGlobal;
}

/**
 * Redis 재연결 간격 가져오기 (환경변수 기반)
 */
function getRedisReconnectInterval(): number {
  return getCacheFallbackConfig().redisReconnectInterval;
}

/**
 * Redis가 전역적으로 비활성화되었는지 확인
 */
export function isRedisGloballyDisabled(): boolean {
  return getGlobalRedisState().isDisabled;
}

/**
 * Redis 에러 발생 시 호출 (전역 상태 업데이트)
 */
export function notifyRedisError(error: Error, source: string): void {
  const state = getGlobalRedisState();
  state.errorCount++;
  state.lastErrorTime = new Date();
  state.lastErrorMessage = error.message;

  const threshold = getRedisErrorThreshold();
  logger.warn('[Redis:Global] Redis error occurred', {
    source,
    errorCount: state.errorCount,
    threshold,
    error: error.message,
  });

  // 에러 임계값 도달 시 Redis 비활성화
  if (state.errorCount >= threshold && !state.isDisabled) {
    disableRedisGlobally();
  }
}

/**
 * Redis 전역 비활성화
 */
function disableRedisGlobally(): void {
  const state = getGlobalRedisState();

  if (state.isDisabled) {
    return;
  }

  state.isDisabled = true;

  const reconnectInterval = getRedisReconnectInterval();
  logger.warn('[Redis:Global] Redis globally disabled, falling back to in-memory cache', {
    errorCount: state.errorCount,
    lastError: state.lastErrorMessage,
    reconnectIn: `${reconnectInterval}ms`,
  });

  // 기존 타이머 정리
  if (state.reconnectTimerId) {
    clearTimeout(state.reconnectTimerId);
  }

  // 재연결 타이머 설정
  state.reconnectTimerId = setTimeout(() => {
    tryReconnectRedisGlobally();
  }, reconnectInterval);
}

/**
 * Redis 재연결 시도
 */
async function tryReconnectRedisGlobally(): Promise<void> {
  const state = getGlobalRedisState();

  logger.info('[Redis:Global] Attempting Redis reconnection...');

  try {
    const env = getEnv();
    if (!env.REDIS_REST_URL || !env.REDIS_REST_TOKEN) {
      scheduleNextReconnect();
      return;
    }

    const redis = new Redis({
      url: env.REDIS_REST_URL,
      token: env.REDIS_REST_TOKEN,
    });

    const pingResult = await redis.ping();

    if (pingResult === 'PONG') {
      resetRedisGlobalState();
      logger.info('[Redis:Global] Redis reconnection successful');
    } else {
      scheduleNextReconnect();
    }
  } catch (error) {
    logger.warn('[Redis:Global] Redis reconnection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    scheduleNextReconnect();
  }
}

/**
 * 다음 재연결 스케줄링
 */
function scheduleNextReconnect(): void {
  const state = getGlobalRedisState();

  if (state.reconnectTimerId) {
    clearTimeout(state.reconnectTimerId);
  }

  state.reconnectTimerId = setTimeout(() => {
    tryReconnectRedisGlobally();
  }, getRedisReconnectInterval());
}

/**
 * Redis 전역 상태 초기화 (재연결 성공 시)
 */
export function resetRedisGlobalState(): void {
  const state = getGlobalRedisState();

  if (state.errorCount > 0 || state.isDisabled) {
    logger.info('[Redis:Global] Redis global state reset', {
      previousErrorCount: state.errorCount,
      wasDisabled: state.isDisabled,
    });
  }

  state.isDisabled = false;
  state.errorCount = 0;
  state.lastErrorTime = null;
  state.lastErrorMessage = null;

  if (state.reconnectTimerId) {
    clearTimeout(state.reconnectTimerId);
    state.reconnectTimerId = null;
  }
}

/**
 * 전역 Redis 상태 조회
 */
export function getRedisGlobalStatus(): {
  isDisabled: boolean;
  errorCount: number;
  lastErrorTime: Date | null;
  lastErrorMessage: string | null;
} {
  const state = getGlobalRedisState();
  return {
    isDisabled: state.isDisabled,
    errorCount: state.errorCount,
    lastErrorTime: state.lastErrorTime,
    lastErrorMessage: state.lastErrorMessage,
  };
}

// ============================================================================
// Redis 연결 상태 인터페이스
// ============================================================================

/**
 * 캐시 메트릭 인터페이스
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
  averageResponseTime: number;
  lastError?: string;
  lastErrorTime?: Date;
}

/**
 * Redis 연결 상태 인터페이스
 */
export interface RedisConnectionStatus {
  isConnected: boolean;
  lastPingTime?: Date;
  connectionErrors: number;
  lastConnectionError?: string;
  lastConnectionErrorTime?: Date;
}

// ============================================================================
// Redis 연결 확인
// ============================================================================

/**
 * Redis 연결 상태 확인
 */
export async function checkRedisConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
  const startTime = Date.now();

  try {
    // CACHE_ENABLED=false인 경우 Redis 연결 체크 건너뛰기
    if (!isCacheEnabled()) {
      logger.info('[Redis:Cache] Redis connection check skipped: CACHE_ENABLED=false', {
        purpose: 'cache'
      });
      return {
        success: false,
        error: 'Redis cache is disabled (CACHE_ENABLED=false)',
        details: {
          purpose: 'cache',
          reason: 'CACHE_ENABLED=false',
          timestamp: new Date().toISOString()
        }
      };
    }

    // CACHE_REDIS_ENABLED=false인 경우 Redis 연결 체크 건너뛰기
    if (!getConfig().isRedisAvailable()) {
      logger.info('[Redis:Cache] Redis connection check skipped: CACHE_REDIS_ENABLED=false', {
        purpose: 'cache'
      });
      return {
        success: false,
        error: 'Redis backend is disabled (CACHE_REDIS_ENABLED=false)',
        details: {
          purpose: 'cache',
          reason: 'CACHE_REDIS_ENABLED=false',
          timestamp: new Date().toISOString()
        }
      };
    }

    // 환경 변수 검증
    const envValidation = validateRedisEnvironment();
    const env = getEnv();
    if (!envValidation.isValid) {
      const error = `Redis environment variable validation failed: ${envValidation.errors.join(', ')}`;
      logger.error('[Redis:Cache] Redis connection failed: Environment variable validation failed', {
        purpose: 'cache',
        errors: envValidation.errors,
        nodeEnv: env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
      return { success: false, error };
    }

    logger.info('[Redis:Cache] Redis connection status check started', {
      purpose: 'cache'
    });

    // 환경 변수 확인 - 더 엄격한 검증
    const redisUrl = env.REDIS_REST_URL;
    const redisToken = env.REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken || redisUrl.trim() === '' || redisToken.trim() === '') {
      const error = 'Redis environment variables are not configured.';
      logger.error('[Redis:Cache] Redis connection failed: Environment variables not set', {
        purpose: 'cache',
        redisUrl: !!redisUrl,
        redisToken: !!redisToken,
        redisUrlLength: redisUrl?.length || 0,
        redisTokenLength: redisToken?.length || 0,
        nodeEnv: env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
      return { success: false, error };
    }

    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    logger.info('[Redis:Cache] Redis client creation complete', {
      purpose: 'cache',
      url: redisUrl.substring(0, 50) + '...',
      tokenLength: redisToken.length
    });

    // PING 명령으로 연결 테스트
    const pingResult = await redis.ping();
    const responseTime = Date.now() - startTime;

    if (pingResult === 'PONG') {
      logger.info('[Redis:Cache] Redis connection successful', {
        purpose: 'cache',
        responseTime: `${responseTime}ms`,
        pingResult
      });
      return {
        success: true,
        details: {
          purpose: 'cache',
          responseTime,
          pingResult,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      const error = `Redis PING response differs from expected: ${pingResult}`;
      logger.error('[Redis:Cache] Redis connection failed: PING response error', {
        purpose: 'cache',
        expected: 'PONG',
        received: pingResult,
        responseTime: `${responseTime}ms`
      });
      return { success: false, error };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('[Redis:Cache] Redis connection failed: Exception occurred', {
      purpose: 'cache',
      error: errorMessage,
      responseTime: `${responseTime}ms`,
      stack: error instanceof Error ? error.stack : undefined,
      nodeEnv: getEnv().NODE_ENV,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error: errorMessage,
      details: {
        purpose: 'cache',
        responseTime,
        timestamp: new Date().toISOString(),
        errorType: error?.constructor?.name
      }
    };
  }
}

// ============================================================================
// Redis 클라이언트 관리
// ============================================================================

/**
 * Redis 연결 상태 확인 함수 (지연 평가)
 * - 전역 Redis 비활성화 상태도 확인
 */
export function isRedisAvailableNow(): boolean {
  // 전역적으로 Redis가 비활성화된 경우 false 반환
  if (isRedisGloballyDisabled()) {
    return false;
  }
  return isCacheEnabled() && getConfig().isRedisAvailable();
}

// Redis 클라이언트 (지연 초기화)
let _redisClient: Redis | null = null;
let _redisInitialized = false;

/**
 * Redis 클라이언트 가져오기 (지연 초기화)
 * - 전역 Redis 비활성화 상태 확인
 */
export function getRedisClient(): Redis | null {
  // 전역적으로 Redis가 비활성화된 경우 null 반환
  if (isRedisGloballyDisabled()) {
    return null;
  }

  if (_redisInitialized) {
    return _redisClient;
  }

  _redisInitialized = true;

  if (!isRedisAvailableNow()) {
    _redisClient = null;
    return null;
  }

  const env = getEnv();
  if (!env.REDIS_REST_URL || !env.REDIS_REST_TOKEN) {
    _redisClient = null;
    return null;
  }

  _redisClient = new Redis({
    url: env.REDIS_REST_URL,
    token: env.REDIS_REST_TOKEN,
  });

  return _redisClient;
}

/**
 * Redis 캐시 초기화 로그 (최초 1회, 지연 실행)
 */
export function logRedisInitialization(): void {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__redisCacheInitLogged) {
    return;
  }

  const redis = getRedisClient();
  const env = getEnv();

  if (isRedisAvailableNow() && redis) {
    logger.info('[Redis:Cache] Redis cache connection initialization complete', {
      purpose: 'cache',
      url: env.REDIS_REST_URL?.substring(0, 50) + '...',
      cacheEnabled: isCacheEnabled()
    });
  } else if (!isCacheEnabled()) {
    logger.info('[Redis:Cache] Redis cache disabled (CACHE_ENABLED=false)', {
      purpose: 'cache',
      cacheEnabled: false,
      redisUrlSet: !!env.REDIS_REST_URL,
      redisTokenSet: !!env.REDIS_REST_TOKEN
    });
  } else {
    logger.warn('[Redis:Cache] Cache disabled due to missing Redis environment variables', {
      purpose: 'cache',
      cacheEnabled: isCacheEnabled(),
      redisUrlSet: !!env.REDIS_REST_URL,
      redisTokenSet: !!env.REDIS_REST_TOKEN
    });
  }

  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__redisCacheInitLogged = true;
  }
}
