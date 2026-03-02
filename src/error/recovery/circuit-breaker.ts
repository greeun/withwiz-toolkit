/**
 * Circuit Breaker 패턴
 *
 * 연속된 실패 시 일시적으로 요청 차단
 */

/**
 * Circuit Breaker 상태
 */
export enum ECircuitState {
  CLOSED = 'closed', // 정상 동작
  OPEN = 'open', // 요청 차단
  HALF_OPEN = 'half-open', // 테스트 중
}

/**
 * CircuitBreaker 옵션
 */
export interface ICircuitBreakerOptions {
  /** 실패 임계값 (기본값: 5) */
  failureThreshold?: number;

  /** 성공 임계값 (Half-Open 상태에서, 기본값: 2) */
  successThreshold?: number;

  /** 타임아웃 (밀리초, 기본값: 60000) */
  timeout?: number;

  /** 상태 변경 콜백 */
  onStateChange?: (oldState: ECircuitState, newState: ECircuitState) => void;

  /** 에러 콜백 */
  onError?: (error: unknown) => void;
}

/**
 * CircuitBreaker 클래스
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   timeout: 60000,
 * });
 *
 * const data = await breaker.execute(async () => {
 *   const res = await fetch('/api/data');
 *   return res.json();
 * });
 * ```
 */
export class CircuitBreaker {
  private state: ECircuitState = ECircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime = 0;

  private options: Required<ICircuitBreakerOptions>;

  constructor(options: ICircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 60000,
      onStateChange: options.onStateChange || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  /**
   * 함수 실행
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Open 상태인 경우
    if (this.state === ECircuitState.OPEN) {
      // 타임아웃 체크
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN');
      }

      // Half-Open으로 전환
      this.setState(ECircuitState.HALF_OPEN);
    }

    try {
      // 함수 실행
      const result = await fn();

      // 성공 처리
      this.onSuccess();

      return result;
    } catch (error) {
      // 실패 처리
      this.onFailure();

      // 에러 콜백
      this.options.onError(error);

      throw error;
    }
  }

  /**
   * 성공 처리
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === ECircuitState.HALF_OPEN) {
      this.successCount++;

      // 성공 임계값 도달 시 Closed로 전환
      if (this.successCount >= this.options.successThreshold) {
        this.setState(ECircuitState.CLOSED);
        this.successCount = 0;
      }
    }
  }

  /**
   * 실패 처리
   */
  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    // 실패 임계값 도달 시 Open으로 전환
    if (this.failureCount >= this.options.failureThreshold) {
      this.setState(ECircuitState.OPEN);
      this.nextAttemptTime = Date.now() + this.options.timeout;
    }
  }

  /**
   * 상태 변경
   */
  private setState(newState: ECircuitState): void {
    const oldState = this.state;
    if (oldState !== newState) {
      this.state = newState;
      this.options.onStateChange(oldState, newState);

      console.log(`[CircuitBreaker] State changed: ${oldState} -> ${newState}`);
    }
  }

  /**
   * 현재 상태 조회
   */
  getState(): ECircuitState {
    return this.state;
  }

  /**
   * 상태 초기화
   */
  reset(): void {
    this.setState(ECircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * 메트릭 조회
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.nextAttemptTime,
    };
  }
}
