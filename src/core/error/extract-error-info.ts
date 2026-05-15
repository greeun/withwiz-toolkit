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
