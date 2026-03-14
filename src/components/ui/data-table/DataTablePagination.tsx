/**
 * DataTablePagination
 *
 * 페이지네이션 서브 컴포넌트
 */
"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../Pagination";
import type { PaginationConfig } from "./types";
import { formatLabel } from "./types";

export interface DataTablePaginationProps {
  pagination: PaginationConfig;
  labels: {
    showing: string;
    previous: string;
    next: string;
  };
}

export function DataTablePagination({
  pagination,
  labels,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
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
              {pagination.page} / {totalPages}
            </span>
          </div>

          {/* Next Button */}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={e => {
                e.preventDefault();
                if (pagination.page < totalPages) pagination.onPageChange(pagination.page + 1);
              }}
              className={pagination.page >= totalPages ? "pointer-events-none opacity-50" : ""}
            >
              <span className="hidden sm:inline">{labels.next}</span>
              <span className="sm:hidden">→</span>
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
