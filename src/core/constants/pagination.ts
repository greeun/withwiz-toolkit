/**
 * 페이지네이션 관련 상수
 */

// 기본 페이지네이션 설정
export const PAGINATION = {
  // 기본 페이지 크기
  DEFAULT_PAGE_SIZE: 10,
  // 최대 페이지 크기
  MAX_PAGE_SIZE: 100,
  // 최소 페이지 크기
  MIN_PAGE_SIZE: 1,
  // 기본 시작 페이지
  DEFAULT_PAGE: 1,
} as const;

// 리소스별 페이지 크기 (보편 케이스만)
export const PAGE_SIZES = {
  // 사용자 목록
  USERS: 20,
  // 활동 내역
  ACTIVITY: 20,
  // 검색 결과
  SEARCH_RESULTS: 10,
} as const;

// 정렬 옵션
export const SORT_OPTIONS = {
  // 기본 정렬 필드
  DEFAULT_FIELD: 'createdAt',
  // 기본 정렬 방향
  DEFAULT_ORDER: 'desc' as const,
  // 허용되는 정렬 방향
  ALLOWED_ORDERS: ['asc', 'desc'] as const,
} as const;

// 필터 옵션
export const FILTER_OPTIONS = {
  // 기본 필터
  DEFAULT: 'all',
  // 활성 상태 필터
  ACTIVE_FILTER: {
    ALL: 'all',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  },
  // 공개 상태 필터
  PUBLIC_FILTER: {
    ALL: 'all',
    PUBLIC: 'public',
    PRIVATE: 'private',
  },
} as const;

// 날짜 범위 필터
export const DATE_RANGE = {
  // 최근 N일
  LAST_7_DAYS: 7,
  LAST_30_DAYS: 30,
  LAST_90_DAYS: 90,
  LAST_365_DAYS: 365,
} as const;
