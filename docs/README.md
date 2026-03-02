# Shared Components & Libraries

이 폴더는 다른 프로젝트에서 재사용할 수 있는 **완전히 독립적인** 공용 컴포넌트와 라이브러리들을 포함합니다.

## 🎯 독립성 특징

- ✅ **외부 의존성 없음**: `/lib/`, `/components/`, `/types/` 디렉토리와의 의존성 완전 제거
- ✅ **인터페이스 기반 설계**: 의존성 주입을 통한 유연한 설계
- ✅ **즉시 사용 가능**: 다른 프로젝트에 복사하여 바로 사용 가능
- ✅ **타입 안전성**: 모든 타입이 내부에서 정의되어 일관성 유지

## 📁 폴더 구조

```
shared/
├── components/          # 공용 React 컴포넌트
│   ├── ui/             # UI 컴포넌트
│   ├── forms/          # 폼 컴포넌트
│   └── charts/         # 차트 컴포넌트
├── hooks/              # 공용 React 훅
├── utils/              # 유틸리티 함수
│   ├── client/         # 클라이언트 전용 유틸리티
│   ├── common/         # 공통 유틸리티
│   └── server/         # 서버 전용 유틸리티
├── types/              # 공용 타입 정의
└── constants/          # 공용 상수
```

## 🧩 공용 컴포넌트

### UI 컴포넌트

#### DataTable
범용 데이터 테이블 컴포넌트로 필터링, 정렬, 페이지네이션, 벌크 액션을 지원합니다.

```tsx
import { DataTable } from '@/shared/components/ui/DataTable';

<DataTable
  data={data}
  columns={columns}
  pagination={paginationConfig}
  filters={filterConfigs}
  bulkActions={bulkActions}
  selectable={true}
  getRowId={(item) => item.id}
/>
```

#### LoadingBar
로딩 상태를 표시하는 컴포넌트입니다.

```tsx
import { LoadingBar } from '@/shared/components/ui/loading-bar';

<LoadingBar size="md" variant="primary" />
```

#### TimezoneDisplay
타임존 정보를 표시하는 컴포넌트입니다.

```tsx
import { TimezoneDisplay } from '@/shared/components/ui/TimezoneDisplay';

<TimezoneDisplay showIcon={true} showOffset={true} />
```

## 🎣 공용 훅

### useDataTable
데이터 테이블의 상태 관리를 위한 훅입니다.

```tsx
import { useDataTable } from '@/shared/hooks/useDataTable';

const {
  data,
  loading,
  error,
  filters,
  sort,
  pagination,
  selectedIds,
  updateFilter,
  setSort,
  setPage,
  refresh
} = useDataTable({
  onDataChange: async (params) => {
    // 데이터 로딩 로직
  }
});
```

### useDebounce
입력값의 디바운싱을 위한 훅입니다.

```tsx
import { useDebounce } from '@/shared/hooks/useDebounce';

const debouncedValue = useDebounce(value, 500);
```

### useTimezone
타임존 정보를 관리하는 훅입니다.

```tsx
import { useTimezone } from '@/shared/hooks/useTimezone';

const { timezone, offset, offsetFormatted } = useTimezone();
```

## 🛠️ 공용 유틸리티

### 클라이언트 유틸리티

#### cn (클래스 병합)
Tailwind CSS 클래스를 병합하는 함수입니다.

```tsx
import { cn } from '@/shared/utils/client/client-utils';

<div className={cn('base-class', condition && 'conditional-class')} />
```

#### copyToClipboard
클립보드에 텍스트를 복사하는 함수입니다.

```tsx
import { copyToClipboard } from '@/shared/utils/client/client-utils';

const success = await copyToClipboard('복사할 텍스트');
```

### 공통 유틸리티

#### 타임존 유틸리티
글로벌 서비스를 위한 타임존 관련 함수들입니다.

```tsx
import { 
  formatUserFriendlyDate,
  formatTableDateTime,
  getRelativeTime,
  getUserTimezone
} from '@/shared/utils/common/timezone';

// 사용자 친화적인 날짜 포맷
const formatted = formatUserFriendlyDate(new Date());

// 테이블용 날짜/시간 포맷
const { date, time } = formatTableDateTime(new Date());

// 상대적 시간 표시
const relative = getRelativeTime(new Date());

// 사용자 타임존 가져오기
const timezone = getUserTimezone();
```

#### 별칭 검증 유틸리티
별칭(Alias) 검증을 위한 함수들입니다.

```tsx
import { 
  validateAliasBasic,
  checkDuplicateAliasesInArray,
  createValidationError
} from '@/shared/utils/common/shared-utils';

// 기본 별칭 검증
const result = validateAliasBasic('my-alias', {
  minLength: 3,
  maxLength: 20,
  checkPattern: true
});

// 배열 내 중복 체크
const duplicates = checkDuplicateAliasesInArray([
  { alias: 'alias1' },
  { alias: 'alias2' },
  { alias: 'alias1' } // 중복
]);
```

#### GeoIP 유틸리티
IP 주소의 지리적 위치 정보를 가져오는 함수들입니다.

