/**
 * Fallback 패턴
 *
 * 실패 시 대체 값 또는 대체 함수 사용
 */

/**
 * Fallback 옵션
 */
export interface IFallbackOptions<T> {
  /** 에러 발생 시 콜백 */
  onError?: (error: unknown) => void;

  /** 에러 로깅 여부 (기본값: true) */
  logError?: boolean;
}

/**
 * withFallback - Fallback 패턴 (값)
 *
 * @example
 * ```typescript
 * const data = await withFallback(
 *   async () => {
 *     const res = await fetch('/api/data');
 *     return res.json();
 *   },
 *   { default: 'fallback data' }
 * );
 * ```
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallbackValue: T,
  options: IFallbackOptions<T> = {}
): Promise<T> {
  const { onError, logError = true } = options;

  try {
    return await fn();
  } catch (error) {
    // 에러 로깅
    if (logError) {
      console.error('[withFallback] Error occurred, using fallback:', error);
    }

    // 에러 콜백
    onError?.(error);

    // Fallback 값 반환
    return fallbackValue;
  }
}

/**
 * withFallbackFn - Fallback 패턴 (함수)
 *
 * @example
 * ```typescript
 * const data = await withFallbackFn(
 *   async () => await fetchFromPrimary(),
 *   async () => await fetchFromSecondary()
 * );
 * ```
 */
export async function withFallbackFn<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  options: IFallbackOptions<T> = {}
): Promise<T> {
  const { onError, logError = true } = options;

  try {
    return await primaryFn();
  } catch (error) {
    // 에러 로깅
    if (logError) {
      console.error('[withFallbackFn] Primary failed, trying fallback:', error);
    }

    // 에러 콜백
    onError?.(error);

    // Fallback 함수 실행
    try {
      return await fallbackFn();
    } catch (fallbackError) {
      console.error('[withFallbackFn] Fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * withFallbackChain - 여러 fallback을 순서대로 시도
 *
 * @example
 * ```typescript
 * const data = await withFallbackChain([
 *   async () => await fetchFromPrimary(),
 *   async () => await fetchFromSecondary(),
 *   async () => await fetchFromCache(),
 *   async () => ({ default: true })
 * ]);
 * ```
 */
export async function withFallbackChain<T>(
  fns: Array<() => Promise<T>>,
  options: IFallbackOptions<T> = {}
): Promise<T> {
  const { onError, logError = true } = options;
  const errors: unknown[] = [];

  for (let i = 0; i < fns.length; i++) {
    try {
      return await fns[i]();
    } catch (error) {
      errors.push(error);

      if (logError) {
        console.error(`[withFallbackChain] Attempt ${i + 1} failed:`, error);
      }

      onError?.(error);

      // 마지막 함수도 실패한 경우
      if (i === fns.length - 1) {
        throw new Error(
          `All ${fns.length} attempts failed. Last error: ${error}`
        );
      }
    }
  }

  // 이 라인은 도달하지 않지만 TypeScript를 위해 필요
  throw new Error('No functions provided');
}
