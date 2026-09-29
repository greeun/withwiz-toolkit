/**
 * NoOp Cache Manager
 *
 * CACHE_ENABLED=false일 때 사용되는 비활성화된 캐시 매니저
 */
import { getENV } from '@withwiz/toolkit/core/cache/cache-env';
import { getCacheConfig } from '@withwiz/toolkit/core/cache/cache-config';
import type { IUnifiedCacheManager } from '@withwiz/toolkit/core/cache/cache-types';

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

  /**
   * 아무것도 저장하지 않고 항상 true 를 반환한다.
   *
   * 캐시가 꺼진 상태에서 토큰 저장소가 쓰던 기존 경로(exists → false 이므로 허용)와 같은
   * 결과다. false 를 반환하면 모든 refresh 회전이 재사용으로 판정되어 family 가 무효화되므로,
   * 캐시를 끈 배포에서 로그인 유지 자체가 불가능해진다. 캐시를 끄면 재사용 탐지도 꺼진다.
   */
  async setIfNotExists<T>(_key: string, _value: T, _ttl?: number): Promise<boolean> {
    return true;
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
        REDIS_REST_URL: ENV.REDIS.URL ? '설정됨' : '미설정',
        REDIS_REST_TOKEN: ENV.REDIS.TOKEN ? '설정됨' : '미설정'
      }
    };
  }
}
