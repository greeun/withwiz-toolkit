/**
 * DataTable
 *
 * DataTable Component
 * - shadcn/ui 기반 UI 컴포넌트
 */
"use client";

import { useState, useRef, useEffect, ReactNode, isValidElement } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Label } from "./Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Alert, AlertDescription } from "./Alert";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./Pagination";
import { Tooltip, TooltipTrigger, TooltipContent } from "./Tooltip";
import { Filter, CheckSquare, Square, RefreshCw, Loader2 } from 'lucide-react';
import { LoadingBar } from "./loading-bar";
import { cn } from "@withwiz/utils/client/client-utils";

// i18n Labels 타입 정의
export interface DataTableLabels {
  search?: string;
  filter?: string;
  filterActive?: string;
  clearFilters?: string;
  selectAll?: string;
  selectAllShort?: string;
  selected?: string;           // "{count} / {total} selected" 형식
  processing?: string;
  processingItems?: string;    // "Processing {count} items..."
  loading?: string;
  perPage?: string;            // "{size} per page"
  all?: string;
  min?: string;
  max?: string;
  previous?: string;
  next?: string;
  showing?: string;            // "Showing {start} to {end} of {total} results"
}

// 기본 영어 Labels
const DEFAULT_LABELS: Required<DataTableLabels> = {
  search: "Search",
  filter: "Filter",
  filterActive: "Active",
  clearFilters: "Clear Filters",
  selectAll: "Select All",
  selectAllShort: "All",
  selected: "{count} / {total} selected",
  processing: "Processing...",
  processingItems: "Processing {count} items...",
  loading: "Loading data...",
  perPage: "{size} per page",
  all: "All",
  min: "Min",
  max: "Max",
  previous: "Previous",
  next: "Next",
  showing: "Showing {start} to {end} of {total} results"
};

// 템플릿 문자열 치환 헬퍼
function formatLabel(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template
  );
}

// 타입 정의
export interface ColumnDef<T> {
  key: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
  hidden?: boolean;
  responsive?: {
    sm?: boolean;
    md?: boolean;
    lg?: boolean;
    xl?: boolean;
  };
}

