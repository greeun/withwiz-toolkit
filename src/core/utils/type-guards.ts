/**
 * 범용 타입 가드 함수들
 *
 * 프로젝트 독립적인 런타임 타입 검증 유틸리티
 * TypeScript의 타입 좁히기를 활용합니다.
 */

// ===== 유틸리티 타입 가드 =====

/**
 * null이 아닌 값인지 확인
 */
export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * undefined가 아닌 값인지 확인
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * null과 undefined가 아닌 값인지 확인
 */
export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * 문자열인지 확인
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 숫자인지 확인
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * boolean인지 확인
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 객체인지 확인 (null 제외)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 배열인지 확인
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * 함수인지 확인
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

// ===== 검증 타입 가드 =====

/**
 * 유효한 이메일 형식인지 확인
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * 유효한 URL 형식인지 확인
 */
export function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 유효한 IPv4 주소인지 확인
 */
export function isIPv4(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(value)) return false;

  const parts = value.split('.');
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * 유효한 IPv6 주소인지 확인
 */
export function isIPv6(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:)*)?::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(value);
}

/**
 * 유효한 IP 주소인지 확인 (IPv4 또는 IPv6)
 */
export function isIPAddress(value: unknown): value is string {
  return isIPv4(value) || isIPv6(value);
}

// ===== 날짜 관련 타입 가드 =====

/**
 * 유효한 Date 객체인지 확인
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * ISO 8601 날짜 문자열인지 확인
 */
export function isISODateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && value === date.toISOString();
}

/**
 * 날짜 문자열로 파싱 가능한지 확인
 */
export function isDateParseable(value: unknown): value is string | number | Date {
  if (value instanceof Date) return isValidDate(value);
  if (typeof value === 'number') return !isNaN(new Date(value).getTime());
  if (typeof value === 'string') return !isNaN(new Date(value).getTime());
  return false;
}

// ===== 정렬/순서 관련 타입 가드 =====

/**
 * 정렬 순서 타입
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 정렬 순서 타입 가드
 */
export function isSortOrder(value: unknown): value is SortOrder {
  return value === 'asc' || value === 'desc';
}

// ===== API 응답 타입 가드 =====

/**
 * API 성공 응답 타입
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * API 에러 응답 타입
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * API 응답 유니온 타입
 */
export type ApiResponseType<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * API 성공 응답인지 확인
 */
export function isApiSuccessResponse<T>(response: ApiResponseType<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * API 에러 응답인지 확인
 */
export function isApiErrorResponse<T>(response: ApiResponseType<T>): response is ApiErrorResponse {
  return response.success === false;
}

// ===== JSON 관련 타입 가드 =====

/**
 * 유효한 JSON 문자열인지 확인
 */
export function isValidJSON(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * JSON 직렬화 가능한지 확인
 */
export function isJSONSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

// ===== 빈 값 확인 =====

/**
 * 빈 문자열인지 확인
 */
export function isEmptyString(value: unknown): value is '' {
  return value === '';
}

/**
 * 빈 배열인지 확인
 */
export function isEmptyArray(value: unknown): value is [] {
  return Array.isArray(value) && value.length === 0;
}

/**
 * 빈 객체인지 확인
 */
export function isEmptyObject(value: unknown): boolean {
  return isObject(value) && Object.keys(value).length === 0;
}

/**
 * 빈 값인지 확인 (null, undefined, '', [], {})
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (isEmptyString(value)) return true;
  if (isEmptyArray(value)) return true;
  if (isEmptyObject(value)) return true;
  return false;
}

// ===== 기본 내보내기 =====

export default {
  // Utility Types
  isNotNull,
  isDefined,
  isPresent,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isFunction,

  // Validation
  isValidEmail,
  isValidUrl,
  isIPv4,
  isIPv6,
  isIPAddress,
  isValidDate,
  isISODateString,
  isDateParseable,

  // Sort Order
  isSortOrder,

  // API Response
  isApiSuccessResponse,
  isApiErrorResponse,

  // JSON
  isValidJSON,
  isJSONSerializable,

  // Empty checks
  isEmptyString,
  isEmptyArray,
  isEmptyObject,
  isEmpty,
};
