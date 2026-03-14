/**
 * DataTable
 *
 * DataTable 메인 오케스트레이터 컴포넌트
 * - shadcn/ui 기반 UI 컴포넌트
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { Alert, AlertDescription } from "../Alert";
import { cn } from "@withwiz/utils/client/client-utils";
import { DataTableSearch } from "./DataTableSearch";
import { DataTableFilters } from "./DataTableFilters";
import { DataTableBulkActions } from "./DataTableBulkActions";
import { DataTableBody } from "./DataTableBody";
import { DataTablePagination } from "./DataTablePagination";
import { DEFAULT_LABELS } from "./types";
import type { DataTableProps, BulkAction } from "./types";

export function DataTable<T>({
  data,
  columns,
  loading = false,
  error = null,
  pagination,
  sort,
  bulkActions = [] as const,
  filters = [] as const,
  filterValues = {},
  onFilterChange,
  onClearFilters,
  selectable = false,
  onSelectionChange,
  selectedIds = [] as const,
  getRowId,
  className,
  emptyMessage = "No data",
  searchPlaceholder = "Search...",
  onSearch,
  onSearchValueChange,
  searchValue = "",
  showFilters = false,
  onToggleFilters,
  createButton,
  labels: customLabels,
  syncWithUrl = false,
}: DataTableProps<T>) {
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setLocalSelectedIds(selectedIds);
  }, [selectedIds]);

  // 필터 활성 상태 확인
  const hasActiveFilters = useMemo(() => {
    if (searchValue && searchValue.trim()) return true;

    for (const [key, value] of Object.entries(filterValues)) {
      if (value === undefined || value === null || value === '') continue;
      if (value === 'all') continue;

      if (typeof value === 'object' && value !== null) {
        if (key === 'dateRange' && (value.start || value.end)) return true;
        if (key === 'clickRange' && (value.min || value.max)) return true;
        if (key === 'lastClickedRange' && (value.start || value.end)) return true;
      } else {
        if (key === 'activeFilter' && value !== 'all') return true;
        if (key === 'publicFilter' && value !== 'all') return true;
        if (key === 'expirationFilter' && value !== 'all') return true;
      }
    }
    return false;
  }, [searchValue, filterValues]);

  // URL 동기화
  useEffect(() => {
    if (!syncWithUrl || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    let changed = false;

    // 검색어 동기화
    if (searchValue) {
      if (params.get('search') !== searchValue) {
        params.set('search', searchValue);
        changed = true;
      }
    } else {
      if (params.has('search')) {
        params.delete('search');
        changed = true;
      }
    }

    // 정렬 동기화
    if (sort) {
      if (params.get('sort') !== sort.sort) {
        params.set('sort', sort.sort);
        changed = true;
      }
      if (params.get('order') !== sort.order) {
        params.set('order', sort.order);
        changed = true;
      }
    }

    // 페이지네이션 동기화
    if (pagination) {
      const pageStr = String(pagination.page);
      const pageSizeStr = String(pagination.pageSize);
      if (params.get('page') !== pageStr) {
        params.set('page', pageStr);
        changed = true;
      }
      if (params.get('pageSize') !== pageSizeStr) {
        params.set('pageSize', pageSizeStr);
        changed = true;
      }
    }

    if (changed) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [syncWithUrl, searchValue, sort?.sort, sort?.order, pagination?.page, pagination?.pageSize]);

  // 핸들러들
  const handleSelectAll = (checked: boolean) => {
    const newSelection = checked ? data.map(item => getRowId(item)) : [];
    setLocalSelectedIds(newSelection);
    onSelectionChange?.(newSelection);
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSelection = checked
      ? [...localSelectedIds, id]
      : localSelectedIds.filter(item => item !== id);
    setLocalSelectedIds(newSelection);
    onSelectionChange?.(newSelection);
  };

  const handleSort = (columnKey: string) => {
    if (!sort) return;
    if (sort.sort === columnKey) {
      sort.onSortChange(columnKey, sort.order === 'asc' ? 'desc' : 'asc');
    } else {
      sort.onSortChange(columnKey, 'asc');
    }
  };

  const handleBulkAction = async (action: BulkAction) => {
    if (localSelectedIds.length === 0 || bulkActionLoading) return;
    setBulkActionLoading(action.key);
    try {
      await action.onClick(localSelectedIds);
    } finally {
      setBulkActionLoading(null);
    }
  };

  const visibleColumns = columns.filter(col => !col.hidden);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Panel */}
      {(onSearch || createButton) && (
        <DataTableSearch
          onSearch={onSearch}
          onSearchValueChange={onSearchValueChange}
          searchValue={searchValue}
          searchPlaceholder={searchPlaceholder}
          labels={labels}
          filters={filters}
          onToggleFilters={onToggleFilters}
          showFilters={showFilters}
          hasActiveFilters={hasActiveFilters}
          pagination={pagination}
          createButton={createButton}
        />
      )}

      {/* Filter Panel */}
      {showFilters && filters.length > 0 && (
        <DataTableFilters
          filters={filters}
          filterValues={filterValues}
          onFilterChange={onFilterChange}
          onClearFilters={onClearFilters}
          hasActiveFilters={hasActiveFilters}
          labels={labels}
        />
      )}

      {/* Bulk Actions Bar */}
      {selectable && bulkActions.length > 0 && (
        <DataTableBulkActions
          bulkActions={bulkActions}
          localSelectedIds={localSelectedIds}
          dataLength={data.length}
          bulkActionLoading={bulkActionLoading}
          onSelectAll={handleSelectAll}
          onBulkAction={handleBulkAction}
          labels={labels}
        />
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <DataTableBody
        data={data}
        visibleColumns={visibleColumns}
        loading={loading}
        error={error}
        emptyMessage={emptyMessage}
        selectable={selectable}
        localSelectedIds={localSelectedIds}
        getRowId={getRowId}
        onSelectAll={handleSelectAll}
        onSelect={handleSelect}
        sort={sort}
        onSort={handleSort}
        labels={labels}
      />

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <DataTablePagination
          pagination={pagination}
          labels={labels}
        />
      )}
    </div>
  );
}
