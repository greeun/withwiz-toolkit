/**
 * DataTableBody
 *
 * 테이블 본체 서브 컴포넌트 (thead + tbody)
 */
"use client";

import { useRef, useEffect } from "react";
import { cn } from "@withwiz/toolkit/react/utils/client-utils";
import { LoadingBar } from "@withwiz/toolkit/react/components/ui/loading-bar";
import type { ColumnDef, SortConfig } from "@withwiz/toolkit/react/components/ui/data-table/types";

export interface DataTableBodyProps<T> {
  data: T[];
  visibleColumns: ColumnDef<T>[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  selectable: boolean;
  localSelectedIds: string[];
  getRowId: (item: T) => string;
  onSelectAll: (checked: boolean) => void;
  onSelect: (id: string, checked: boolean) => void;
  sort?: SortConfig;
  onSort: (columnKey: string) => void;
  labels: {
    loading: string;
  };
}

export function DataTableBody<T>({
  data,
  visibleColumns,
  loading,
  error,
  emptyMessage,
  selectable,
  localSelectedIds,
  getRowId,
  onSelectAll,
  onSelect,
  sort,
  onSort,
  labels,
}: DataTableBodyProps<T>) {
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = localSelectedIds.length > 0 && localSelectedIds.length < data.length;
    }
  }, [localSelectedIds, data.length]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-w-full">
        <table className="w-full text-sm min-w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {selectable && (
                <th className="px-3 py-2 text-center font-medium w-12">
                  <div className="flex items-center justify-center">
                    <input
                      data-testid="select-all-checkbox"
                      type="checkbox"
                      ref={selectAllRef}
                      checked={data.length > 0 && localSelectedIds.length === data.length}
                      onChange={e => onSelectAll(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </div>
                </th>
              )}
              {visibleColumns.map(column => {
                const width = column.width === 'auto' ? undefined : column.width;
                return (
                  <th
                    key={column.key}
                    className={cn(
                      "px-2 py-2 font-medium first:pl-4 last:pr-4",
                      column.sortable && "cursor-pointer",
                      column.className,
                      column.responsive?.sm && "hidden sm:table-cell",
                      column.responsive?.md && "hidden md:table-cell",
                      column.responsive?.lg && "hidden lg:table-cell",
                      column.responsive?.xl && "hidden xl:table-cell"
                    )}
                    style={{
                      width: width,
                      minWidth: column.minWidth || width || undefined,
                      maxWidth: column.maxWidth || undefined,
                    }}
                    onClick={column.sortable ? () => onSort(column.key) : undefined}
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
                      <td className="px-3 py-3 text-center w-12">
                        <input
                          data-testid={`row-checkbox-${rowId}`}
                          type="checkbox"
                          checked={localSelectedIds.includes(rowId)}
                          onChange={e => onSelect(rowId, e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                    )}
                    {visibleColumns.map(column => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-2 py-3 overflow-hidden first:pl-4 last:pr-4",
                          column.className,
                          column.responsive?.sm && "hidden sm:table-cell",
                          column.responsive?.md && "hidden md:table-cell",
                          column.responsive?.lg && "hidden lg:table-cell",
                          column.responsive?.xl && "hidden xl:table-cell"
                        )}
                        style={{
                          maxWidth: column.maxWidth || column.width || undefined,
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
  );
}
