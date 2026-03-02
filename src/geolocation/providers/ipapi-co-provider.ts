/**
 * IPAPI.co Provider
 *
 * 무료 GeoIP 제공자 (분당 1000회 요청 제한)
 * - 프로젝트 독립적
 * - HTTPS 지원
 */
import type { IGeoIPApiResponse } from '@withwiz/types/geoip';
import type { IGeoLocationData } from '@withwiz/types/database';
import { BaseGeoIPProvider, truncateString } from './base-provider';

export class IPApiCoProvider extends BaseGeoIPProvider {
  name = 'ipapi.co';
  protected rateLimit = 1000; // 분당 1000회 요청 제한
  protected timeout = 5000; // 5초 타임아웃

  url(ip: string): string {
    return `https://ipapi.co/${ip}/json/`;
  }

  parseResponse(data: IGeoIPApiResponse): IGeoLocationData | null {
    if (data.country_code) {
      return {
        ipAddress: '', // IP는 별도로 설정
        country: truncateString(data.country_code, 2) || undefined,
        countryName: truncateString(data.country_name, 100) || undefined,
        region: truncateString(data.region, 100) || undefined,
        regionCode: truncateString(data.region_code, 10) || undefined,
        city: truncateString(data.city, 100) || undefined,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: truncateString(data.timezone, 50) || undefined,
        isp: truncateString(data.org, 500) || undefined,
        organization: truncateString(data.org, 500) || undefined,
        asn: truncateString(data.asn, 50) || undefined,
        isPrivate: false,
        isProxy: false,
        accuracy: 1000,
        lastUpdated: new Date(),
      };
    }
    return null;
  }
}
