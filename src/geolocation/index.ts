/**
 * GeoIP Shared Module
 *
 * 프로젝트 독립적인 GeoIP 유틸리티
 * - 순수 Provider 구현
 * - 범용 배치 처리기
 * - IP 유틸리티는 @withwiz/utils/ip-utils 에서 import
 *
 * 프로젝트 종속적인 서비스는 <your-project>/services/geoip 를 사용하세요.
 */

// 순수 Provider 모듈 (프로젝트 독립적)
export {
  BaseGeoIPProvider,
  truncateString,
  IPApiProvider,
  IPApiCoProvider,
  IPGeolocationProvider,
  MaxMindProvider,
  GeoIPProviderFactory,
} from './providers';

// 범용 배치 처리기 (프로젝트 독립적)
export { BatchProcessor, createBatchProcessor } from './batch-processor';

// 타입 re-export (프로젝트 독립적)
export type {
  IGeoIPConfig,
  IGeoIPService,
  IGeoIPProvider,
  IGeoIPApiResponse,
  IBatchProcessorConfig,
  IBatchProcessResult,
  IGeographyAnalytics,
  IGeoIPStats,
  IGeoIPError,
  IGeoIPCacheEntry,
  IGeoIPPreset,
} from '@withwiz/types/geoip';

export type {
  IGeoLocationData,
  IGeoIPResponse,
  IDatabaseService,
  ICacheService,
} from '@withwiz/types/database';
