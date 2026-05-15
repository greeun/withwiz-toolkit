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
 * - 모든 HTML 태그 제거 (named + numeric 엔티티로 인코딩된 태그 포함)
 * - 닫는 >가 없는 불완전 태그 제거 (HTML5 파서 우회 방지)
 * - HTML 엔티티를 디코딩하여 원본 텍스트 반환
 * - 공백 정리
 *
 * @param input - 정제할 문자열
 * @returns 태그가 제거된 순수 텍스트 (React 등 텍스트 컨텍스트에서 사용)
 *
 * @example
 * sanitizeHtml('<script>alert("xss")</script>Hello') // 'alert("xss")Hello'
 * sanitizeHtml('Hello <b>World</b>') // 'Hello World'
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let result = input;

  // 1. 완전한 HTML 태그 제거
  result = result.replace(/<[^>]*>/g, '');

  // 2. named 엔티티 중 태그 구성 문자만 먼저 디코딩
  result = result
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  // 3. 디코딩으로 생성된 태그 제거
  result = result.replace(/<[^>]*>/g, '');

  // 4. numeric HTML 엔티티 디코딩 (&#60; &#x3C; 등 — XSS 우회 방지)
  result = result
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // 5. numeric 디코딩으로 생성된 태그 제거
  result = result.replace(/<[^>]*>/g, '');

  // 6. 닫는 >가 없는 불완전 태그 제거 (HTML5 파서 우회 방지)
  result = result.replace(/<[^>]*$/g, '');

  // 7. 나머지 named 엔티티 디코딩
  result = result
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');

  return result.trim();
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
