/**
 * CSV Export — date-fns 의존 포맷터
 *
 * `csv-export.ts`에서 분리한 date-fns 의존 헬퍼.
 * `date-fns`를 설치한 호스트만 이 모듈을 import 하면 된다.
 * 의존을 import 하지 않는 한 csv-export 본체는 date-fns 없이도 동작한다.
 */

import { format as dateFnsFormat } from 'date-fns';

/**
 * 커스텀 날짜 포맷팅 (date-fns format 사용)
 */
export function customDateFormatter(
  date: Date | null | undefined,
  formatStr: string
): string {
  if (!date) return '';
  try {
    return dateFnsFormat(date, formatStr);
  } catch {
    return date.toISOString();
  }
}
