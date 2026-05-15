/**
 * DataTable Types
 *
 * DataTable 컴포넌트의 모든 타입 정의
 */
import { ReactNode } from "react";

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
export const DEFAULT_LABELS: Required<DataTableLabels> = {
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
export function formatLabel(template: string, values: Record<string, string | number>): string {
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
  /** 필터 모드: 'server'(기본값)는 서버 사이드, 'client'는 클라이언트 사이드 필터링 */
  filterMode?: 'server' | 'client';
  /** 클라이언트 사이드 필터링 함수 (filterMode === 'client'일 때 사용) */
  filterFn?: (item: any, value: any) => boolean;
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
  /** URL 쿼리 파라미터와 상태 동기화 (기본값: false) */
  syncWithUrl?: boolean;
}
