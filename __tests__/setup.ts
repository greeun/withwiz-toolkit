/**
 * @withwiz 테스트 셋업
 *
 * Vitest 테스트 실행 전 공통 설정을 정의합니다.
 */

import { beforeAll, afterAll } from "vitest";

// TextEncoder/TextDecoder가 필요한 라이브러리(jose 등) 지원
import { TextEncoder, TextDecoder } from "util";

// TextEncoder/TextDecoder 설정 (필요한 경우)
if (!globalThis.TextEncoder) {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (!globalThis.TextDecoder) {
  (globalThis as any).TextDecoder = TextDecoder;
}

// Node.js v18+에서는 globalThis.crypto가 이미 설정되어 있음
// Vitest는 node 환경에서 자동으로 crypto를 제공함

// 테스트 타임아웃 설정 (기본 5초)
// timeout configured in vitest.config.ts;

// 콘솔 경고 무시 (테스트 환경에서만)
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    // 특정 경고 무시
    if (typeof args[0] === "string" && args[0].includes("Warning:")) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});

// 환경 변수 기본값 설정
if (!process.env.NODE_ENV) {
  (process.env as any).NODE_ENV = "test";
}
process.env.CACHE_ENABLED = "false";
process.env.CACHE_REDIS_ENABLED = "false";
process.env.CACHE_INMEMORY_ENABLED = "true";
