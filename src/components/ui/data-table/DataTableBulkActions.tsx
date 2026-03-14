/**
 * DataTableBulkActions
 *
 * 벌크 액션 바 서브 컴포넌트
 */
"use client";

import { Button } from "../Button";
import { CheckSquare, Square, Loader2 } from 'lucide-react';
import { LoadingBar } from "../loading-bar";
import type { BulkAction } from "./types";
import { formatLabel } from "./types";

export interface DataTableBulkActionsProps {
  bulkActions: BulkAction[];
  localSelectedIds: string[];
  dataLength: number;
  bulkActionLoading: string | null;
  onSelectAll: (checked: boolean) => void;
  onBulkAction: (action: BulkAction) => void;
  labels: {
    selectAll: string;
    selectAllShort: string;
    selected: string;
    processing: string;
    processingItems: string;
  };
}

export function DataTableBulkActions({
  bulkActions,
  localSelectedIds,
  dataLength,
  bulkActionLoading,
  onSelectAll,
  onBulkAction,
  labels,
}: DataTableBulkActionsProps) {
  return (
    <>
      <div className="flex flex-col gap-3 p-3 bg-muted rounded-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              data-testid="select-all-btn"
              variant="outline"
              size="sm"
              onClick={() => {
                const allSelected = localSelectedIds.length === dataLength && dataLength > 0;
                onSelectAll(!allSelected);
              }}
              className="flex items-center gap-1 h-9 px-3"
            >
              {localSelectedIds.length === dataLength && dataLength > 0 ?
                <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              <span className="hidden sm:inline">{labels.selectAll}</span>
              <span className="sm:hidden">{labels.selectAllShort}</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              {formatLabel(labels.selected, { count: localSelectedIds.length, total: dataLength })}
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
                  onClick={() => onBulkAction(action)}
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
    </>
  );
}
