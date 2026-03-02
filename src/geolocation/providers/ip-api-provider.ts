/**
 * IP-API.com Provider
 *
 * 무료 GeoIP 제공자 (분당 45회 요청 제한)
 * - 프로젝트 독립적
 * - HTTP 전용 (무료 플랜)
 */
import type { IGeoIPApiResponse } from '@withwiz/types/geoip';
import type { IGeoLocationData } from '@withwiz/types/database';
import { BaseGeoIPProvider, truncateString } from './base-provider';

export class IPApiProvider extends BaseGeoIPProvider {
  name = 'ip-api.com';
  protected rateLimit = 45; // 분당 45회 요청 제한
  protected timeout = 5000; // 5초 타임아웃

  url(ip: string): string {
    return `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,proxy,hosting`;
  }

  parseResponse(data: IGeoIPApiResponse): IGeoLocationData | null {
    if (data.status === 'success') {
      return {
        ipAddress: '', // IP는 별도로 설정
        country: truncateString(data.countryCode, 2) || undefined,
        countryName: truncateString(data.country, 100) || undefined,
        region: truncateString(data.regionName, 100) || undefined,
        regionCode: truncateString(data.region, 10) || undefined,
        city: truncateString(data.city, 100) || undefined,
        latitude: data.lat,
        longitude: data.lon,
        timezone: truncateString(data.timezone, 50) || undefined,
        isp: truncateString(data.isp, 500) || undefined,
        organization: truncateString(data.org, 500) || undefined,
        asn: truncateString(data.as, 50) || undefined,
        isPrivate: false,
        isProxy: data.proxy || false,
        accuracy: 1000,
        lastUpdated: new Date(),
      };
    }
    return null;
  }
}
