/**
 * 숫자를 포맷팅하여 표시합니다.
 * - 999,999 이하: 그대로 표시 (예: 999,999)
 * - 1,000,000 ~ 9,999,999: 그대로 표시 (예: 1,234,567)
 * - 10,000,000 이상: 줄여서 표시 (예: 10.5M)
 * 
 * @param num - 포맷팅할 숫자
 * @returns 포맷팅된 문자열
 */
export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) {
    return '-';
  }

  // Convert string to number if needed
  const numericValue = typeof num === 'string' ? parseFloat(num) : num;

  // Handle special cases
  if (isNaN(numericValue)) {
    return 'NaN';
  }

  if (!isFinite(numericValue)) {
    return numericValue > 0 ? 'Infinity' : '-Infinity';
  }

  // Handle negative numbers
  const isNegative = numericValue < 0;
  const absNum = Math.abs(numericValue);

  if (absNum < 1000) {
    return numericValue.toString();
  }

  if (absNum < 1000000) {
    return numericValue.toLocaleString();
  }

  if (absNum < 10000000) {
    return numericValue.toLocaleString();
  }

  // 10M 이상은 M 단위로 표시
  const formatted = (absNum / 1000000).toFixed(1) + 'M';
  return isNegative ? '-' + formatted : formatted;
}

/**
 * 차트용 숫자 포맷팅 함수
 * 
 * @param num - 포맷팅할 숫자
 * @returns 포맷팅된 문자열
 */
export function formatChartNumber(num: number | null | undefined): string {
  return formatNumber(num);
}
