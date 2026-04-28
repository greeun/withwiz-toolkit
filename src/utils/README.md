# Shared Utilities

이 폴더는 다른 프로젝트에서 재사용할 수 있는 유틸리티 함수들을 포함합니다.

## 📁 구조

- `client/` - 클라이언트 전용 유틸리티
- `common/` - 서버와 클라이언트 공통 유틸리티
- `server/` - 서버 전용 유틸리티

## 🖥️ 클라이언트 유틸리티

### cn (클래스 병합)
Tailwind CSS 클래스를 병합하는 함수입니다.

```tsx
import { cn } from '@/shared/utils/client/client-utils';

<div className={cn('base-class', condition && 'conditional-class')} />
```

### copyToClipboard
클립보드에 텍스트를 복사하는 함수입니다.

```tsx
import { copyToClipboard } from '@/shared/utils/client/client-utils';

const success = await copyToClipboard('복사할 텍스트');
if (success) {
  console.log('복사 성공');
}
```

## 🌐 공통 유틸리티

### 타임존 유틸리티
글로벌 서비스를 위한 타임존 관련 함수들입니다.

```tsx
import { 
  formatUserFriendlyDate,
  formatTableDateTime,
  getRelativeTime,
  getUserTimezone,
  getCurrentUTC,
  utcToLocal,
  localToUTC
} from '@/shared/utils/common/timezone';

// 사용자 친화적인 날짜 포맷
const formatted = formatUserFriendlyDate(new Date());

// 테이블용 날짜/시간 포맷 (2줄 표시)
const { date, time } = formatTableDateTime(new Date());

// 상대적 시간 표시
const relative = getRelativeTime(new Date()); // "2시간 전"

// 사용자 타임존 가져오기
const timezone = getUserTimezone();

// UTC 시간 조작
const utc = getCurrentUTC();
const local = utcToLocal(utc);
const backToUtc = localToUTC(local);
```

### GeoIP 유틸리티
IP 주소의 지리적 위치 정보를 가져오는 함수들입니다.

```tsx
import { 
  getGeoLocation,
  getGeoLocationBatch,
  isPrivateIP,
  type IGeoLocationData,
  type IGeoIPResponse
} from '@/shared/geolocation/geoip';

// 단일 IP 조회
const geoData: IGeoIPResponse = await getGeoLocation('192.168.1.1');

if (geoData.success && geoData.data) {
  console.log(geoData.data.country); // "KR"
  console.log(geoData.data.city); // "Seoul"
}

// 배치 IP 조회 (성능 최적화)
const ipAddresses = ['192.168.1.1', '8.8.8.8', '1.1.1.1'];
const geoMap = await getGeoLocationBatch(ipAddresses);

// Private IP 체크
const isPrivate = isPrivateIP('192.168.1.1'); // true
```

### 로깅 유틸리티
구조화된 로깅을 위한 함수들입니다.

```tsx
import { 
  logger,
  logDebug,
  logInfo,
  logError,
  logApiRequest,
  logApiResponse
} from '@/shared/logger/logger';

// 기본 로깅
logInfo('정보 메시지');
logError('에러 메시지', { error: new Error('test'), userId: '123' });

// API 요청/응답 로깅
logApiRequest(request, { userId: '123', action: 'create_link' });
logApiResponse(response, { duration: 150, statusCode: 200 });
```

### 캐시 유틸리티
Redis 캐시 관리를 위한 함수들입니다.

```tsx
import { 
  getCache,
  setCache,
  deleteCache,
  withCache,
  checkRedisConnection
} from '@/shared/cache/cache';

// 캐시 조회/설정
const cached = await getCache('user:123');
await setCache('user:123', userData, 3600); // 1시간 TTL

// 캐시 래퍼 함수 (캐시가 없으면 함수 실행 후 캐시 저장)
const result = await withCache('expensive-operation', async () => {
  return await expensiveOperation();
}, 3600);

// 캐시 삭제
await deleteCache('user:123');

// Redis 연결 체크
const status = await checkRedisConnection();
if (status.success) {
  console.log('Redis 연결 성공');
}
```

## 📋 체크리스트

### 클라이언트 유틸리티
- [ ] clsx, tailwind-merge 설치
- [ ] 브라우저 호환성 확인

### 공통 유틸리티
- [ ] 타임존 라이브러리 설치 (필요시)
- [ ] GeoIP API 키 설정
- [ ] Redis 연결 설정
- [ ] 로깅 설정

### 환경 변수
```env
# GeoIP (선택사항)
IPGEO_API_KEY=your_api_key_here

# Redis (캐시 사용시)
REDIS_REST_URL=your_redis_url
REDIS_REST_TOKEN=your_redis_token
```

## 🔧 설정

### TypeScript 설정
```json
{
  "compilerOptions": {
    "paths": {
      "@/shared/*": ["./shared/*"]
    }
  }
}
```

### Next.js 설정
```javascript
// next.config.js
module.exports = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
}
```
