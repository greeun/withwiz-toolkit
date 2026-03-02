/**
 * CSV Export Utilities
 *
 * CSV 내보내기 공통 유틸리티
 * - 스트리밍 CSV 생성
 * - 배치 처리
 * - 타입 안전한 데이터 변환
 *
 * @created 2025-11-27
 */

import { format as dateFnsFormat } from 'date-fns';
import { NextResponse } from 'next/server';
import { logger } from '@withwiz/logger/logger';

// ==================== Types ====================

/**
 * CSV 컬럼 정의
 */
export interface CsvColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | boolean | null | undefined);
}

/**
 * CSV Export 옵션
 */
export interface CsvExportOptions<T> {
  /** CSV 파일명 (확장자 제외) */
  filename: string;
  /** 컬럼 정의 */
  columns: CsvColumn<T>[];
  /** BOM 추가 여부 (Excel 호환성) */
  includeBom?: boolean;
  /** 로깅용 컨텍스트 */
  logContext?: Record<string, unknown>;
}

/**
 * 배치 Export 옵션
 */
export interface BatchExportOptions<T> extends CsvExportOptions<T> {
  /** 배치 크기 */
  batchSize?: number;
  /** 데이터 페처 함수 */
  fetcher: (cursor?: string) => Promise<{ data: T[]; nextCursor?: string }>;
}

// ==================== Utilities ====================

/**
 * CSV 필드 이스케이프
 * - 쌍따옴표를 이스케이프
 * - 필드를 쌍따옴표로 감싸기
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * 컬럼 정의로부터 값 추출
 */
function getColumnValue<T>(row: T, column: CsvColumn<T>): string {
  const value = typeof column.accessor === 'function'
    ? column.accessor(row)
    : row[column.accessor];
  return escapeCsvField(value);
}

/**
 * 데이터 행을 CSV 문자열로 변환
 */
export function rowToCsv<T>(row: T, columns: CsvColumn<T>[]): string {
  return columns.map(col => getColumnValue(row, col)).join(',');
}

/**
 * 헤더 행 생성
 */
export function createCsvHeader<T>(columns: CsvColumn<T>[]): string {
  return columns.map(col => escapeCsvField(col.header)).join(',');
}

// ==================== Simple Export ====================

/**
 * 간단한 CSV Export (메모리에 모든 데이터 로드)
 * - 소규모 데이터에 적합
 * - 최대 10,000 rows 권장
 */
export function createSimpleCsvResponse<T>(
  data: T[],
  options: CsvExportOptions<T>
): NextResponse {
  const { filename, columns, includeBom = true, logContext } = options;

  try {
    // 헤더 생성
    const header = createCsvHeader(columns);

    // 데이터 행 생성
    const rows = data.map(row => rowToCsv(row, columns));

    // CSV 조합
    const csv = [header, ...rows].join('\r\n');
    const content = includeBom ? '\uFEFF' + csv : csv;

    logger.info('CSV export completed', {
      filename,
      rowCount: data.length,
      ...logContext
    });

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    logger.error('CSV export error', { error, filename, ...logContext });
    throw error;
  }
}

// ==================== Streaming Export ====================

/**
 * 스트리밍 CSV Export (대용량 데이터)
 * - 배치 처리로 메모리 효율적
 * - 대규모 데이터에 적합
 */
export function createStreamingCsvResponse<T>(
  options: BatchExportOptions<T>
): NextResponse {
  const {
    filename,
    columns,
    batchSize = 1000,
    fetcher,
    includeBom = true,
    logContext
  } = options;

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // 비동기로 데이터 처리
  (async () => {
    try {
      // BOM + 헤더 작성
      const header = createCsvHeader(columns);
      const headerContent = includeBom ? '\uFEFF' + header + '\r\n' : header + '\r\n';
      await writer.write(encoder.encode(headerContent));

      let cursor: string | undefined;
      let totalCount = 0;
      let batchCount = 0;

      // 배치 단위로 데이터 조회 및 스트리밍
      while (true) {
        const { data, nextCursor } = await fetcher(cursor);

        if (data.length === 0) break;

        // 배치 데이터를 CSV 형식으로 변환하여 스트리밍
        const csvRows = data.map(row => rowToCsv(row, columns));
        await writer.write(encoder.encode(csvRows.join('\r\n') + '\r\n'));

        totalCount += data.length;
        batchCount++;
        cursor = nextCursor;

        // 배치 진행 로그
        logger.debug('Export batch processed', {
          filename,
          batchNumber: batchCount,
          batchSize: data.length,
          totalProcessed: totalCount,
          ...logContext
        });

        // 마지막 배치인 경우 종료
        if (data.length < batchSize || !nextCursor) break;
      }

      logger.info('Streaming CSV export completed', {
        filename,
        totalCount,
        batchCount,
        ...logContext
      });

      await writer.close();
    } catch (error) {
      logger.error('Streaming CSV export error', { error, filename, ...logContext });
      await writer.abort(error);
    }
  })();

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.csv"`,
      'Transfer-Encoding': 'chunked'
    }
  });
}

// ==================== Utility Helpers ====================

/**
 * 날짜 포맷팅 헬퍼
 */
export const dateFormatter = {
  /** ISO 형식 (YYYY-MM-DD) */
  iso: (date: Date | null | undefined): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  },

  /** 한국어 형식 */
  korean: (date: Date | null | undefined): string => {
    if (!date) return '';
    return date.toLocaleString('ko-KR');
  },

  /** 영어 형식 */
  english: (date: Date | null | undefined): string => {
    if (!date) return '';
    return date.toLocaleString('en-US');
  },

  /** 커스텀 형식 (date-fns 사용) */
  custom: (date: Date | null | undefined, formatStr: string): string => {
    if (!date) return '';
    // date-fns format 사용 시
    try {
      return dateFnsFormat(date, formatStr);
    } catch {
      return date.toISOString();
    }
  }
};

/**
 * Boolean 포맷팅 헬퍼
 */
export const boolFormatter = {
  /** Active/Inactive */
  activeInactive: (value: boolean): string => value ? 'Active' : 'Inactive',

  /** Yes/No */
  yesNo: (value: boolean): string => value ? 'Yes' : 'No',

  /** 1/0 */
  numeric: (value: boolean): string => value ? '1' : '0',

  /** Verified/Not Verified */
  verified: (value: boolean): string => value ? 'Verified' : 'Not Verified',

  /** 한국어 */
  korean: (value: boolean): string => value ? '예' : '아니오'
};
