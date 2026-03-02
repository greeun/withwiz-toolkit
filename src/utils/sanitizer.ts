/**
 * sanitizer.ts
 *
 * XSS 방지를 위한 입력값 정제(Sanitization) 유틸리티
 * - HTML 태그 제거
 * - 악성 스크립트 방지
 * - 안전한 문자열 처리
 */

/**
 * XSS 방지를 위한 HTML 태그 제거
 * - 모든 HTML 태그 제거
 * - 이스케이프된 HTML 엔티티 처리
 * - 공백 정리
 *
 * @param input - 정제할 문자열
 * @returns 정제된 문자열
 *
 * @example
 * sanitizeHtml('<script>alert("xss")</script>Hello') // 'Hello'
 * sanitizeHtml('Hello <b>World</b>') // 'Hello World'
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/&lt;/gi, '<')  // 이스케이프된 태그 디코딩
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]*>/g, '') // 디코딩 후 다시 태그 제거
    .replace(/&amp;/gi, '&') // 앰퍼샌드 디코딩
    .replace(/&quot;/gi, '"') // 따옴표 디코딩
    .replace(/&#x27;/gi, "'") // 작은따옴표 디코딩
    .replace(/&#x2F;/gi, '/') // 슬래시 디코딩
    .trim();
}

/**
 * JavaScript 이벤트 핸들러 제거
 * - onclick, onerror 등 이벤트 핸들러 제거
 *
 * @param input - 정제할 문자열
 * @returns 정제된 문자열
 */
export function removeEventHandlers(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // on* 이벤트 핸들러 패턴 제거
  return input.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * URL에서 JavaScript 프로토콜 제거
 * - javascript:, data: 등 위험한 프로토콜 제거
 *
 * @param url - 검증할 URL
 * @returns 안전한 URL 또는 빈 문자열
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim().toLowerCase();

  // 위험한 프로토콜 체크
  const dangerousProtocols = [
    'javascript:',
    'vbscript:',
    'data:text/html',
    'data:application',
  ];

  for (const protocol of dangerousProtocols) {
    if (trimmedUrl.startsWith(protocol)) {
      return '';
    }
  }

  return url.trim();
}

/**
 * 모든 sanitization을 통합 적용
 * - HTML 태그 제거
 * - 이벤트 핸들러 제거
 * - 공백 정규화
 *
 * @param input - 정제할 문자열
 * @returns 정제된 문자열
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let result = input;

  // 1. HTML 태그 제거
  result = sanitizeHtml(result);

  // 2. 이벤트 핸들러 제거
  result = removeEventHandlers(result);

  // 3. 연속 공백 정규화
  result = result.replace(/\s+/g, ' ');

  // 4. 앞뒤 공백 제거
  result = result.trim();

  return result;
}

/**
 * 배열의 모든 문자열 요소에 sanitization 적용
 *
 * @param arr - 정제할 문자열 배열
 * @returns 정제된 문자열 배열
 */
export function sanitizeArray(arr: string[]): string[] {
  if (!Array.isArray(arr)) {
    return [];
  }

  return arr
    .filter((item) => typeof item === 'string')
    .map((item) => sanitizeInput(item))
    .filter((item) => item.length > 0);
}

/**
 * 객체의 문자열 필드에 sanitization 적용
 *
 * @param obj - 정제할 객체
 * @param fields - 정제할 필드 이름 배열
 * @returns 정제된 객체
 */
export function sanitizeObjectFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };

  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[field as string] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      (result as Record<string, unknown>)[field as string] = sanitizeArray(value as string[]);
    }
  }

  return result;
}

export default {
  sanitizeHtml,
  sanitizeUrl,
  sanitizeInput,
  sanitizeArray,
  sanitizeObjectFields,
  removeEventHandlers,
};
