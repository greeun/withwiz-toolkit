import { NextResponse } from 'next/server';

/** 페이지네이션 파라미터 파싱(범용). page≥1, pageSize 1~100. */
export function parsePaginationParams(sp: URLSearchParams) {
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '10', 10) || 10));
  return { page, pageSize };
}

/** 페이지네이션 메타데이터 생성. */
export function createPaginationMeta(total: number, page: number, pageSize: number) {
  return { total, page, pageSize, hasMore: total > page * pageSize };
}

/** 검색 파라미터 파싱. */
export function parseSearchParams(sp: URLSearchParams) {
  return { search: sp.get('search') || undefined };
}

/** 필수 파라미터 검증. 없으면 400 NextResponse, 있으면 null. */
export function requireParam(value: string | undefined | null, label: string): NextResponse | null {
  if (!value) return NextResponse.json({ success: false, error: { code: 40001, message: `${label} is required` } }, { status: 400 });
  return null;
}
