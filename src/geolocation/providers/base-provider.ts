/**
 * GeoIP Provider Base
 *
 * 프로젝트 독립적인 GeoIP 제공자 기본 클래스
 * - 외부 의존성 없음 (Prisma, CacheKeys 등)
 * - 순수 HTTP 클라이언트
 */
import type { IGeoIPProvider, IGeoIPApiResponse } from '@withwiz/types/geoip';
import type { IGeoLocationData } from '@withwiz/types/database';

/**
 * 문자열 길이를 제한하는 유틸리티 함수
 */
export function truncateString(str: string | null | undefined, maxLength: number): string | null {
  if (!str) return null;
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

/**
 * GeoIP Provider 기본 클래스
 * 모든 제공자가 상속받아 구현
 */
export abstract class BaseGeoIPProvider implements IGeoIPProvider {
  abstract name: string;
  protected abstract rateLimit: number;
  protected abstract timeout: number;

  abstract url(ip: string): string;
  abstract parseResponse(data: IGeoIPApiResponse): IGeoLocationData | null;

  isAvailable(): boolean {
    return true;
  }

  getRateLimit(): number {
    return this.rateLimit;
  }

  getTimeout(): number {
    return this.timeout;
  }

  /**
   * IP 주소로 GeoIP 데이터 조회
   * @param ip - IP 주소
   * @returns GeoIP 데이터 또는 null
   */
  async fetchGeoData(ip: string): Promise<IGeoLocationData | null> {
    const serviceUrl = this.url(ip);
    if (!serviceUrl) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(serviceUrl, {
        headers: {
          'User-Agent': 'GeoIP-Service/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const data = await response.json();
      const geoData = this.parseResponse(data);

      if (geoData) {
        geoData.ipAddress = ip;
      }

      return geoData;
    } catch (error) {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