```tsx
import { 
  getGeoLocation,
  getGeoLocationBatch,
  isPrivateIP
} from '@/shared/geolocation/geoip';

// 단일 IP 조회
const geoData = await getGeoLocation('192.168.1.1');

// 배치 IP 조회
const geoMap = await getGeoLocationBatch(['192.168.1.1', '8.8.8.8']);

// Private IP 체크
const isPrivate = isPrivateIP('192.168.1.1');
```

#### 로깅 유틸리티
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
logError('에러 메시지', { error: new Error('test') });

// API 요청/응답 로깅
logApiRequest(request, { userId: '123' });
logApiResponse(response, { duration: 150 });
```

#### 캐시 유틸리티
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
const cached = await getCache('key');
await setCache('key', 'value', 3600); // 1시간 TTL

// 캐시 래퍼 함수
const result = await withCache('key', async () => {
  return expensiveOperation();
}, 3600);

// Redis 연결 체크
const status = await checkRedisConnection();
```

## 📝 공용 타입

### 사용자 타입
```tsx
import type { IUser } from '@/shared/types/user';
```

### 링크 타입 (독립적인 예시)
```tsx
// 다른 프로젝트에서 사용할 때는 자체 링크 타입을 정의하세요
interface ILink {
  id: string;
  shortCode: string;
  originalUrl: string;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  isActive: boolean;
  expiresAt?: string | null;
  isPublic: boolean;
}
```

### QR 코드 타입
```tsx
import type { IQRCodeOptions } from '@/shared/types/qr-code';
```

## 🔧 공용 상수

### 검증 상수
```tsx
import { 
  ALIAS_PATTERNS,
  VALIDATION_ERRORS,
  ERROR_CODES
} from '@/shared/constants/validation';
```

## 🚀 사용 방법

### 1. 프로젝트에 추가
이 shared 폴더를 다른 프로젝트에 복사하거나 심볼릭 링크를 생성합니다.

### 2. 경로 별칭 설정
`tsconfig.json`에 경로 별칭을 추가합니다:

```json
{
  "compilerOptions": {
    "paths": {
      "@/shared/*": ["./shared/*"]
    }
  }
}
```

### 3. 의존성 설치
필요한 의존성들을 설치합니다:

```bash
npm install clsx tailwind-merge lucide-react
```

### 4. 컴포넌트 사용
위의 예시들을 참고하여 컴포넌트와 유틸리티를 사용합니다.

## 📋 체크리스트

- [ ] 필요한 의존성 설치
- [ ] 경로 별칭 설정
- [ ] 타입 정의 확인
- [ ] 환경 변수 설정 (캐시, 로깅 등)
- [ ] 테스트 작성

## 🔄 업데이트

이 공용 라이브러리는 지속적으로 업데이트됩니다. 새로운 기능이나 버그 수정이 있을 때마다 이 문서를 업데이트해주세요.

## 🆕 새로운 GeoIP 통합 컴포넌트

### GeoIP 서비스 통합
GeoIP 관련 기능을 통합하고 재사용 가능한 컴포넌트로 구조화했습니다.

#### 통합 GeoIP 서비스
```tsx
import { createGeoIPService } from '@/shared/geolocation/geoip-service';
import { getGeoIPConfig } from '@/shared/geolocation/geoip-config';

// 서비스 생성
const geoIPService = createGeoIPService(databaseService, cacheService, getGeoIPConfig());

// 단일 IP 조회
const geoData = await geoIPService.getGeoLocation('8.8.8.8');

// 배치 IP 조회
const geoMap = await geoIPService.getGeoLocationBatch(['8.8.8.8', '1.1.1.1']);
```

#### GeoIP 제공자 팩토리
```tsx
import { GeoIPProviderFactory } from '@/shared/geolocation/geoip-providers';

// 사용 가능한 제공자 조회
const providers = GeoIPProviderFactory.getAvailableProviders();

// 특정 제공자 조회
const ipApiProvider = GeoIPProviderFactory.getProvider('ip-api.com');
```

#### 범용 배치 처리기
```tsx
import { createBatchProcessor } from '@/shared/geolocation/batch-processor';

const processor = createBatchProcessor({
  batchSize: 50,
  delayBetweenBatches: 2000,
  maxConcurrentBatches: 3,
  retryAttempts: 3
});

// 배치 처리 실행
const result = await processor.processBatch(items, async (batch) => {
  return await processBatchItems(batch);
});
```

#### GeoIP 설정 관리
```tsx
import { 
  getGeoIPConfig, 
  updateGeoIPConfig, 
  validateGeoIPConfig 
} from '@/shared/geolocation/geoip-config';

// 환경별 설정 조회
const devConfig = getGeoIPConfig('development');
const prodConfig = getGeoIPConfig('production');

// 설정 검증
const validation = validateGeoIPConfig(config);
```

### 새로운 타입 정의
```tsx
import type { 
  IGeoIPConfig,
  IGeoIPService,
  IBatchProcessorConfig,
  IBatchProcessResult,
  IGeoIPProvider
} from '@/shared/types/geoip';
```

## 📞 지원

문제가 발생하거나 새로운 기능이 필요한 경우, 프로젝트 관리자에게 문의하세요.
