# @withwiz/geolocation

GeoIP 조회 시스템으로 여러 프로바이더를 지원합니다.

## 주요 기능

- **다중 프로바이더**: IP-API, ipapi.co, IPGeolocation, MaxMind
- **자동 폴백**: 프로바이더 장애 시 다음 프로바이더로 전환
- **배치 처리**: 대량 IP 조회 최적화

## 지원 프로바이더

| 프로바이더 | 무료 제한 | 특징 |
|-----------|----------|------|
| IP-API | 45회/분 | 빠른 응답 |
| ipapi.co | 1000회/일 | 안정적 |
| IPGeolocation | 1000회/일 | 상세 정보 |
| MaxMind | 유료 | 정확도 높음 |

## 사용법

```typescript
import { createGeoProvider } from '@withwiz/geolocation';

// 프로바이더 생성
const provider = createGeoProvider('ip-api');

// IP 조회
const location = await provider.lookup('8.8.8.8');
console.log(location.country, location.city);
```

## 배치 처리

```typescript
import { GeoIPBatchProcessor } from '@withwiz/geolocation';

const processor = new GeoIPBatchProcessor(provider);

// 여러 IP 동시 조회
const results = await processor.processBatch([
  '8.8.8.8',
  '1.1.1.1',
  '208.67.222.222',
]);
```

## 응답 타입

```typescript
interface IGeoLocationData {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
}
```
