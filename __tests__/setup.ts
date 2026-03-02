/**
 * @withwiz 테스트 셋업
 *
 * Jest 테스트 실행 전 공통 설정을 정의합니다.
 */

// jsdom 환경에서 TextEncoder/TextDecoder가 필요한 라이브러리(jose 등) 지원
import { TextEncoder, TextDecoder } from "util";
import { webcrypto } from "node:crypto";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;
if (!global.crypto) {
  global.crypto = webcrypto as unknown as typeof global.crypto;
}

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
