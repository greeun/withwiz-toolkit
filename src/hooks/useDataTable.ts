/**
 * useDataTable
 *
 * useDataTable 훅
 * - 커스텀 React 훅
 */
"use client";

import { useState, useCallback, useMemo } from 'react';
import { useDebounce } from './useDebounce';

export interface DataTableFilters {
  search?: string;
  [key: string]: any;
}

export interface DataTableSort {
  sort: string;
  order: 'asc' | 'desc';
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface UseDataTableOptions<T> {
  initialFilters?: DataTableFilters;
  initialSort?: DataTableSort;
  initialPagination?: Partial<DataTablePagination>;
  debounceMs?: number;
  onDataChange?: (params: {
    filters: DataTableFilters;
    sort: DataTableSort;
    pagination: DataTablePagination;
  }) => Promise<void>;
}

export interface UseDataTableReturn<T> {
  // 상태
  data: T[];
  loading: boolean;
  error: string | null;
  total: number;
  filters: DataTableFilters;
  sort: DataTableSort;
  pagination: DataTablePagination;
  selectedIds: string[];
  
  // 데이터 관리
  setData: (data: T[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTotal: (total: number) => void;
  
  // 필터 관리
  setFilters: (filters: DataTableFilters) => void;
  updateFilter: (key: string, value: any) => void;
  clearFilters: () => void;
  
  // 정렬 관리
  setSort: (sort: string, order?: 'asc' | 'desc') => void;
  
  // 페이지네이션 관리
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  
  // 선택 관리
  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // 액션
  refresh: () => Promise<void>;
  bulkAction: (action: (ids: string[]) => Promise<void>) => Promise<void>;
}

export function useDataTable<T>({
  initialFilters = {},
  initialSort = { sort: 'createdAt', order: 'desc' },
  initialPagination = { page: 1, pageSize: 10, total: 0 },
  debounceMs = 500,
  onDataChange,
}: UseDataTableOptions<T>): UseDataTableReturn<T> {
  // 상태
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(initialPagination.total || 0);
  const [filters, setFilters] = useState<DataTableFilters>(initialFilters);
  const [sort, setSortState] = useState<DataTableSort>(initialSort);
  const [pagination, setPaginationState] = useState<DataTablePagination>({
    page: initialPagination.page || 1,
    pageSize: initialPagination.pageSize || 10,
    total: initialPagination.total || 0,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 디바운스된 검색어
  const debouncedSearch = useDebounce(filters.search || '', debounceMs);

  // 데이터 새로고침
  const refresh = useCallback(async () => {
    if (!onDataChange) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await onDataChange({
        filters: { ...filters, search: debouncedSearch },
        sort,
        pagination,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch, sort, pagination, onDataChange]);

  // 필터 업데이트
  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    
    // 검색어가 아닌 필터는 즉시 페이지를 1로 리셋
    if (key !== 'search') {
      setPaginationState(prev => ({ ...prev, page: 1 }));
    }
  }, []);

  // 필터 초기화
  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, [initialFilters]);

  // 정렬 설정
  const setSort = useCallback((newSort: string, newOrder?: 'asc' | 'desc') => {
    setSortState(prev => {
      if (prev.sort === newSort) {
        return {
          sort: newSort,
          order: newOrder || (prev.order === 'asc' ? 'desc' : 'asc'),
        };
      }
      return {
        sort: newSort,
        order: newOrder || 'asc',
      };
    });
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  // 페이지 설정
  const setPage = useCallback((page: number) => {
    setPaginationState(prev => ({ ...prev, page }));
  }, []);

  // 페이지 크기 설정
  const setPageSize = useCallback((pageSize: number) => {
    setPaginationState(prev => ({ ...prev, pageSize, page: 1 }));
  }, []);

  // 선택 관리
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(data.map((item: any) => item.id));
  }, [data]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // 벌크 액션
  const bulkAction = useCallback(async (action: (ids: string[]) => Promise<void>) => {
    if (selectedIds.length === 0) return;
    
    setLoading(true);
    try {
      await action(selectedIds);
      setSelectedIds([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setLoading(false);
    }
  }, [selectedIds, refresh]);

  // 디바운스된 검색어 변경 시 자동 새로고침
  useMemo(() => {
    if (debouncedSearch !== filters.search) {
      setPaginationState(prev => ({ ...prev, page: 1 }));
    }
  }, [debouncedSearch, filters.search]);

  // 필터, 정렬, 페이지네이션 변경 시 자동 새로고침
  useMemo(() => {
    refresh();
  }, [debouncedSearch, sort.sort, sort.order, pagination.page, pagination.pageSize]);

  return {
    // 상태
    data,
    loading,
    error,
    total,
    filters,
    sort,
    pagination,
    selectedIds,
    
    // 데이터 관리
    setData,
    setLoading,
    setError,
    setTotal,
    
    // 필터 관리
    setFilters,
    updateFilter,
    clearFilters,
    
    // 정렬 관리
    setSort,
    
    // 페이지네이션 관리
    setPage,
    setPageSize,
    
    // 선택 관리
    setSelectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    
    // 액션
    refresh,
    bulkAction,
  };
}
