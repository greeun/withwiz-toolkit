/**
 * Feature Degradation 패턴
 *
 * 선택적 기능 실패 시 우아한 저하 (graceful degradation)
 */

/**
 * FeatureDegradation - 기능 저하 패턴
 *
 * 선택적 기능 실패 시 기본 작업은 계속 진행
 *
 * @example
 * ```typescript
 * const result = await FeatureDegradation.execute(
 *   'analytics',
 *   async () => {
 *     await trackAnalytics(event);
 *   }
 * );
 *
 * if (!result.success) {
 *   console.log('Analytics failed but app continues');
 * }
 * ```
 */
export class FeatureDegradation {
  /**
   * 기능 실행 (실패해도 앱은 계속)
   */
  static async execute<T>(
    featureName: string,
    fn: () => Promise<T>,
    fallbackValue?: T
  ): Promise<{
    success: boolean;
    data?: T;
    error?: unknown;
  }> {
    try {
      const data = await fn();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.warn(`[FeatureDegradation] Feature "${featureName}" failed:`, error);

      return {
        success: false,
        data: fallbackValue,
        error,
      };
    }
  }

  /**
   * 여러 기능을 병렬로 실행 (일부 실패해도 계속)
   */
  static async executeAll<T>(
    features: Array<{
      name: string;
      fn: () => Promise<T>;
      fallbackValue?: T;
    }>
  ): Promise<
    Array<{
      name: string;
      success: boolean;
      data?: T;
      error?: unknown;
    }>
  > {
    const promises = features.map((feature) =>
      this.execute(feature.name, feature.fn, feature.fallbackValue).then(
        (result) => ({
          name: feature.name,
          ...result,
        })
      )
    );

    return await Promise.all(promises);
  }

  /**
   * 타임아웃 포함 실행
   */
  static async executeWithTimeout<T>(
    featureName: string,
    fn: () => Promise<T>,
    timeoutMs: number,
    fallbackValue?: T
  ): Promise<{
    success: boolean;
    data?: T;
    error?: unknown;
    timedOut?: boolean;
  }> {
    try {
      const data = await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        ),
      ]);

      return {
        success: true,
        data,
      };
    } catch (error) {
      const timedOut =
        error instanceof Error && error.message === 'Timeout';

      console.warn(
        `[FeatureDegradation] Feature "${featureName}" ${timedOut ? 'timed out' : 'failed'}:`,
        error
      );

      return {
        success: false,
        data: fallbackValue,
        error,
        timedOut,
      };
    }
  }
}
