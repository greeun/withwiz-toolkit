// 데이터베이스 관련 타입 정의
export interface IGeoLocationData {
  ipAddress: string;
  country?: string;
  countryName?: string;
  region?: string;
  regionCode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  organization?: string;
  asn?: string;
  isPrivate: boolean;
  isProxy: boolean;
  accuracy?: number;
  lastUpdated?: Date;
  // Prisma 스키마와 일치하는 추가 필드들
  version?: number;
  validFrom?: Date;
  validTo?: Date;
  isActive?: boolean;
}

export interface IGeoIPResponse {
  success: boolean;
  data?: IGeoLocationData;
  error?: string;
}

// 데이터베이스 인터페이스
export interface IDatabaseService {
  findGeoLocation(ipAddress: string): Promise<IGeoLocationData | null>;
  upsertGeoLocation(data: IGeoLocationData): Promise<IGeoLocationData>;
  findManyGeoLocations(ipAddresses: string[]): Promise<IGeoLocationData[]>;
}

// 캐시 인터페이스
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
}
