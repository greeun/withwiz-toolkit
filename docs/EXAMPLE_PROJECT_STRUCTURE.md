# 예시 프로젝트 구조

다른 프로젝트에서 shared 라이브러리를 사용할 때의 권장 프로젝트 구조입니다.

## 📁 권장 프로젝트 구조

```
your-new-project/
├── .env.local                    # 환경 변수
├── .gitignore
├── next.config.js               # Next.js 설정
├── package.json                 # 의존성
├── tailwind.config.js           # Tailwind CSS 설정
├── tsconfig.json                # TypeScript 설정
├── shared/                      # 공용 라이브러리 (복사됨)
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   └── constants/
├── app/                         # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       └── users/
│           └── route.ts
├── components/                  # 프로젝트별 컴포넌트
│   ├── ui/                     # 프로젝트별 UI 컴포넌트
│   └── forms/                  # 프로젝트별 폼 컴포넌트
├── lib/                        # 프로젝트별 유틸리티
│   ├── db.ts                   # 데이터베이스 연결
│   ├── auth.ts                 # 인증 로직
│   └── utils.ts                # 프로젝트별 유틸리티
└── types/                      # 프로젝트별 타입
    └── index.ts
```

## 🔧 설정 파일 예시

### package.json
```json
{
  "name": "your-new-project",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "^15.0.0",
    "typescript": "^5.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^15.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.3.0"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/shared/*": ["./shared/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    "./shared/**/*"
  ],
  "exclude": ["node_modules"]
}
```

### next.config.js
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

### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
}
```

### .env.local
```env
# 데이터베이스
DATABASE_URL="postgresql://username:password@localhost:5432/your_db"

# Redis (캐시 사용시)
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# GeoIP (위치 정보 사용시)
IPGEO_API_KEY="your-ipgeo-api-key"

# 로깅
LOG_LEVEL="info"
LOG_FILE_PATH="./logs"

# Next.js
JWT_SECRET="your-jwt-secret-key"
```

## 📝 실제 사용 예시

### app/page.tsx (메인 페이지)
```tsx
import { DataTable } from '@/shared/components/ui/DataTable';
import { LoadingBar } from '@/shared/components/ui/loading-bar';
import { TimezoneDisplay } from '@/shared/components/ui/TimezoneDisplay';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useTimezone } from '@/shared/hooks/useTimezone';
import { cn } from '@/shared/utils/client/client-utils';

export default function HomePage() {
  const { timezone, offsetFormatted } = useTimezone();
  
  const {
    data,
    loading,
    error,
    pagination,
    updateFilter,
    refresh,
  } = useDataTable({
    onDataChange: async ({ filters, pagination }) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, pagination }),
      });
      return await response.json();
    },
  });

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
    {
      key: 'createdAt',
      header: '가입일',
      accessorKey: 'createdAt',
      cell: (user: any) => (
        <span className="text-sm text-gray-600">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">사용자 관리</h1>
        <div className="flex items-center gap-4">
          <TimezoneDisplay showIcon={true} showOffset={true} />
          <span className="text-sm text-gray-600">
            현재 타임존: {timezone} ({offsetFormatted})
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <DataTable
          data={data}
          columns={columns}
          loading={loading}
          error={error}
          pagination={pagination}
          getRowId={(user) => user.id}
          searchPlaceholder="사용자 검색..."
          onSearch={(search) => updateFilter('search', search)}
          createButton={{
            label: '사용자 추가',
            onClick: () => console.log('사용자 추가'),
          }}
        />
      </div>
    </div>
  );
}
```

### app/api/users/route.ts (API 라우트)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { logger, logApiRequest, logApiResponse } from '@/shared/logger/logger';
import { getCache, setCache } from '@/shared/cache/cache';
import { getGeoLocation } from '@/shared/geolocation/geoip';
import { formatUserFriendlyDate } from '@/shared/utils/common/timezone';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
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
  const startTime = Date.now();
  
  logApiRequest(request, { action: 'create_user' });

  try {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // GeoIP 조회
    const geoData = await getGeoLocation(ip);
    
    if (geoData.success && geoData.data) {
      logger.info('User location detected', {
        country: geoData.data.country,
        city: geoData.data.city,
        ip: ip,
      });
    }

    // 사용자 생성
    const user = await createUserInDB({
      ...body,
      createdAt: new Date(),
      location: geoData.success ? geoData.data : null,
    });

    const duration = Date.now() - startTime;
    logApiResponse(NextResponse.json(user), { duration });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    logger.error('Failed to create user', { error });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 헬퍼 함수들
async function fetchUsersFromDB() {
  // 실제 데이터베이스 조회 로직
  return [
    {
      id: '1',
      name: '홍길동',
      email: 'hong@example.com',
      createdAt: new Date(),
    },
    {
      id: '2',
      name: '김철수',
      email: 'kim@example.com',
      createdAt: new Date(),
    },
  ];
}

async function createUserInDB(userData: any) {
  // 실제 데이터베이스 생성 로직
  return {
    id: '3',
    ...userData,
  };
}
```

