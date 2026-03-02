# 🚀 빠른 시작 가이드

5분 안에 **완전히 독립적인** shared 라이브러리를 새로운 프로젝트에 통합하는 방법입니다.

## 🎯 독립성 특징

- ✅ **외부 의존성 없음**: `/lib/`, `/components/`, `/types/` 디렉토리와의 의존성 완전 제거
- ✅ **인터페이스 기반 설계**: 의존성 주입을 통한 유연한 설계
- ✅ **즉시 사용 가능**: 다른 프로젝트에 복사하여 바로 사용 가능
- ✅ **타입 안전성**: 모든 타입이 내부에서 정의되어 일관성 유지

## ⚡ 1분 설정

### 1. 프로젝트 생성
```bash
npx create-next-app@latest my-project --typescript --tailwind --app
cd my-project
```

### 2. Shared 폴더 복사
```bash
# 원본 프로젝트에서 shared 폴더 복사
# SOURCE_PROJECT_PATH를 실제 원본 프로젝트 경로로 변경하세요
cp -r ${SOURCE_PROJECT_PATH}/shared ./shared

# 예시:
# cp -r ../url-shortener-mvp/shared ./shared
```

### 3. 필수 의존성 설치
```bash
npm install clsx tailwind-merge lucide-react
```

## ⚙️ 2분 설정

### tsconfig.json 수정
```json
{
  "compilerOptions": {
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
  ]
}
```

### tailwind.config.js 수정
```javascript
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './shared/**/*.{js,ts,jsx,tsx,mdx}', // 이 줄 추가
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## 🎯 2분 테스트

### app/page.tsx 수정
```tsx
import { DataTable } from '@/shared/components/ui/DataTable';
import { TimezoneDisplay } from '@/shared/components/ui/TimezoneDisplay';
import { cn } from '@/shared/utils/client/client-utils';

export default function HomePage() {
  const data = [
    { id: '1', name: '홍길동', email: 'hong@example.com' },
    { id: '2', name: '김철수', email: 'kim@example.com' },
  ];

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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">사용자 목록</h1>
      
      <div className="mb-4">
        <TimezoneDisplay showIcon={true} showOffset={true} />
      </div>

      <div className={cn('bg-white rounded-lg shadow p-4')}>
        <DataTable
          data={data}
          columns={columns}
          getRowId={(item) => item.id}
          pagination={{
            page: 1,
            pageSize: 10,
            total: data.length,
            onPageChange: (page) => console.log('Page:', page),
            onPageSizeChange: (size) => console.log('Size:', size),
          }}
        />
      </div>
    </div>
  );
}
```

### 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 shared 라이브러리가 정상적으로 작동하는 것을 확인할 수 있습니다!

## 🎉 완료!

이제 다음 기능들을 사용할 수 있습니다:

- ✅ **DataTable**: 필터링, 정렬, 페이지네이션
- ✅ **TimezoneDisplay**: 타임존 정보 표시
- ✅ **유틸리티 함수**: `cn`, 날짜 포맷팅 등
- ✅ **타입 안전성**: TypeScript 지원

## 📚 다음 단계

더 많은 기능을 사용하려면:

1. **[통합 가이드](./INTEGRATION_GUIDE.md)** - 상세한 설정 방법
2. **[예시 프로젝트](./EXAMPLE_PROJECT_STRUCTURE.md)** - 완전한 프로젝트 구조
3. **[컴포넌트 가이드](./components/README.md)** - UI 컴포넌트 사용법
4. **[훅 가이드](./hooks/README.md)** - React 훅 사용법
5. **[유틸리티 가이드](./utils/README.md)** - 유틸리티 함수 사용법

## 🆘 문제가 있나요?

- **모듈을 찾을 수 없음**: `tsconfig.json`의 `paths` 설정 확인
- **스타일이 적용되지 않음**: `tailwind.config.js`에 shared 폴더 경로 추가
- **타입 오류**: TypeScript 버전 확인 (5.0+ 권장)

## 🔗 유용한 링크

- [Next.js 공식 문서](https://nextjs.org/docs)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [TypeScript 문서](https://www.typescriptlang.org/docs)
