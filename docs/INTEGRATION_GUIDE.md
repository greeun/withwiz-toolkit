# Shared 라이브러리 통합 가이드

다른 프로젝트에서 이 **완전히 독립적인** shared 라이브러리를 사용하는 방법을 단계별로 설명합니다.

## 🎯 독립성 특징

이 shared 라이브러리는 다음과 같은 독립성을 보장합니다:

- ✅ **외부 의존성 없음**: `/lib/`, `/components/`, `/types/` 디렉토리와의 의존성 완전 제거
- ✅ **인터페이스 기반 설계**: 의존성 주입을 통한 유연한 설계
- ✅ **즉시 사용 가능**: 다른 프로젝트에 복사하여 바로 사용 가능
- ✅ **타입 안전성**: 모든 타입이 내부에서 정의되어 일관성 유지

## 📋 목차

1. [프로젝트 준비](#1-프로젝트-준비)
2. [Shared 폴더 복사](#2-shared-폴더-복사)
3. [의존성 설치](#3-의존성-설치)
4. [TypeScript 설정](#4-typescript-설정)
5. [Next.js 설정](#5-nextjs-설정)
6. [환경 변수 설정](#6-환경-변수-설정)
7. [사용 예시](#7-사용-예시)
8. [문제 해결](#8-문제-해결)

## 1. 프로젝트 준비

### 지원되는 프로젝트 타입
- ✅ Next.js 13+ (App Router)
- ✅ React 18+
- ✅ TypeScript
- ✅ Tailwind CSS

### 최소 요구사항
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "next": "^13.0.0",
    "typescript": "^5.0.0"
  }
}
```

## 2. Shared 폴더 복사

### 방법 1: 직접 복사
```bash
# 원본 프로젝트에서 shared 폴더 복사
# SOURCE_PROJECT_PATH를 실제 원본 프로젝트 경로로 변경하세요
cp -r ${SOURCE_PROJECT_PATH}/shared ./shared

# 예시:
# cp -r ../url-shortener-mvp/shared ./shared
# cp -r ~/projects/url-shortener-mvp/shared ./shared
```

### 방법 2: Git Submodule (권장)
```bash
# Git submodule로 추가
git submodule add https://github.com/your-org/shared-lib.git shared
git submodule update --init --recursive
```

### 방법 3: NPM 패키지로 배포 (고급)
```bash
# shared 폴더를 npm 패키지로 배포 후
npm install @your-org/shared-lib
```

## 3. 의존성 설치

### 필수 의존성
```bash
npm install clsx tailwind-merge lucide-react
```

### 선택적 의존성 (기능별)
```bash
# 캐시 기능 사용시
npm install @upstash/redis

# GeoIP 기능 사용시
npm install axios

# 로깅 기능 사용시
npm install winston

# QR 코드 기능 사용시
npm install qrcode @types/qrcode
```

### 개발 의존성
```bash
npm install -D @types/node
```

## 4. TypeScript 설정

### tsconfig.json 수정
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/shared/*": ["./shared/*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    "./shared/**/*"
  ]
}
```

### 타입 선언 파일 생성 (필요시)
```typescript
// types/shared.d.ts
declare module '@/shared/*' {
  const content: any;
  export default content;
}
```

## 5. Next.js 설정

### next.config.js 수정
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Shared 폴더를 포함하도록 설정
  transpilePackages: [],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/shared': require('path').resolve(__dirname, 'shared'),
    };
    return config;
  },
};

module.exports = nextConfig;
```

### Tailwind CSS 설정
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './shared/**/*.{js,ts,jsx,tsx,mdx}', // Shared 폴더 추가
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## 6. 환경 변수 설정

### .env.local 생성
```env
# 캐시 설정 (선택사항)
UPSTASH_REDIS_REST_URL=your_redis_url_here
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# GeoIP 설정 (선택사항)
IPGEO_API_KEY=your_ipgeo_api_key_here

# 로깅 설정 (선택사항)
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

### 환경 변수 타입 정의
```typescript
// lib/env.ts
export const env = {
  REDIS_URL: process.env.UPSTASH_REDIS_REST_URL,
  REDIS_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  IPGEO_API_KEY: process.env.IPGEO_API_KEY,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;
```

## 7. 사용 예시

### 기본 컴포넌트 사용
```tsx
// app/page.tsx
import { DataTable } from '@/shared/components/ui/DataTable';
import { LoadingBar } from '@/shared/components/ui/loading-bar';
import { TimezoneDisplay } from '@/shared/components/ui/TimezoneDisplay';

export default function HomePage() {
  const columns = [
    {
      key: 'name',
      header: '이름',
      accessorKey: 'name',
      sortable: true,
    },
    {
      key: 'email',
      header: '이메일',
      accessorKey: 'email',
      sortable: true,
    },
  ];

  const data = [
    { id: '1', name: '홍길동', email: 'hong@example.com' },
    { id: '2', name: '김철수', email: 'kim@example.com' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">사용자 목록</h1>
      
      <div className="mb-4">
        <TimezoneDisplay showIcon={true} showOffset={true} />
      </div>

      <DataTable
        data={data}
        columns={columns}
        getRowId={(item) => item.id}
        pagination={{
          page: 1,
          pageSize: 10,
          total: data.length,
          onPageChange: (page) => console.log('Page changed:', page),
          onPageSizeChange: (size) => console.log('Page size changed:', size),
        }}
      />
    </div>
  );
}
```

### 훅 사용
```tsx
// components/UserTable.tsx
'use client';

import { useDataTable } from '@/shared/hooks/useDataTable';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useTimezone } from '@/shared/hooks/useTimezone';
import { DataTable } from '@/shared/components/ui/DataTable';

export function UserTable() {
  const { timezone, offsetFormatted } = useTimezone();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  const {
    data,
    loading,
    error,
    filters,
    pagination,
    updateFilter,
    refresh,
  } = useDataTable({
    initialFilters: { search: '' },
    onDataChange: async ({ filters, pagination }) => {
      // API 호출 로직
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: filters.search,
          page: pagination.page,
          pageSize: pagination.pageSize,
        }),
      });
      
      const result = await response.json();
      return {
        data: result.users,
        total: result.total,
      };
    },
  });

  useEffect(() => {
    updateFilter('search', debouncedSearch);
  }, [debouncedSearch, updateFilter]);

  return (
    <div>
      <p>현재 타임존: {timezone} ({offsetFormatted})</p>
      
      <input
        type="text"
        placeholder="사용자 검색..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="border p-2 mb-4"
      />

      <DataTable
        data={data}
        columns={columns}
        loading={loading}
        error={error}
        pagination={pagination}
        getRowId={(user) => user.id}
      />
    </div>
  );
}
```

### 유틸리티 함수 사용
```tsx
// lib/utils.ts
import { cn } from '@/shared/utils/client/client-utils';
import { formatUserFriendlyDate, getRelativeTime } from '@/shared/utils/common/timezone';
import { validateAliasBasic } from '@/shared/utils/common/shared-utils';

// 클래스 병합
export function getButtonClass(variant: 'primary' | 'secondary') {
  return cn(
    'px-4 py-2 rounded',
    variant === 'primary' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'
  );
}

// 날짜 포맷팅
export function formatDate(date: Date) {
  return formatUserFriendlyDate(date);
}

export function getTimeAgo(date: Date) {
  return getRelativeTime(date);
}

// 별칭 검증
export function validateCustomAlias(alias: string) {
  return validateAliasBasic(alias, {
    minLength: 3,
    maxLength: 20,
    checkPattern: true,
  });
}
```

### API 라우트에서 사용
```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { logger, logApiRequest, logApiResponse } from '@/shared/logger/logger';
import { getCache, setCache } from '@/shared/cache/cache';
import { getGeoLocation } from '@/shared/geolocation/geoip';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // 요청 로깅
  logApiRequest(request, { action: 'get_users' });

  try {
    // 캐시 확인
    const cacheKey = 'users:list';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      logger.info('Users loaded from cache');
      return NextResponse.json(cached);
    }

    // 데이터베이스에서 사용자 조회
    const users = await fetchUsersFromDB();
    
    // 캐시에 저장 (1시간)
    await setCache(cacheKey, users, 3600);

    // 응답 로깅
    const duration = Date.now() - startTime;
    logApiResponse(NextResponse.json(users), { duration });

    return NextResponse.json(users);
  } catch (error) {
    logger.error('Failed to fetch users', { error });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  
  // GeoIP 조회
  const geoData = await getGeoLocation(ip);
  
  if (geoData.success && geoData.data) {
    logger.info('User location detected', {
      country: geoData.data.country,
      city: geoData.data.city,
    });
  }

  // 사용자 생성 로직...
}
```

## 8. 문제 해결

### 일반적인 오류와 해결방법

#### 1. 모듈을 찾을 수 없음
```
Module not found: Can't resolve '@/shared/components/ui/DataTable'
```

**해결방법:**
- `tsconfig.json`의 `paths` 설정 확인
- `next.config.js`의 webpack 설정 확인
- 파일 경로가 정확한지 확인

#### 2. 타입 오류
```
Property 'DataTable' does not exist on type 'typeof import("@/shared/components/ui/DataTable")'
```

**해결방법:**
- TypeScript 버전 확인 (5.0+ 권장)
- `skipLibCheck: true` 설정 추가
- 타입 선언 파일 확인

#### 3. 스타일이 적용되지 않음
```
Tailwind CSS classes not working
```

**해결방법:**
- `tailwind.config.js`에 shared 폴더 경로 추가
- CSS 파일에 Tailwind directives 확인
- PostCSS 설정 확인

#### 4. 환경 변수 오류
```
process.env.UPSTASH_REDIS_REST_URL is undefined
```

**해결방법:**
- `.env.local` 파일 생성 및 변수 설정
- Next.js 재시작
- 환경 변수 이름 확인

### 디버깅 팁

#### 1. 경로 확인
```bash
# 파일이 존재하는지 확인
ls -la shared/components/ui/DataTable.tsx

# TypeScript 컴파일 확인
npx tsc --noEmit
```

#### 2. 빌드 테스트
```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드 테스트
npm run build
```

#### 3. 로그 확인
```typescript
// 개발 모드에서 상세 로그 활성화
import { logger } from '@/shared/logger/logger';

logger.info('Shared library loaded successfully');
```

## 📚 추가 리소스

- [Shared README](./README.md) - 전체 가이드
- [Components README](./components/README.md) - 컴포넌트 사용법
- [Hooks README](./hooks/README.md) - 훅 사용법
- [Utils README](./utils/README.md) - 유틸리티 사용법

## 🤝 지원

문제가 발생하거나 추가 기능이 필요한 경우:
1. 이슈 등록
2. 문서 확인
3. 예시 코드 검토
4. 커뮤니티 지원 요청
