/**
 * IPGeolocation.io Provider
 *
 * 유료 GeoIP 제공자 (고성능)
 * - 프로젝트 독립적
 * - API 키 필요
 */
import type { IGeoIPApiResponse } from '@withwiz/types/geoip';
import type { IGeoLocationData } from '@withwiz/types/database';
import { BaseGeoIPProvider, truncateString } from './base-provider';

export class IPGeolocationProvider extends BaseGeoIPProvider {
  name = 'ipgeolocation.io';
  protected rateLimit = 10000; // 분당 10000회 요청 제한 (유료 플랜 기준)
  protected timeout = 3000; // 3초 타임아웃

  url(ip: string): string {
    const apiKey = process.env.IPGEOLOCATION_API_KEY;
    if (!apiKey) return '';
    return `https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&ip=${ip}`;
  }

  parseResponse(data: IGeoIPApiResponse): IGeoLocationData | null {
    if (data.country) {
      return {
        ipAddress: '', // IP는 별도로 설정
        country: truncateString(data.countryCode || data.country, 2) || undefined,
        countryName: truncateString(data.country, 100) || undefined,
        region: truncateString(data.regionName || data.region, 100) || undefined,
        regionCode: truncateString(data.region, 10) || undefined,
        city: truncateString(data.city, 100) || undefined,
        latitude: data.latitude || data.lat,
        longitude: data.longitude || data.lon,
        timezone: truncateString(data.timezone, 50) || undefined,
        isp: truncateString(data.isp || data.organization, 500) || undefined,
        organization: truncateString(data.organization || data.org, 500) || undefined,
        asn: truncateString(data.asn || data.as, 50) || undefined,
        isPrivate: false,
        isProxy: false,
        accuracy: 100, // 더 높은 정확도
        lastUpdated: new Date(),
      };
    }
    return null;
  }

  isAvailable(): boolean {
    return !!process.env.IPGEOLOCATION_API_KEY;
  }
}
