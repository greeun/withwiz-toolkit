/**
 * DataTable
 *
 * 하위 호환성을 위한 re-export wrapper
 * 실제 구현은 ./data-table/ 디렉토리에 위치
 */
export { DataTable } from "./data-table";
export type {
  DataTableLabels,
  ColumnDef,
  BulkAction,
  FilterConfig,
  PaginationConfig,
  SortConfig,
  DataTableProps,
} from "./data-table";
