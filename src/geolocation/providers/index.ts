/**
 * GeoIP Providers
 *
 * 프로젝트 독립적인 GeoIP 제공자 모듈
 * - 순수 HTTP 클라이언트
 * - 외부 의존성 없음
 */
import type { IGeoIPProvider } from '@withwiz/types/geoip';
import { IPApiProvider } from './ip-api-provider';
import { IPApiCoProvider } from './ipapi-co-provider';
import { IPGeolocationProvider } from './ipgeolocation-provider';
import { MaxMindProvider } from './maxmind-provider';

// Re-exports
export { BaseGeoIPProvider, truncateString } from './base-provider';
export { IPApiProvider } from './ip-api-provider';
export { IPApiCoProvider } from './ipapi-co-provider';
export { IPGeolocationProvider } from './ipgeolocation-provider';
export { MaxMindProvider } from './maxmind-provider';

/**
 * GeoIP 제공자 팩토리
 * 제공자들을 관리하고 적절한 제공자를 선택
 * - 프로젝트 독립적
 */
export class GeoIPProviderFactory {
  private static providers: IGeoIPProvider[] = [
    new IPApiProvider(),
    new IPApiCoProvider(),
    new IPGeolocationProvider(),
    new MaxMindProvider(),
  ];

  /**
   * 사용 가능한 제공자 목록 반환
   */
  static getAvailableProviders(): IGeoIPProvider[] {
    return this.providers.filter(provider => provider.isAvailable());
  }

  /**
   * 이름으로 제공자 찾기
   */
  static getProvider(name: string): IGeoIPProvider | null {
    return this.providers.find(provider => provider.name === name) || null;
  }

  /**
   * 모든 제공자 목록 반환
   */
  static getAllProviders(): IGeoIPProvider[] {
    return [...this.providers];
  }

  /**
   * 제공자별 성능 통계
   */
  static getProviderStats(): Array<{
    name: string;
    available: boolean;
    rateLimit: number;
    timeout: number;
  }> {
    return this.providers.map(provider => ({
      name: provider.name,
      available: provider.isAvailable(),
      rateLimit: provider.getRateLimit(),
      timeout: provider.getTimeout()
    }));
  }

  /**
   * 최적의 제공자 선택 (성능 기준)
   */
  static getOptimalProvider(): IGeoIPProvider | null {
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length === 0) return null;

    // 타임아웃이 짧고 레이트 리미트가 높은 순으로 정렬
    return availableProviders.sort((a, b) => {
      const scoreA = a.getRateLimit() / a.getTimeout();
      const scoreB = b.getRateLimit() / b.getTimeout();
      return scoreB - scoreA;
    })[0];
  }

  /**
   * 제공자 등록
   */
  static registerProvider(provider: IGeoIPProvider): void {
    const existingIndex = this.providers.findIndex(p => p.name === provider.name);
    if (existingIndex >= 0) {
      this.providers[existingIndex] = provider;
    } else {
      this.providers.push(provider);
    }
  }

  /**
   * 제공자 제거
   */
  static unregisterProvider(name: string): boolean {
    const index = this.providers.findIndex(p => p.name === name);
    if (index >= 0) {
      this.providers.splice(index, 1);
      return true;
    }
    return false;
  }
}