### components/UserForm.tsx (프로젝트별 컴포넌트)
```tsx
'use client';

import { useState } from 'react';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { validateAliasBasic } from '@/shared/utils/common/shared-utils';
import { cn } from '@/shared/utils/client/client-utils';

interface UserFormProps {
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function UserForm({ onSubmit, loading = false }: UserFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    alias: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const debouncedAlias = useDebounce(formData.alias, 500);

  // 별칭 검증
  const validateAlias = (alias: string) => {
    if (!alias) return;
    
    const result = validateAliasBasic(alias, {
      minLength: 3,
      maxLength: 20,
      checkPattern: true,
    });

    if (!result.isValid) {
      setErrors(prev => ({
        ...prev,
        alias: result.error?.message || 'Invalid alias',
      }));
    } else {
      setErrors(prev => {
        const { alias, ...rest } = prev;
        return rest;
      });
    }
  };

  // 디바운스된 별칭 검증
  React.useEffect(() => {
    validateAlias(debouncedAlias);
  }, [debouncedAlias]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (Object.keys(errors).length === 0) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 실시간 검증
    if (field === 'alias') {
      validateAlias(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">이름</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={cn(
            'w-full px-3 py-2 border rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-blue-500'
          )}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">이메일</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={cn(
            'w-full px-3 py-2 border rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-blue-500'
          )}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">별칭</label>
        <input
          type="text"
          value={formData.alias}
          onChange={(e) => handleChange('alias', e.target.value)}
          className={cn(
            'w-full px-3 py-2 border rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            errors.alias && 'border-red-500'
          )}
        />
        {errors.alias && (
          <p className="text-red-500 text-sm mt-1">{errors.alias}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || Object.keys(errors).length > 0}
        className={cn(
          'w-full py-2 px-4 rounded-md font-medium',
          'bg-blue-500 text-white hover:bg-blue-600',
          'disabled:bg-gray-300 disabled:cursor-not-allowed'
        )}
      >
        {loading ? '처리 중...' : '사용자 생성'}
      </button>
    </form>
  );
}
```

### lib/utils.ts (프로젝트별 유틸리티)
```typescript
import { cn } from '@/shared/utils/client/client-utils';
import { formatUserFriendlyDate, getRelativeTime } from '@/shared/utils/common/timezone';
import { validateAliasBasic } from '@/shared/utils/common/shared-utils';

// 프로젝트별 유틸리티 함수들

export function getButtonClass(variant: 'primary' | 'secondary' | 'danger') {
  return cn(
    'px-4 py-2 rounded-md font-medium transition-colors',
    {
      'bg-blue-500 text-white hover:bg-blue-600': variant === 'primary',
      'bg-gray-200 text-gray-800 hover:bg-gray-300': variant === 'secondary',
      'bg-red-500 text-white hover:bg-red-600': variant === 'danger',
    }
  );
}

export function formatDate(date: Date | string) {
  return formatUserFriendlyDate(date);
}

export function getTimeAgo(date: Date | string) {
  return getRelativeTime(date);
}

export function validateUserAlias(alias: string) {
  return validateAliasBasic(alias, {
    minLength: 3,
    maxLength: 20,
    checkPattern: true,
  });
}

export function getStatusClass(status: 'active' | 'inactive' | 'pending') {
  return cn(
    'px-2 py-1 rounded-full text-xs font-medium',
    {
      'bg-green-100 text-green-800': status === 'active',
      'bg-gray-100 text-gray-800': status === 'inactive',
      'bg-yellow-100 text-yellow-800': status === 'pending',
    }
  );
}
```

## 🚀 시작하기

1. **프로젝트 생성**
   ```bash
   npx create-next-app@latest your-project --typescript --tailwind --app
   cd your-project
   ```

2. **Shared 폴더 복사**
   ```bash
   # SOURCE_PROJECT_PATH를 실제 원본 프로젝트 경로로 변경하세요
   cp -r ${SOURCE_PROJECT_PATH}/shared ./shared
   # 예시: cp -r ../url-shortener-mvp/shared ./shared
   ```

3. **의존성 설치**
   ```bash
   npm install clsx tailwind-merge lucide-react
   ```

4. **설정 파일 업데이트**
   - 위의 설정 파일들을 참고하여 프로젝트에 적용

5. **개발 서버 실행**
   ```bash
   npm run dev
   ```

이제 shared 라이브러리의 모든 기능을 사용할 수 있습니다!
