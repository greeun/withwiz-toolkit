# Shared Hooks

이 폴더는 다른 프로젝트에서 재사용할 수 있는 React 훅들을 포함합니다.

## 🎣 훅 목록

### useDataTable
데이터 테이블의 상태 관리를 위한 훅입니다.

**특징:**
- 필터링, 정렬, 페이지네이션 상태 관리
- 선택 기능
- 디바운스된 검색
- 자동 새로고침

**사용법:**
```tsx
import { useDataTable } from '@/shared/hooks/useDataTable';

const {
  data,
  loading,
  error,
  total,
  filters,
  sort,
  pagination,
  selectedIds,
  setData,
  setLoading,
  setError,
  setTotal,
  updateFilter,
  clearFilters,
  setSort,
  setPage,
  setPageSize,
  setSelectedIds,
  toggleSelection,
  selectAll,
  clearSelection,
  refresh,
  bulkAction
} = useDataTable({
  initialFilters: { search: '' },
  initialSort: { sort: 'createdAt', order: 'desc' },
  initialPagination: { page: 1, pageSize: 10, total: 0 },
  debounceMs: 500,
  onDataChange: async ({ filters, sort, pagination }) => {
    // API 호출 로직
    const response = await fetchData({
      ...filters,
      ...sort,
      ...pagination
    });
    
    setData(response.data);
    setTotal(response.total);
  }
});
```

### useDebounce
입력값의 디바운싱을 위한 훅입니다.

**특징:**
- 지정된 지연 시간 후에 값 업데이트
- 검색 입력에 유용

**사용법:**
```tsx
import { useDebounce } from '@/shared/hooks/useDebounce';

const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 500);

useEffect(() => {
  if (debouncedSearchTerm) {
    // 검색 API 호출
    performSearch(debouncedSearchTerm);
  }
}, [debouncedSearchTerm]);
```

### useTimezone
타임존 정보를 관리하는 훅입니다.

**특징:**
- 사용자 브라우저의 타임존 정보 제공
- 오프셋 정보 포함
- 실시간 업데이트

**사용법:**
```tsx
import { useTimezone } from '@withwiz/hooks/useTimezone';

const {
  timezone,
  offset,
  offsetFormatted,
  isLoading
} = useTimezone();

if (isLoading) {
  return <div>타임존 정보 로딩 중...</div>;
}

return (
  <div>
    <p>타임존: {timezone}</p>
    <p>오프셋: {offsetFormatted}</p>
  </div>
);
```

### useExitIntent
Exit Intent 감지 훅입니다.

**특징:**
- 마우스가 브라우저 상단 영역을 벗어날 때 감지
- 쿨다운 및 영구 해제 기능
- localStorage 기반 상태 저장

**사용법:**
```tsx
import { useExitIntent } from '@withwiz/hooks/useExitIntent';

const { showPopup, closePopup, dismissForever } = useExitIntent({
  cooldown: 86400000, // 24시간
  delay: 5000,        // 5초 후 활성화
  storageKey: 'my-popup',
});

if (showPopup) {
  return <Modal onClose={closePopup} onDismiss={dismissForever} />;
}
```

## 📋 체크리스트

- [ ] React 18+ 버전 확인
- [ ] 필요한 의존성 설치
- [ ] 훅 사용법 테스트
- [ ] 메모리 누수 방지 확인
