/**
 * 에러 복구 전략
 *
 * 통합 에러 처리 시스템의 복구 패턴
 */

// Retry
export { withRetry } from './retry';
export type { IRetryOptions } from './retry';

// Fallback
export { withFallback, withFallbackFn, withFallbackChain } from './fallback';
export type { IFallbackOptions } from './fallback';

// Circuit Breaker
export { CircuitBreaker, ECircuitState } from './circuit-breaker';
export type { ICircuitBreakerOptions } from './circuit-breaker';

// Feature Degradation
export { FeatureDegradation } from './degradation';
