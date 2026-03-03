/**
 * Error Recovery module tests
 *
 * Test Scope:
 * - CircuitBreaker: state transitions, failure rate thresholds
 * - Retry: Exponential Backoff, retry logic
 */

import {
  CircuitBreaker,
  ECircuitState,
} from "@withwiz/error/recovery/circuit-breaker";
import { withRetry } from "@withwiz/error/recovery/retry";

// Mock timers
vi.useFakeTimers();

describe("Error Recovery", () => {
  describe("CircuitBreaker", () => {
    describe("Initial State", () => {
      it("should start in CLOSED state", () => {
        const breaker = new CircuitBreaker();
        expect(breaker.getState()).toBe(ECircuitState.CLOSED);
      });

      it("should have default options", () => {
        const breaker = new CircuitBreaker();
        const metrics = breaker.getMetrics();

        expect(metrics.failureCount).toBe(0);
        expect(metrics.successCount).toBe(0);
      });
    });

    describe("CLOSED → OPEN Transition", () => {
      it("should open after failure threshold", async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 3,
        });

        const failingFn = vi.fn(() => Promise.reject(new Error("Failure")));

        // 3 failures
        for (let i = 0; i < 3; i++) {
          try {
            await breaker.execute(failingFn);
          } catch (error) {
            // Expected failure
          }
        }

        expect(breaker.getState()).toBe(ECircuitState.OPEN);
      });

      it("should call onStateChange callback", async () => {
        const onStateChange = vi.fn();
        const breaker = new CircuitBreaker({
          failureThreshold: 2,
          onStateChange,
        });

        const failingFn = () => Promise.reject(new Error("Failure"));

        // 2 failures
        try {
          await breaker.execute(failingFn);
        } catch {}
        try {
          await breaker.execute(failingFn);
        } catch {}

        expect(onStateChange).toHaveBeenCalledWith(
          ECircuitState.CLOSED,
          ECircuitState.OPEN,
        );
      });

      it("should reject requests when OPEN", async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
        });

        // Transition to OPEN
        try {
          await breaker.execute(() => Promise.reject(new Error("Failure")));
        } catch {}

        // Immediate rejection in OPEN state
        await expect(
          breaker.execute(() => Promise.resolve("success")),
        ).rejects.toThrow("Circuit breaker is OPEN");
      });
    });

    describe("OPEN → HALF_OPEN Transition", () => {
      it("should transition to HALF_OPEN after timeout", async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
          successThreshold: 1, // CLOSED after 1 success
          timeout: 1000,
        });

        // Transition to OPEN
        try {
          await breaker.execute(() => Promise.reject(new Error("Failure")));
        } catch {}

        expect(breaker.getState()).toBe(ECircuitState.OPEN);

        // Timeout elapsed
        vi.advanceTimersByTime(1500);

        // Transition to HALF_OPEN on next request
        try {
          await breaker.execute(() => Promise.resolve("success"));
        } catch {}

        expect(breaker.getState()).toBe(ECircuitState.CLOSED); // CLOSED immediately due to success
      });
    });

    describe("HALF_OPEN → CLOSED Transition", () => {
      it("should close after success threshold", async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
          successThreshold: 2,
          timeout: 100,
        });

        // Transition to OPEN
        try {
          await breaker.execute(() => Promise.reject(new Error("Failure")));
        } catch {}

        // HALF_OPEN after timeout
        vi.advanceTimersByTime(200);

        // 2 successes → CLOSED
        await breaker.execute(() => Promise.resolve("success1"));
        expect(breaker.getState()).toBe(ECircuitState.HALF_OPEN);

        await breaker.execute(() => Promise.resolve("success2"));
        expect(breaker.getState()).toBe(ECircuitState.CLOSED);
      });
    });

    describe("HALF_OPEN → OPEN Transition", () => {
      it("should reopen on failure in HALF_OPEN", async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
          timeout: 100,
        });

        // Transition to OPEN
        try {
          await breaker.execute(() => Promise.reject(new Error("Failure")));
        } catch {}

        // HALF_OPEN after timeout
        vi.advanceTimersByTime(200);

        // Failure in HALF_OPEN → OPEN again
        try {
          await breaker.execute(() =>
            Promise.reject(new Error("Failure again")),
          );
        } catch {}

        expect(breaker.getState()).toBe(ECircuitState.OPEN);
      });
    });

    describe("Success/Failure Count", () => {
      it("should reset failure count on success", async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 3,
        });

        // 2 failures
        try {
          await breaker.execute(() => Promise.reject(new Error("Failure")));
        } catch {}
        try {
          await breaker.execute(() => Promise.reject(new Error("Failure")));
        } catch {}

        let metrics = breaker.getMetrics();
        expect(metrics.failureCount).toBe(2);

        // Success → Count reset
        await breaker.execute(() => Promise.resolve("success"));

        metrics = breaker.getMetrics();
        expect(metrics.failureCount).toBe(0);
      });
    });

    describe("Error Callback", () => {
      it("should call onError callback", async () => {
        const onError = vi.fn();
        const breaker = new CircuitBreaker({
          onError,
        });

        const error = new Error("Test error");

        try {
          await breaker.execute(() => Promise.reject(error));
        } catch {}

        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    describe("reset", () => {
      it("should reset to CLOSED state", async () => {
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
        });

        // Transition to OPEN
        try {
          await breaker.execute(() => Promise.reject(new Error("Failure")));
        } catch {}

        expect(breaker.getState()).toBe(ECircuitState.OPEN);

        // Reset
        breaker.reset();

        expect(breaker.getState()).toBe(ECircuitState.CLOSED);
        expect(breaker.getMetrics().failureCount).toBe(0);
      });
    });
  });

  describe("withRetry", () => {
    beforeEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
    });

    describe("Basic Retry", () => {
      it("should succeed on first attempt", async () => {
        const fn = vi.fn(() => Promise.resolve("success"));

        const result = await withRetry(fn);

        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("should retry and eventually succeed", async () => {
        let attemptCount = 0;
        const fn = vi.fn(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve("success");
        });

        const result = await withRetry(fn, {
          maxAttempts: 3,
          delay: 10,
        });

        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it("should throw after max attempts", async () => {
        const fn = vi.fn(() => Promise.reject(new Error("Network error")));

        await expect(
          withRetry(fn, {
            maxAttempts: 3,
            delay: 10,
          }),
        ).rejects.toThrow("Network error");

        expect(fn).toHaveBeenCalledTimes(3);
      });
    });

    describe("shouldRetry Judgment", () => {
      it("should retry on network errors", async () => {
        const errors = [
          new Error("Network error"),
          new Error("Timeout error"),
          new Error("ECONNREFUSED"),
          new Error("503 Service Unavailable"),
        ];

        for (const error of errors) {
          let attemptCount = 0;
          const fn = vi.fn(() => {
            attemptCount++;
            if (attemptCount === 1) {
              return Promise.reject(error);
            }
            return Promise.resolve("success");
          });

          await withRetry(fn, { delay: 10 });
          expect(fn).toHaveBeenCalledTimes(2); // Retried
        }
      });

      it("should not retry on non-retryable errors", async () => {
        const fn = vi.fn(() => Promise.reject(new Error("Validation error")));

        await expect(
          withRetry(fn, {
            delay: 10,
          }),
        ).rejects.toThrow("Validation error");

        expect(fn).toHaveBeenCalledTimes(1); // Not retried
      });

      it("should use custom shouldRetry", async () => {
        const fn = vi.fn(() => Promise.reject(new Error("Custom error")));

        const shouldRetry = vi.fn(() => true);

        await expect(
          withRetry(fn, {
            maxAttempts: 2,
            delay: 10,
            shouldRetry,
          }),
        ).rejects.toThrow();

        expect(fn).toHaveBeenCalledTimes(2);
        expect(shouldRetry).toHaveBeenCalled();
      });
    });

    describe("Exponential Backoff", () => {
      it("should use exponential backoff", async () => {
        vi.useFakeTimers();

        let attemptCount = 0;
        const fn = vi.fn(() => {
          attemptCount++;
          if (attemptCount < 4) {
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve("success");
        });

        const promise = withRetry(fn, {
          maxAttempts: 4,
          delay: 100,
          exponentialBackoff: true,
          backoffMultiplier: 2,
        });

        // Delay after first failure: 100ms
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve();

        expect(fn).toHaveBeenCalledTimes(1);

        // Second attempt
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();

        expect(fn).toHaveBeenCalledTimes(2);

        // Third attempt (200ms delay)
        await vi.advanceTimersByTimeAsync(200);
        await Promise.resolve();

        expect(fn).toHaveBeenCalledTimes(3);

        // Fourth attempt (400ms delay)
        await vi.advanceTimersByTimeAsync(400);

        await promise;

        expect(fn).toHaveBeenCalledTimes(4);

        vi.useRealTimers();
      });

      it("should respect maxDelay", async () => {
        vi.useFakeTimers();

        let attemptCount = 0;
        const fn = vi.fn(() => {
          attemptCount++;
          if (attemptCount < 4) {
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve("success");
        });

        const promise = withRetry(fn, {
          maxAttempts: 4,
          delay: 1000,
          exponentialBackoff: true,
          backoffMultiplier: 2,
          maxDelay: 1500, // Max 1.5s
        });

        // After first failure: 1000ms
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve();

        // Second attempt (1000ms delay)
        await vi.advanceTimersByTimeAsync(1000);
        await Promise.resolve();

        // Third attempt (Originally 2000ms, but capped at 1500ms by maxDelay)
        await vi.advanceTimersByTimeAsync(1500);
        await Promise.resolve();

        // Fourth attempt (Originally 4000ms, but capped at 1500ms by maxDelay)
        await vi.advanceTimersByTimeAsync(1500);

        await promise;

        vi.useRealTimers();
      });

      it("should use fixed delay when exponentialBackoff is false", async () => {
        vi.useFakeTimers();

        let attemptCount = 0;
        const fn = vi.fn(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve("success");
        });

        const promise = withRetry(fn, {
          maxAttempts: 3,
          delay: 100,
          exponentialBackoff: false,
        });

        // Fixed 100ms for each attempt
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve();

        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();

        await vi.advanceTimersByTimeAsync(100);

        await promise;

        vi.useRealTimers();
      });
    });

    describe("onRetry Callback", () => {
      it("should call onRetry before each retry", async () => {
        const onRetry = vi.fn();
        let attemptCount = 0;

        const fn = () => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve("success");
        };

        await withRetry(fn, {
          maxAttempts: 3,
          delay: 10,
          onRetry,
        });

        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
        expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2);
      });
    });
  });
});
