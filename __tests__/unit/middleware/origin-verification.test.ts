/**
 * Unit Tests: Origin 검증 미들웨어
 *
 * SC-UNIT-ORIGIN-001: securityMiddleware Origin/Referer 검증
 *
 * setAllowedOrigins()로 설정된 도메인 목록을 기반으로
 * state-changing 요청(POST/PUT/PATCH/DELETE)의 Origin/Referer를 검증합니다.
 */

import type { IApiContext } from "@withwiz/middleware/types";
import { NextResponse } from "next/server";

/**
 * Mock NextRequest 생성 헬퍼
 */
function createMockRequest(
  method: string,
  options: { origin?: string; referer?: string } = {},
): IApiContext["request"] {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (options.origin) {
    headers.set("origin", options.origin);
  }
  if (options.referer) {
    headers.set("referer", options.referer);
  }

  const cookies = {
    get: () => undefined,
  };

  return {
    headers,
    cookies,
    method,
    url: "http://localhost:3000/api/test",
  } as unknown as IApiContext["request"];
}

function createMockContext(
  method: string,
  options: { origin?: string; referer?: string } = {},
): IApiContext {
  return {
    request: createMockRequest(method, options),
    locale: "ko",
    requestId: "test-request-id",
    startTime: Date.now(),
    metadata: {},
  };
}

describe("SC-UNIT-ORIGIN-001: Origin 검증 미들웨어", () => {
  let securityMiddleware: any;
  let setAllowedOrigins: any;

  beforeAll(async () => {
    const securityModule = await import("@withwiz/middleware/security");
    securityMiddleware = securityModule.securityMiddleware;
    setAllowedOrigins = securityModule.setAllowedOrigins;
  });

  afterEach(() => {
    // 각 테스트 후 allowed origins 초기화
    globalThis.__withwiz_allowed_origins = undefined;
  });

  const mockNext = async () => NextResponse.json({ ok: true });

  // TC-UNIT-ORIGIN-001: allowedOrigins 미설정 시 검증 건너뛰기
  test("TC-UNIT-ORIGIN-001: allowedOrigins 미설정 시 POST 통과", async () => {
    const context = createMockContext("POST"); // Origin 없음

    const response = await securityMiddleware(context, mockNext);
    const body = await response.json();

    expect(body.ok).toBe(true);
  });

  // TC-UNIT-ORIGIN-002: GET 요청은 Origin 검증 안 함
  test("TC-UNIT-ORIGIN-002: GET 요청은 Origin 검증 안 함", async () => {
    setAllowedOrigins(["https://example.com"]);
    const context = createMockContext("GET"); // Origin 없음

    const response = await securityMiddleware(context, mockNext);
    const body = await response.json();

    expect(body.ok).toBe(true);
  });

  // TC-UNIT-ORIGIN-003: 허용된 Origin으로 POST 성공
  test("TC-UNIT-ORIGIN-003: 허용된 Origin으로 POST 성공", async () => {
    setAllowedOrigins(["https://example.com"]);
    const context = createMockContext("POST", {
      origin: "https://example.com",
    });

    const response = await securityMiddleware(context, mockNext);
    const body = await response.json();

    expect(body.ok).toBe(true);
  });

  // TC-UNIT-ORIGIN-004: 허용되지 않은 Origin으로 POST 거부
  test("TC-UNIT-ORIGIN-004: 허용되지 않은 Origin으로 POST 거부 (403)", async () => {
    setAllowedOrigins(["https://example.com"]);
    const context = createMockContext("POST", {
      origin: "https://evil.com",
    });

    const response = await securityMiddleware(context, mockNext);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(40300);
  });

  // TC-UNIT-ORIGIN-005: Origin 없으면 Referer로 폴백
  test("TC-UNIT-ORIGIN-005: Origin 없으면 Referer로 폴백 성공", async () => {
    setAllowedOrigins(["https://example.com"]);
    const context = createMockContext("POST", {
      referer: "https://example.com/some/page",
    });

    const response = await securityMiddleware(context, mockNext);
    const body = await response.json();

    expect(body.ok).toBe(true);
  });

  // TC-UNIT-ORIGIN-006: Origin도 Referer도 없으면 거부
  test("TC-UNIT-ORIGIN-006: Origin도 Referer도 없으면 거부 (403)", async () => {
    setAllowedOrigins(["https://example.com"]);
    const context = createMockContext("POST"); // 둘 다 없음

    const response = await securityMiddleware(context, mockNext);

    expect(response.status).toBe(403);
  });

  // TC-UNIT-ORIGIN-007: PUT, PATCH, DELETE도 검증 대상
  test("TC-UNIT-ORIGIN-007: PUT/PATCH/DELETE도 Origin 검증", async () => {
    setAllowedOrigins(["https://example.com"]);

    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const context = createMockContext(method, {
        origin: "https://evil.com",
      });
      const response = await securityMiddleware(context, mockNext);
      expect(response.status).toBe(403);
    }
  });

  // TC-UNIT-ORIGIN-008: 여러 허용 도메인 중 하나 매칭
  test("TC-UNIT-ORIGIN-008: 여러 허용 도메인 중 하나 매칭", async () => {
    setAllowedOrigins([
      "https://example.com",
      "https://www.example.com",
      "http://localhost:3000",
    ]);

    const context = createMockContext("POST", {
      origin: "http://localhost:3000",
    });

    const response = await securityMiddleware(context, mockNext);
    const body = await response.json();

    expect(body.ok).toBe(true);
  });

  // TC-UNIT-ORIGIN-009: OPTIONS 요청은 검증 안 함
  test("TC-UNIT-ORIGIN-009: OPTIONS 요청은 검증 안 함", async () => {
    setAllowedOrigins(["https://example.com"]);
    const context = createMockContext("OPTIONS"); // Origin 없음

    const response = await securityMiddleware(context, mockNext);
    const body = await response.json();

    expect(body.ok).toBe(true);
  });
});
