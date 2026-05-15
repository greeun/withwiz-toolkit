/**
 * 범용 사용자 인터페이스
 * 프로젝트별 특화 필드는 상속받아 확장
 */
export interface IUser {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
  updatedAt?: string;
  isActive?: boolean;
  emailVerified?: Date | null;
  lastLoginAt?: string | null; // API 응답에서는 문자열로 받음
}

/**
 * 범용 사용자 생성 데이터
 */
export interface IUserCreateData {
  email: string;
  name?: string;
  password?: string;
}

/**
 * 범용 사용자 업데이트 데이터
 */
export interface IUserUpdateData {
  name?: string;
  email?: string;
  isActive?: boolean;
}

/**
 * 범용 사용자 필터
 */
export interface IUserFilters {
  search?: string;
  isActive?: string;
}

/**
 * 범용 사용자 정렬 옵션
 */
export interface IUserSortOptions {
  sort: string;
  order: 'asc' | 'desc';
}

/**
 * 범용 사용자 목록 결과
 */
export interface IUserListResult<T = IUser> {
  users: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
