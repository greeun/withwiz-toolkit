// ============================================================================
// GeoIP 관련 통합 타입 정의
// ============================================================================

import type { IGeoLocationData, IDatabaseService, ICacheService } from './database';

// ============================================================================
// 기본 GeoIP 설정 타입
// ============================================================================

export interface IGeoIPConfig {
  cacheEnabled: boolean;
  cacheTTL: number; // 초 단위
  batchSize: number;
  rateLimitDelay: number; // 밀리초 단위
  maxRetries: number;
  timeout: number; // 밀리초 단위
  enablePrivateIPDetection: boolean;
  enableProxyDetection: boolean;
  fallbackProviders: string[];
}

// ============================================================================
// GeoIP 서비스 인터페이스
// ============================================================================

export interface IGeoIPService {
  getGeoLocation(ip: string): Promise<IGeoLocationData | null>;
  getGeoLocationBatch(ips: string[]): Promise<Map<string, IGeoLocationData>>;
  updateGeoLocation(entityId: string, ip: string): Promise<void>;
  getGeographyAnalytics(entityId: string, days?: number): Promise<IGeographyAnalytics>;
  getUserGeographyAnalytics(userId: string, days?: number): Promise<IGeographyAnalytics>;
  findOrCreateGeoLocation(ip: string): Promise<string | null>;
  isGeoLocationOutdated(validFrom: Date): boolean;
}

// ============================================================================
// 배치 처리 관련 타입
// ============================================================================

export interface IBatchProcessorConfig {
  batchSize: number;
  delayBetweenBatches: number; // 밀리초
  maxConcurrentBatches: number;
  retryAttempts: number;
  timeout: number; // 밀리초
}

export interface IBatchProcessResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: string[];
  processingTime: number; // 밀리초
  averageTimePerItem: number; // 밀리초
}

// ============================================================================
// GeoIP 서비스 팩토리 타입
// ============================================================================

export interface IGeoIPServiceFactory {
  getInstance(
    databaseService?: IDatabaseService,
    cacheService?: ICacheService,
    config?: Partial<IGeoIPConfig>
  ): IGeoIPService;
}

// ============================================================================
// GeoIP 배치 처리기 타입
// ============================================================================

export interface IGeoIPBatchProcessor {
  processMissingGeoIPData(): Promise<IBatchProcessResult>;
  processGeoIPData(entityId: string): Promise<IBatchProcessResult>;
  cleanupOldGeoIPData(daysOld?: number): Promise<number>;
  getGeoIPStats(): Promise<IGeoIPStats>;
  processUserGeoIPData(userId: string): Promise<IBatchProcessResult>;
}

// ============================================================================
// 외부 GeoIP API 응답 타입
// ============================================================================

export interface IGeoIPApiResponse {
  // IP-API.com 응답 형식
  status?: string;
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  proxy?: boolean;
  hosting?: boolean;
  
  // IPAPI.co 응답 형식
  country_code?: string;
  country_name?: string;
  region_code?: string;
  latitude?: number;
  longitude?: number;
  organization?: string;
  asn?: string;

  // IPGeolocation.io 응답 형식 (중복 속성 제거 - 위에 이미 정의됨)
  // countryCode, regionName, organization, as 는 위 섹션에 이미 정의됨
}

// ============================================================================
// GeoIP 서비스 제공자 타입
// ============================================================================

export interface IGeoIPProvider {
  name: string;
  url(ip: string): string;
  parseResponse(data: IGeoIPApiResponse): IGeoLocationData | null;
  isAvailable(): boolean;
  getRateLimit(): number; // 요청/분
  getTimeout(): number; // 밀리초
}

// ============================================================================
// 지리 분석 데이터 타입
// ============================================================================

export interface IGeographyAnalytics {
  totalEvents: number;
  countries: Array<{
    country: string;
    countryName: string;
    count: number;
    percentage: number;
  }>;
  cities: Array<{
    country: string | null;
    city: string;
    count: number;
    percentage: number;
  }>;
  regions: Array<{
    country: string | null;
    region: string;
    count: number;
    percentage: number;
  }>;
  timezones: Array<{
    timezone: string;
    count: number;
    percentage: number;
  }>;
  isps: Array<{
    isp: string;
    count: number;
    percentage: number;
  }>;
  privateIPs: number;
  proxyConnections: number;
  lastUpdated: Date;
}

// ============================================================================
// GeoIP 통계 타입
// ============================================================================

export interface IGeoIPStats {
  totalRecords: number;
  privateIPs: number;
  publicIPs: number;
  recentUpdates: number;
  oldestRecord?: Date;
  newestRecord?: Date;
  providerStats: Array<{
    provider: string;
    requests: number;
    successRate: number;
    averageResponseTime: number;
  }>;
  cacheStats: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
  };
}

// ============================================================================
// GeoIP 에러 타입
// ============================================================================

export interface IGeoIPError {
  code: 'PROVIDER_UNAVAILABLE' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_IP' | 'NETWORK_ERROR' | 'PARSING_ERROR' | 'DATABASE_ERROR';
  message: string;
  provider?: string;
  ip?: string;
  timestamp: Date;
  retryable: boolean;
}

// ============================================================================
// GeoIP 캐시 타입
// ============================================================================

export interface IGeoIPCacheEntry {
  data: IGeoLocationData;
  timestamp: Date;
  ttl: number;
  hits: number;
}

// ============================================================================
// GeoIP 설정 프리셋 타입
// ============================================================================

export interface IGeoIPPreset {
  name: string;
  description: string;
  config: IGeoIPConfig;
  useCase: 'development' | 'production' | 'testing' | 'high-volume' | 'low-latency';
}
