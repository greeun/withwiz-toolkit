/**
 * MaxMind GeoIP2 Provider
 *
 * 유료 GeoIP 제공자 (최고 성능, 로컬 DB)
 * - 프로젝트 독립적
 * - 로컬 데이터베이스 사용 (현재 미구현)
 */
import type { IGeoIPApiResponse } from '@withwiz/types/geoip';
import type { IGeoLocationData } from '@withwiz/types/database';
import { BaseGeoIPProvider } from './base-provider';
import { getGeolocationConfig } from '../config';

export class MaxMindProvider extends BaseGeoIPProvider {
  name = 'maxmind';
  protected rateLimit = 50000; // 분당 50000회 요청 제한 (엔터프라이즈 플랜 기준)
  protected timeout = 2000; // 2초 타임아웃

  url(ip: string): string {
    // MaxMind는 일반적으로 로컬 데이터베이스를 사용하므로 URL 기반 API는 제공하지 않음
    // 대신 로컬 GeoIP2 데이터베이스를 사용하는 구현이 필요
    return '';
  }

  parseResponse(data: IGeoIPApiResponse): IGeoLocationData | null {
    // MaxMind GeoIP2 데이터베이스 응답 파싱 로직
    // 현재는 구현되지 않음
    return null;
  }

  isAvailable(): boolean {
    try {
      return !!getGeolocationConfig().maxmindLicenseKey;
    } catch {
      return false;
    }
  }
}
