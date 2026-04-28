/**
 * Unit Tests: authMiddleware 쿠키 기반 토큰 추출
 *
 * SC-UNIT-AUTHCOOKIE-001: 쿠키 → 헤더 폴백 토큰 추출 검증
 *
 * authMiddleware와 optionalAuthMiddleware가 쿠키에서 먼저 토큰을 추출하고,
 * 쿠키가 없으면 Authorization 헤더로 폴백하는 동작을 검증합니다.
 */

import { JWTService } from "@withwiz/auth/core/jwt";
import type { JWTConfig } from "@withwiz/auth/types";
import type { IApiContext } from "@withwiz/middleware/types";
import { NextResponse } from "next/server";
import { initializeAuth, resetAuth } from "../../../src/auth/config";

const testConfig: JWTConfig = {
  secret: "test-secret-key-that-is-at-least-32-characters-long",
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "7d",
  algorithm: "HS256",
};

const testUser = {
  id: "user-cookie-test-001",
  email: "cookie-test@example.com",
  role: "USER" as const,
  emailVerified: new Date(),
};

let validAccessToken: string;

beforeAll(async () => {
  resetAuth();
  initializeAuth({
    jwtSecret: testConfig.secret,
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
  });

  const jwtService = new JWTService(testConfig);
  validAccessToken = await jwtService.createAccessToken({
    id: testUser.id,
    userId: testUser.id,
    email: testUser.email,
    role: testUser.role,
    emailVerified: testUser.emailVerified,
  });
});

/**
 * Mock NextRequest 생성 헬퍼 (쿠키 + 헤더 지원)
 */
function createMockRequest(options: {
  authHeader?: string;
  cookieToken?: string;
}): IApiContext["request"] {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (options.authHeader) {
    headers.set("authorization", options.authHeader);
  }

  const cookies = {
    get: (name: string) => {
      if (name === "access_token" && options.cookieToken) {
        return { name, value: options.cookieToken };
      }
      return undefined;
    },
  };

  return {
    headers,
    cookies,
    method: "GET",
    url: "http://localhost:3000/api/test",
  } as unknown as IApiContext["request"];
}

function createMockContext(options: {
  authHeader?: string;
  cookieToken?: string;
}): IApiContext {
  return {
    request: createMockRequest(options),
    locale: "ko",
    requestId: "test-request-id",
    startTime: Date.now(),
    metadata: {},
  };
}

describe("SC-UNIT-AUTHCOOKIE-001: authMiddleware 쿠키 기반 토큰 추출", () => {
  let authMiddleware: any;
  let optionalAuthMiddleware: any;

  beforeAll(async () => {
    const authModule = await import("@withwiz/middleware/auth");
    authMiddleware = authModule.authMiddleware;
    optionalAuthMiddleware = authModule.optionalAuthMiddleware;
  });

  const mockNext = async () => NextResponse.json({ ok: true });

  // TC-UNIT-AUTHCOOKIE-001: 쿠키에서 토큰 추출 성공
  test("TC-UNIT-AUTHCOOKIE-001: 쿠키에 access_token이 있으면 인증 성공", async () => {
    const context = createMockContext({ cookieToken: validAccessToken });

    await authMiddleware(context, mockNext);

    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
    expect(context.user!.email).toBe(testUser.email);
  });

  // TC-UNIT-AUTHCOOKIE-002: 헤더에서 토큰 추출 (폴백)
  test("TC-UNIT-AUTHCOOKIE-002: 쿠키 없으면 Authorization 헤더로 폴백", async () => {
    const context = createMockContext({
      authHeader: `Bearer ${validAccessToken}`,
    });

    await authMiddleware(context, mockNext);

    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
  });

  // TC-UNIT-AUTHCOOKIE-003: 쿠키 우선순위 확인
  test("TC-UNIT-AUTHCOOKIE-003: 쿠키와 헤더 모두 있으면 쿠키 우선", async () => {
    // 쿠키에 유효 토큰, 헤더에 다른 값
    const context = createMockContext({
      cookieToken: validAccessToken,
      authHeader: "Bearer invalid-token-should-not-be-used",
    });

    await authMiddleware(context, mockNext);

    // 쿠키의 유효 토큰으로 인증 성공해야 함
    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
  });

  // TC-UNIT-AUTHCOOKIE-004: 둘 다 없으면 401
  test("TC-UNIT-AUTHCOOKIE-004: 쿠키와 헤더 모두 없으면 에러", async () => {
    const context = createMockContext({});

    await expect(authMiddleware(context, mockNext)).rejects.toThrow();
  });
});

describe("SC-UNIT-AUTHCOOKIE-002: optionalAuthMiddleware 쿠키 기반 토큰 추출", () => {
  let optionalAuthMiddleware: any;

  beforeAll(async () => {
    const authModule = await import("@withwiz/middleware/auth");
    optionalAuthMiddleware = authModule.optionalAuthMiddleware;
  });

  const mockNext = async () => NextResponse.json({ ok: true });

  // TC-UNIT-AUTHCOOKIE-005: 쿠키에서 토큰 추출 성공
  test("TC-UNIT-AUTHCOOKIE-005: 쿠키에 access_token이 있으면 user 설정", async () => {
    const context = createMockContext({ cookieToken: validAccessToken });

    await optionalAuthMiddleware(context, mockNext);

    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
  });

  // TC-UNIT-AUTHCOOKIE-006: 쿠키 없으면 헤더 폴백
  test("TC-UNIT-AUTHCOOKIE-006: 쿠키 없으면 Authorization 헤더로 폴백", async () => {
    const context = createMockContext({
      authHeader: `Bearer ${validAccessToken}`,
    });

    await optionalAuthMiddleware(context, mockNext);

    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
  });

  // TC-UNIT-AUTHCOOKIE-007: 둘 다 없어도 에러 없이 진행
  test("TC-UNIT-AUTHCOOKIE-007: 쿠키와 헤더 모두 없어도 정상 진행", async () => {
    const context = createMockContext({});

    await optionalAuthMiddleware(context, mockNext);

    expect(context.user).toBeUndefined();
  });
});
