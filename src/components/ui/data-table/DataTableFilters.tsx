/**
 * DataTableFilters
 *
 * 필터 패널 서브 컴포넌트
 */
"use client";

import { Button } from "../Button";
import { Input } from "../Input";
import { Label } from "../Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Select";
import { RefreshCw } from 'lucide-react';
import { cn } from "@withwiz/utils/client/client-utils";
import type { FilterConfig } from "./types";

export interface DataTableFiltersProps {
  filters: FilterConfig[];
  filterValues: Record<string, any>;
  onFilterChange?: (key: string, value: any) => void;
  onClearFilters?: () => void;
  hasActiveFilters: boolean;
  labels: {
    all: string;
    min: string;
    max: string;
    clearFilters: string;
  };
}

export function DataTableFilters({
  filters,
  filterValues,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  labels,
}: DataTableFiltersProps) {
  return (
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
  );
}
