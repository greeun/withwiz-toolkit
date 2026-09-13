/**
 * 에러 객체에서 표시용 정보 추출 — 프레임워크 독립 순수 함수
 *
 * ErrorBoundary(next) / error-display(react) 양쪽에서 공유되므로
 * core 티어에 위치한다.
 */
export function extractErrorInfo(error: Error | unknown): { code: number; message: string; stack?: string } {
  if (error instanceof Error) {
    // AppError 등 code 속성이 있는 경우 직접 사용
    if ('code' in error && typeof (error as { code: unknown }).code === 'number' && (error as { code: number }).code >= 10000) {
      return { code: (error as { code: number }).code, message: error.message, stack: error.stack };
    }
    return { code: 50001, message: error.message, stack: error.stack };
  }
  return { code: 50001, message: String(error) };
}

// ============================================================================
// 로그용 에러 메시지 축약
// ============================================================================

/**
 * 로그에 기록할 에러 메시지 최대 길이.
 *
 * Prisma 7 등 일부 라이브러리는 오류 메시지에 난독화된 번들 소스를 통째로 담는다.
 * 이를 그대로 기록하면 로그가 오염되고 내부 구현이 노출되므로 앞부분만 남긴다.
 */
export const ERROR_LOG_MESSAGE_MAX_LENGTH = 500;

/** 문자열이 아닌 값을 안전하게 문자열로 만든다. */
function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * 로그용 메시지를 최대 길이로 잘라낸다. 원인 파악에 필요한 앞부분은 남긴다.
 *
 * @returns 잘린 문자열. 입력이 null/undefined 이면 undefined
 */
export function truncateErrorMessage(
  value: unknown,
  maxLength: number = ERROR_LOG_MESSAGE_MAX_LENGTH,
): string | undefined {
  if (value === undefined || value === null) return undefined;

  const text = safeStringify(value);
  const limit = maxLength > 0 ? maxLength : 0;
  if (text.length <= limit) return text;

  return `${text.slice(0, limit)}... [truncated ${text.length - limit} chars]`;
}

/** 로그용 에러 요약 정보 */
export interface IErrorLogSummary {
  name?: string;
  message?: string;
  code?: string | number;
  stack?: string;
}

/**
 * 에러를 로그용 요약 객체로 변환한다.
 * 메시지와 스택은 모두 최대 길이로 잘린다.
 */
export function summarizeErrorForLog(
  error: unknown,
  maxLength: number = ERROR_LOG_MESSAGE_MAX_LENGTH,
): IErrorLogSummary {
  if (error instanceof Error) {
    const rawCode = (error as { code?: unknown }).code;
    return {
      name: error.name,
      message: truncateErrorMessage(error.message, maxLength),
      ...(typeof rawCode === 'string' || typeof rawCode === 'number' ? { code: rawCode } : {}),
      stack: truncateErrorMessage(error.stack, maxLength),
    };
  }

  return { message: truncateErrorMessage(error, maxLength) };
}