export interface BulkAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  onClick: (selectedIds: string[]) => Promise<void>;
  disabled?: (selectedIds: string[]) => boolean;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'switch' | 'range';
  options?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  inputType?: 'text' | 'number' | 'date';
  minPlaceholder?: string;
  maxPlaceholder?: string;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface SortConfig {
  sort: string;
  order: 'asc' | 'desc';
  onSortChange: (sort: string, order: 'asc' | 'desc') => void;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  error?: string | null;
  pagination?: PaginationConfig;
  sort?: SortConfig;
  bulkActions?: BulkAction[];
  filters?: FilterConfig[];
  filterValues?: Record<string, any>;
  onFilterChange?: (key: string, value: any) => void;
  onClearFilters?: () => void;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  selectedIds?: string[];
  getRowId: (item: T) => string;
  className?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  onSearch?: (search: string) => void;
  onSearchValueChange?: (searchValue: string) => void;
  searchValue?: string;
  showFilters?: boolean;
  onToggleFilters?: (show: boolean) => void;
  createButton?: ReactNode | {
    label: string;
    onClick: () => void;
  };
  /** i18n labels - 미제공 시 영어 기본값 사용 */
  labels?: Partial<DataTableLabels>;
}

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
}: DataTableProps<T>) {
  // Labels 병합 (커스텀 > 기본값)
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // 선택된 ID들을 부모 컴포넌트와 동기화
  useEffect(() => {
    setLocalSelectedIds(selectedIds);
  }, [selectedIds]);

  // Select all 상태 관리
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = localSelectedIds.length > 0 && localSelectedIds.length < data.length;
    }
  }, [localSelectedIds, data.length]);

  // 필터 활성 상태 확인 - 기존 LinkTableNew와 정확히 동일한 로직
  const hasActiveFilters = (() => {
    // 검색어 체크
    if (searchValue && searchValue.trim()) return true;
    
    // 필터 값들 체크 - 기존 LinkTableNew의 hasActiveFilters 로직과 동일
    for (const [key, value] of Object.entries(filterValues)) {
      if (value === undefined || value === null || value === '') continue;
      if (value === 'all') continue;
      
      // 객체인 경우 (range 필터들)
      if (typeof value === 'object' && value !== null) {
        // dateRange 체크
        if (key === 'dateRange' && (value.start || value.end)) return true;
        // clickRange 체크  
        if (key === 'clickRange' && (value.min || value.max)) return true;
        // lastClickedRange 체크
        if (key === 'lastClickedRange' && (value.start || value.end)) return true;
      } else {
        // 문자열 값들 - 기존 로직과 동일
        if (key === 'activeFilter' && value !== 'all') return true;
        if (key === 'publicFilter' && value !== 'all') return true;
        if (key === 'expirationFilter' && value !== 'all') return true;
      }
    }
    return false;
  })();

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

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchValue);
    }
  };

  const handleSearchClick = () => {
    if (onSearch) {
      onSearch(searchValue);
    }
  };

  // 검색 입력값 변경 시에는 검색값만 업데이트 (디바운스 없음)
  const handleSearchInputChange = (value: string) => {
    // 검색값만 업데이트하고 실제 검색은 실행하지 않음
    // onSearch는 엔터키나 버튼 클릭 시에만 호출됨
    if (onSearchValueChange) {
      onSearchValueChange(value);
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

  // 표시할 컬럼들 필터링
  const visibleColumns = columns.filter(col => !col.hidden);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Panel */}
      {(onSearch || createButton) && (
        <div className="flex flex-col gap-3 p-3 bg-muted rounded-lg">
          <div className="flex flex-row items-center gap-2">
            {onSearch && (
              <div className="relative flex-1 min-w-0">
                <Input
                  data-testid="search-input"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={e => handleSearchInputChange(e.target.value)}
                  onKeyPress={handleSearch}
                  className="min-w-0 pr-20 h-10"
                />
                <Button
                  data-testid="search-btn"
                  size="sm"
                  onClick={handleSearchClick}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 px-3 text-sm"
                >
                  {labels.search}
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 flex-shrink-0">
              {filters.length > 0 && onToggleFilters && (
                <Button
                  data-testid="filter-toggle-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleFilters(!showFilters)}
                  className="flex items-center gap-1 h-10 px-3"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">{labels.filter}</span>
                  {hasActiveFilters && (
                    <span className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                      {labels.filterActive}
                    </span>
                  )}
                </Button>
              )}
              {pagination && (
                <select
                  data-testid="page-size-select"
                  value={pagination.pageSize}
                  onChange={e => pagination.onPageSizeChange(Number(e.target.value))}
                  className="border rounded px-3 py-2 text-sm bg-background h-10 min-w-[100px]"
                >
                  {(pagination.pageSizeOptions || [10, 20, 50]).map(size => (
                    <option key={size} value={size}>{formatLabel(labels.perPage, { size })}</option>
                  ))}
                </select>
              )}
              {createButton && (
                isValidElement(createButton) ? createButton : (
                  <Button
                    data-testid="create-btn"
                    onClick={(createButton as { label: string; onClick: () => void }).onClick}
                    variant="default"
                    size="sm"
                    className="flex-shrink-0 h-10 px-3"
                  >
                    {(createButton as { label: string; onClick: () => void }).label}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && filters.length > 0 && (
        <div className="p-2 bg-muted/50 rounded-lg space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filters.map(filter => (
              <div key={filter.key} className={cn("space-y-1", filter.className)}>
                <Label className="text-sm font-medium">{filter.label}</Label>
                {filter.type === 'text' && (
                  <Input
                    data-testid={`filter-${filter.key}`}
                    type="text"
                    value={filterValues[filter.key] || ''}
                    onChange={e => onFilterChange?.(filter.key, e.target.value)}
                    placeholder={filter.placeholder}
                    className="text-xs"
                  />
                )}
                {filter.type === 'select' && (
                  <Select
                    value={filterValues[filter.key] || 'all'}
                    onValueChange={value => onFilterChange?.(filter.key, value)}
                  >
                    <SelectTrigger data-testid={`filter-${filter.key}`} className="text-xs w-full h-9">
                      <SelectValue placeholder={filter.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{labels.all}</SelectItem>
                      {filter.options?.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filter.type === 'date' && (
                  <Input
                    type="date"
                    value={filterValues[filter.key] || ''}
                    onChange={e => onFilterChange?.(filter.key, e.target.value)}
                    className="text-xs"
                  />
                )}
                {filter.type === 'number' && (
                  <Input
                    type="number"
                    value={filterValues[filter.key] || ''}
                    onChange={e => onFilterChange?.(filter.key, e.target.value)}
                    placeholder={filter.placeholder}
                    className="text-xs"
                  />
                )}
                {filter.type === 'range' && (
                  <div className="flex gap-2">
                    <Input
                      type={filter.inputType || 'text'}
                      value={filterValues[filter.key]?.min || filterValues[filter.key]?.start || ''}
                      onChange={e => {
                        const currentValue = filterValues[filter.key] || {};
                        const newValue = filter.key.includes('date') || filter.key.includes('Date')
                          ? { ...currentValue, start: e.target.value }
                          : { ...currentValue, min: e.target.value };
                        onFilterChange?.(filter.key, newValue);
                      }}
                      className="text-xs"
                      placeholder={filter.minPlaceholder || labels.min}
                    />
                    <Input
                      type={filter.inputType || 'text'}
                      value={filterValues[filter.key]?.max || filterValues[filter.key]?.end || ''}
                      onChange={e => {
                        const currentValue = filterValues[filter.key] || {};
                        const newValue = filter.key.includes('date') || filter.key.includes('Date')
                          ? { ...currentValue, end: e.target.value }
                          : { ...currentValue, max: e.target.value };
                        onFilterChange?.(filter.key, newValue);
                      }}
                      className="text-xs"
                      placeholder={filter.maxPlaceholder || labels.max}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Clear Filters Button */}
          {hasActiveFilters && onClearFilters && (
            <div className="flex justify-end">
              <Button
                data-testid="clear-filters-btn"
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {labels.clearFilters}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectable && bulkActions.length > 0 && (
        <div className="flex flex-col gap-3 p-3 bg-muted rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                data-testid="select-all-btn"
                variant="outline"
                size="sm"
                onClick={() => {
                  const allSelected = localSelectedIds.length === data.length && data.length > 0;
                  handleSelectAll(!allSelected);
                }}
                className="flex items-center gap-1 h-9 px-3"
              >
                {localSelectedIds.length === data.length && data.length > 0 ?
                  <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                <span className="hidden sm:inline">{labels.selectAll}</span>
                <span className="sm:hidden">{labels.selectAllShort}</span>
              </Button>
              <span className="text-sm text-muted-foreground">
                {formatLabel(labels.selected, { count: localSelectedIds.length, total: data.length })}
              </span>
            </div>
          </div>
          
          {/* Action Buttons */}
          {localSelectedIds.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {bulkActions.map(action => {
                const isLoading = bulkActionLoading === action.key;
                const isDisabled = !!bulkActionLoading || action.disabled?.(localSelectedIds) || localSelectedIds.length === 0;
                return (
                  <Button
                    key={action.key}
                    data-testid={`bulk-action-${action.key}`}
                    variant={action.variant || "outline"}
                    size="sm"
                    onClick={() => handleBulkAction(action)}
                    disabled={isDisabled}
                    className="flex items-center gap-1 h-9 text-xs"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      action.icon
                    )}
                    <span className="hidden sm:inline">
                      {isLoading ? labels.processing : action.label}
                    </span>
                    <span className="sm:hidden">
                      {isLoading ? '...' : action.label.split(' ')[0]}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bulk Action Progress */}
      {bulkActionLoading && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {formatLabel(labels.processingItems, { count: localSelectedIds.length })}
            </span>
          </div>
          <LoadingBar size="sm" variant="primary" className="mt-2" />
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-sm min-w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {selectable && (
                <th className="px-1 py-2 text-left font-medium w-8">
                  <input
                    data-testid="select-all-checkbox"
                    type="checkbox"
                    ref={selectAllRef}
                    checked={data.length > 0 && localSelectedIds.length === data.length}
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="h-4 w-4"
                  />
                </th>
              )}
              {visibleColumns.map(column => {
                const width = column.width === 'auto' ? undefined : column.width;
                const minWidth = (column as any).minWidth;
                return (
                  <th
                    key={column.key}
                    className={cn(
                      "px-2 py-2 font-medium",
                      column.sortable && "cursor-pointer",
                      column.className,
                      column.responsive?.sm && "hidden sm:table-cell",
                      column.responsive?.md && "hidden md:table-cell",
                      column.responsive?.lg && "hidden lg:table-cell",
                      column.responsive?.xl && "hidden xl:table-cell"
                    )}
                    style={{ 
                      width: width,
                      minWidth: minWidth || width || undefined,
                      maxWidth: (column as any).maxWidth || undefined,
                    }}
                    onClick={column.sortable ? () => handleSort(column.key) : undefined}
                  >
                  <div className="flex items-center justify-center gap-1">
                    {column.header}
                    {column.sortable && sort && sort.sort === column.key && (
                      <span>{sort.order === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="text-center py-8"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <LoadingBar size="md" variant="primary" className="w-64" />
                    <p className="text-sm text-muted-foreground">{labels.loading}</p>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td 
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)} 
                  className="text-center py-8 text-destructive"
                >
                  {error}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td 
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)} 
                  className="text-center py-8 text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map(item => {
                const rowId = getRowId(item);
                return (
                  <tr
                    key={rowId}
                    className={cn(
                      "border-b last:border-0 hover:bg-muted/30",
                      localSelectedIds.includes(rowId) && "bg-primary/5"
                    )}
                  >
                    {selectable && (
                      <td className="px-1 py-2 w-8">
                        <input
                          data-testid={`row-checkbox-${rowId}`}
                          type="checkbox"
                          checked={localSelectedIds.includes(rowId)}
                          onChange={e => handleSelect(rowId, e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                    )}
                    {visibleColumns.map(column => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-2 py-3 overflow-hidden",
                          column.className,
                          column.responsive?.sm && "hidden sm:table-cell",
                          column.responsive?.md && "hidden md:table-cell",
                          column.responsive?.lg && "hidden lg:table-cell",
                          column.responsive?.xl && "hidden xl:table-cell"
                        )}
                        style={{
                          maxWidth: (column as any).maxWidth || column.width || undefined,
                        }}
                      >
                        {column.cell ? 
                          column.cell(item) : 
                          column.accessorKey ? 
                            String(item[column.accessorKey] || '') : 
                            ''
                        }
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
          <Pagination className="w-full">
            <PaginationContent className="flex-wrap gap-1 justify-between w-full items-center">
              {/* Results Info */}
              <div className="text-sm text-muted-foreground text-center sm:text-left whitespace-nowrap">
                {formatLabel(labels.showing, {
                  start: ((pagination.page - 1) * pagination.pageSize) + 1,
                  end: Math.min(pagination.page * pagination.pageSize, pagination.total),
                  total: pagination.total
                })}
              </div>
              
              {/* Previous Button */}
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    if (pagination.page > 1) pagination.onPageChange(pagination.page - 1);
                  }}
                  className={pagination.page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <span className="hidden sm:inline">{labels.previous}</span>
                  <span className="sm:hidden">←</span>
                </PaginationPrevious>
              </PaginationItem>
              
              {/* Page Numbers - Hidden on mobile */}
              <div className="hidden sm:flex">
                {(() => {
                  const totalPages = Math.ceil(pagination.total / pagination.pageSize);
                  const pages = [];
                  if (pagination.page > 3) {
                    pages.push(
                      <PaginationItem key={1}>
                        <PaginationLink
                          href="#"
                          onClick={e => {
                            e.preventDefault();
                            pagination.onPageChange(1);
                          }}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                    );
                    if (pagination.page > 4) {
                      pages.push(
                        <PaginationItem key="ellipsis1">
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                  }
                  for (let i = Math.max(1, pagination.page - 2); i <= Math.min(totalPages, pagination.page + 2); i++) {
                    pages.push(
                      <PaginationItem key={i}>
                        <PaginationLink
                          href="#"
                          isActive={i === pagination.page}
                          onClick={e => {
                            e.preventDefault();
                            pagination.onPageChange(i);
                          }}
                        >
                          {i}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                  if (pagination.page < totalPages - 2) {
                    if (pagination.page < totalPages - 3) {
                      pages.push(
                        <PaginationItem key="ellipsis2">
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    pages.push(
                      <PaginationItem key={totalPages}>
                        <PaginationLink
                          href="#"
                          onClick={e => {
                            e.preventDefault();
                            pagination.onPageChange(totalPages);
                          }}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                  return pages;
                })()}
              </div>
              
              {/* Current Page - Mobile only */}
              <div className="sm:hidden">
                <span className="px-3 py-2 text-sm font-medium">
                  {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}
                </span>
              </div>
              
              {/* Next Button */}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    const totalPages = Math.ceil(pagination.total / pagination.pageSize);
                    if (pagination.page < totalPages) pagination.onPageChange(pagination.page + 1);
                  }}
                  className={pagination.page >= Math.ceil(pagination.total / pagination.pageSize) ? "pointer-events-none opacity-50" : ""}
                >
                  <span className="hidden sm:inline">{labels.next}</span>
                  <span className="sm:hidden">→</span>
                </PaginationNext>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
