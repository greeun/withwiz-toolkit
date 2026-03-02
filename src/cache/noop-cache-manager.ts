/**
 * NoOp Cache Manager
 *
 * CACHE_ENABLED=false일 때 사용되는 비활성화된 캐시 매니저
 */
import { getENV } from './cache-env';
import { getCacheConfig } from './cache-config';
import type { IUnifiedCacheManager } from './cache-types';

// ============================================================================
// NoopCacheManager 클래스
// ============================================================================

export class NoopCacheManager implements IUnifiedCacheManager {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T>(_key: string, _value: T, _ttl?: number): Promise<void> {
    // 아무것도 하지 않음
  }

  async delete(_key: string): Promise<void> {
    // 아무것도 하지 않음
  }

  async deletePattern(_pattern: string): Promise<void> {
    // 아무것도 하지 않음
  }

  async exists(_key: string): Promise<boolean> {
    return false;
  }

  async increment(): Promise<number> {
    return 0;
  }

  async expire(): Promise<void> {
    // 아무것도 하지 않음
  }

  getMetrics() {
    return {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      hitRate: 0,
      averageResponseTime: 0
    };
  }

  getConnectionStatus() {
    return {
      isConnected: false,
      connectionErrors: 0
    };
  }

  async checkConnection(): Promise<boolean> {
    // NoopCacheManager는 항상 연결되지 않음
    return false;
  }

  getConfig() {
    // 해당 prefix의 캐시 설정 확인
    const cacheConfig = getCacheConfig[this.prefix as keyof typeof getCacheConfig];
    const envVarName = `CACHE_${this.prefix.toUpperCase()}_ENABLED`;
    const ENV = getENV();

    return {
      prefix: this.prefix,
      enabled: false,
      reason: cacheConfig && !cacheConfig.enabled()
        ? '환경 변수로 비활성화됨'
        : '전역 캐시 비활성화됨',
      envVars: {
        CACHE_ENABLED: ENV.CACHE.ENABLED ? 'true' : 'false',
        [envVarName]: 'disabled',
        UPSTASH_REDIS_REST_URL: ENV.REDIS.URL ? '설정됨' : '미설정',
        UPSTASH_REDIS_REST_TOKEN: ENV.REDIS.TOKEN ? '설정됨' : '미설정'
      }
    };
  }
}
