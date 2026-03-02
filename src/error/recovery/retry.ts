/**
 * Retry 패턴
 *
 * 실패한 작업을 자동으로 재시도
 */

/**
 * Retry 옵션
 */
export interface IRetryOptions {
  /** 최대 재시도 횟수 (기본값: 3) */
  maxAttempts?: number;

  /** 재시도 간격 (밀리초, 기본값: 1000) */
  delay?: number;

  /** 지수 백오프 사용 여부 (기본값: true) */
  exponentialBackoff?: boolean;

  /** 백오프 배수 (기본값: 2) */
  backoffMultiplier?: number;

  /** 최대 지연 시간 (밀리초, 기본값: 30000) */
  maxDelay?: number;

  /** 재시도 가능 여부를 판단하는 함수 */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /** 재시도 전 콜백 */
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * 기본 재시도 판단 함수
 */
function defaultShouldRetry(error: unknown): boolean {
  // 네트워크 에러나 일시적인 에러만 재시도
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('503') ||
      message.includes('504')
    );
  }
  return false;
}

/**
 * withRetry - 재시도 패턴
 *
 * @example
 * ```typescript
 * const data = await withRetry(
 *   async () => {
 *     const res = await fetch('/api/data');
 *     if (!res.ok) throw new Error('Fetch failed');
 *     return res.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     delay: 1000,
 *     exponentialBackoff: true,
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: IRetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    exponentialBackoff = true,
    backoffMultiplier = 2,
    maxDelay = 30000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 마지막 시도인 경우 에러 throw
      if (attempt === maxAttempts) {
        throw error;
      }

      // 재시도 가능 여부 확인
      if (!shouldRetry(error, attempt)) {
        throw error;
      }

      // 재시도 콜백
      onRetry?.(error, attempt);

      // 지연 시간 계산
      let currentDelay = delay;
      if (exponentialBackoff) {
        currentDelay = Math.min(
          delay * Math.pow(backoffMultiplier, attempt - 1),
          maxDelay
        );
      }

      // 지연
      await sleep(currentDelay);
    }
  }

  // 이 라인은 도달하지 않지만 TypeScript를 위해 필요
  throw lastError;
}

/**
 * sleep 유틸리티
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
