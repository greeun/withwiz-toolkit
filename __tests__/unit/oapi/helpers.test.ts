import { describe, it, expect } from 'vitest';
import { parsePaginationParams, createPaginationMeta, parseSearchParams, requireParam } from '../../../src/next/oapi/helpers';

describe('oapi helpers', () => {
  it('parsePaginationParams: 기본값 page1/pageSize10, max 100 클램프, 하한 1', () => {
    expect(parsePaginationParams(new URLSearchParams(''))).toEqual({ page: 1, pageSize: 10 });
    expect(parsePaginationParams(new URLSearchParams('page=3&pageSize=200'))).toEqual({ page: 3, pageSize: 100 });
    expect(parsePaginationParams(new URLSearchParams('page=0&pageSize=0'))).toEqual({ page: 1, pageSize: 10 });
  });
  it('createPaginationMeta: hasMore 계산', () => {
    expect(createPaginationMeta(25, 1, 10)).toEqual({ total: 25, page: 1, pageSize: 10, hasMore: true });
    expect(createPaginationMeta(10, 1, 10)).toEqual({ total: 10, page: 1, pageSize: 10, hasMore: false });
  });
  it('parseSearchParams: search 추출', () => {
    expect(parseSearchParams(new URLSearchParams('search=abc'))).toEqual({ search: 'abc' });
    expect(parseSearchParams(new URLSearchParams(''))).toEqual({ search: undefined });
  });
  it('requireParam: 빈 값 → 400 NextResponse, 값 있으면 null', () => {
    const r = requireParam('', 'id');
    expect(r).not.toBeNull();
    expect(r!.status).toBe(400);
    expect(requireParam('x', 'id')).toBeNull();
  });
});
