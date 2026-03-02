/**
 * Cache Wrapper
 *
 * withCache 래퍼 함수 및 캐시 메트릭
 */
import { logger } from '@withwiz/logger/logger';
import { isCacheEnabled } from './cache-env';
import { getCacheConfig, getCacheTTL, CacheOptions } from './cache-config';
import { getCacheManager, getEffectiveCacheBackend } from './cache-factory';

// 캐시 백엔드 타입 약어 (R=Redis, M=Memory, H=Hybrid, N=Noop)
export function getCacheBackendLabel(): string {
  const backend = getEffectiveCacheBackend();
  switch (backend) {
    case 'redis': return 'R';
    case 'memory': return 'M';
    case 'hybrid': return 'H';
    default: return 'N';
  }
}

// ============================================================================
// Null 값 래핑 (캐시 미스와 null 값 구분을 위한 처리)
// ============================================================================

/** null 값을 캐시에 저장할 때 사용하는 래퍼 객체 */
const NULL_VALUE_WRAPPER = { __nullValue__: true } as const;

/** 래퍼 객체 타입 체크 */
function isNullValueWrapper(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__nullValue__' in value &&
    (value as Record<string, unknown>).__nullValue__ === true
  );
}

/** 저장 시: null → 래퍼 객체 */
function wrapNullValue<T>(value: T): T | typeof NULL_VALUE_WRAPPER {
  return value === null ? NULL_VALUE_WRAPPER : value;
}

/** 조회 시: 래퍼 객체 → null */
function unwrapNullValue<T>(value: T | typeof NULL_VALUE_WRAPPER): T | null {
  return isNullValueWrapper(value) ? null : (value as T);
}

// ============================================================================
// 캐시 래퍼 함수
// ============================================================================

/**
 * 캐시 래퍼 함수 (데이터베이스 쿼리 결과 캐싱)
 *
 * prefix 처리:
 * 1. prefix가 제공된 경우: 최종 키 = prefix:key
 *    예: withCache('recent-links:1:10', fn, { prefix: 'community' })
 *    → 캐시 키: community:recent-links:1:10
 *
 * 2. prefix가 없는 경우: 최종 키 = key (그대로 사용)
 *    예: withCache('community:recent-links:1:10', fn)
 *    → 캐시 키: community:recent-links:1:10
 */
export async function withCache<T>(
  key: string,
  fetchFunction: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const startTime = Date.now();
  const { ttl, prefix: inputPrefix } = options;

  // prefix 결정 및 실제 키 계산
  let cacheManagerPrefix: string;
  let actualKey: string;
  let fullKey: string;

  if (inputPrefix !== undefined) {
    // Case 1: prefix 제공됨 → prefix:key
    cacheManagerPrefix = inputPrefix;
    actualKey = key;
    fullKey = `${inputPrefix}:${key}`;
  } else {
    // Case 2: prefix 없음 → 키에서 첫 번째 부분을 prefix로 추출
    const colonIndex = key.indexOf(':');
    if (colonIndex > 0) {
      cacheManagerPrefix = key.substring(0, colonIndex);
      actualKey = key.substring(colonIndex + 1);
      fullKey = key; // 원본 키 그대로
    } else {
      // ':' 없으면 default 사용
      cacheManagerPrefix = 'default';
      actualKey = key;
      fullKey = `default:${key}`;
    }
  }

  const prefix = cacheManagerPrefix;

  // 새로운 통일된 캐시 설정에서 TTL 가져오기
  const cacheConfig = getCacheConfig[prefix as keyof typeof getCacheConfig];
  const finalTTL = ttl || (cacheConfig?.duration() || getCacheTTL.default());

  // 캐시가 비활성화된 경우 원본 함수만 실행
  if (cacheConfig && !cacheConfig.enabled()) {
    logger.debug(`withCache skipped due to cache disabled: ${fullKey}`, {
      key: actualKey,
      prefix,
      fullKey,
      cacheEnabled: cacheConfig.enabled()
    });
    return await fetchFunction();
  }

  // 기존 전역 캐시 설정 확인 (fallback)
  if (!isCacheEnabled()) {
    logger.debug(`withCache skipped due to global cache disabled: ${fullKey}`, {
      key: actualKey,
      prefix,
      fullKey,
      cacheEnabled: isCacheEnabled()
    });
    return await fetchFunction();
  }

  // cache-factory를 통해 적절한 캐시 매니저 인스턴스 가져오기
  // CACHE_REDIS_ENABLED=false이면 InMemoryCache 또는 NoopCacheManager 반환
  const cacheManager = getCacheManager(prefix);

  logger.debug(`withCache started: ${fullKey}`, {
    key: actualKey,
    prefix,
    fullKey,
    ttl: `${finalTTL}s`,
    timestamp: new Date().toISOString()
  });

  try {
    // 캐시에서 데이터 조회 시도 (actualKey 사용 - CacheManager가 prefix 추가)
    const cachedValue = await cacheManager.get<T | typeof NULL_VALUE_WRAPPER>(actualKey);

    // 캐시 히트: null이 아니면 캐시에 값이 있음 (null 래퍼 포함)
    if (cachedValue !== null) {
      const totalTime = Date.now() - startTime;
      const backendLabel = getCacheBackendLabel();
      const isNullCached = isNullValueWrapper(cachedValue);
      const unwrappedValue = unwrapNullValue(cachedValue) as T;

      logger.info(`[${backendLabel}] HIT ${fullKey} (${totalTime}ms)${isNullCached ? ' null' : ''}`);
      return unwrappedValue;
    }

    // 캐시 미스: 데이터베이스에서 조회
    logger.debug(`withCache [${getCacheBackendLabel()}] cache miss: ${fullKey}`, {
      key: actualKey,
      prefix,
      fullKey,
      ttl: `${finalTTL}s`
    });

    const freshValue = await fetchFunction();
    const fetchTime = Date.now() - startTime;

    // 새 데이터를 캐시에 저장 (null은 래퍼로 감싸서 저장)
    const valueToStore = wrapNullValue(freshValue);
    await cacheManager.set(actualKey, valueToStore, finalTTL);
    const totalTime = Date.now() - startTime;

    // 로그 출력
    const isNullValue = freshValue === null;
    const backendLabel = getCacheBackendLabel();
    const valueSize = JSON.stringify(valueToStore).length;
    logger.info(`[${backendLabel}] SET ${fullKey} (${fetchTime}ms, ${valueSize}B, ttl=${finalTTL}s)${isNullValue ? ' null' : ''}`);

    return freshValue;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    logger.error(`withCache execution failed: ${fullKey}`, {
      key: actualKey,
      prefix,
      fullKey,
      error: errorMessage,
      totalTime: `${totalTime}ms`,
      ttl: `${finalTTL}s`,
      stack: error instanceof Error ? error.stack : undefined
    });

    // 에러 발생 시에도 원본 함수 실행
    logger.warn(`withCache error occurred, executing original function: ${fullKey}`, {
      key: actualKey,
      prefix,
      fullKey,
      error: errorMessage
    });

    return await fetchFunction();
  }
}

// ============================================================================
// 캐시 성능 모니터링
// ============================================================================

/**
 * 캐시 성능 메트릭
 */
export const cacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  totalRequests: 0,
  averageResponseTime: 0,

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  },

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
    this.totalRequests = 0;
    this.averageResponseTime = 0;
  },
};
