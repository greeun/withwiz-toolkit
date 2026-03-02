# Shared Components

이 폴더는 다른 프로젝트에서 재사용할 수 있는 React 컴포넌트들을 포함합니다.

## 📁 구조

- `ui/` - 기본 UI 컴포넌트
- `forms/` - 폼 관련 컴포넌트  
- `charts/` - 차트 컴포넌트

## 🧩 UI 컴포넌트

### DataTable
범용 데이터 테이블 컴포넌트

**특징:**
- 필터링, 정렬, 페이지네이션 지원
- 벌크 액션 기능
- 반응형 디자인
- 선택 기능
- 로딩 및 에러 상태 처리

**사용법:**
```tsx
import { DataTable } from '@/shared/components/ui/DataTable';

const columns = [
  {
    key: 'name',
    header: '이름',
    accessorKey: 'name',
    sortable: true
  },
  {
    key: 'email',
    header: '이메일',
    accessorKey: 'email',
    sortable: true
  }
];

<DataTable
  data={users}
  columns={columns}
  pagination={{
    page: 1,
    pageSize: 10,
    total: 100,
    onPageChange: setPage,
    onPageSizeChange: setPageSize
  }}
  selectable={true}
  getRowId={(user) => user.id}
/>
```

### LoadingBar
로딩 상태 표시 컴포넌트

**Props:**
- `size`: 'sm' | 'md' | 'lg'
- `variant`: 'default' | 'primary' | 'secondary'
- `className`: 추가 CSS 클래스

**사용법:**
```tsx
import { LoadingBar } from '@/shared/components/ui/loading-bar';

<LoadingBar size="md" variant="primary" />
```

### TimezoneDisplay
타임존 정보 표시 컴포넌트

**Props:**
- `showIcon`: 아이콘 표시 여부
- `showOffset`: 오프셋 표시 여부
- `variant`: 'default' | 'secondary' | 'outline'

**사용법:**
```tsx
import { TimezoneDisplay } from '@/shared/components/ui/TimezoneDisplay';

<TimezoneDisplay showIcon={true} showOffset={true} />
```

## 📋 체크리스트

- [ ] 필요한 UI 라이브러리 설치 (shadcn/ui, Lucide React)
- [ ] Tailwind CSS 설정
- [ ] 컴포넌트 스타일 커스터마이징
- [ ] 접근성 테스트
