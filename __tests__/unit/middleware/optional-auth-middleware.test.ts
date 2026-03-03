/**
 * Unit Tests: optionalAuthMiddleware
 * Based on: docs/testing/03-api/25-url-entry-optional-auth.md
 *
 * SC-UNIT-OPTAUTH-001: optionalAuthMiddleware 단위 테스트
 *
 * optionalAuthMiddleware는 인증이 선택적인 API에서 사용됩니다.
 * - 토큰이 있으면 검증하여 context.user 설정
 * - 토큰이 없거나 유효하지 않아도 에러 없이 next() 호출
 */

import { JWTService } from "@withwiz/auth/core/jwt";
import type { JWTConfig } from "@withwiz/auth/types";
import type { IApiContext } from "@withwiz/middleware/types";
import { NextResponse } from "next/server";

// JWT 설정 (테스트용)
const testConfig: JWTConfig = {
  secret: "test-secret-key-that-is-at-least-32-characters-long",
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "7d",
  algorithm: "HS256",
};

// 짧은 만료 시간 설정 (만료 토큰 테스트용)
const shortExpiryConfig: JWTConfig = {
  secret: "test-secret-key-that-is-at-least-32-characters-long",
  accessTokenExpiry: "1s",
  refreshTokenExpiry: "2s",
  algorithm: "HS256",
};

const testUser = {
  id: "user-optauth-test-001",
  email: "optauth-test@example.com",
  role: "USER" as const,
  emailVerified: new Date(),
};

// ============================================================================
// Helper: JWT_SECRET 환경변수를 설정하여 optionalAuthMiddleware가 동작하도록 함
// ============================================================================
let validAccessToken: string;
let expiredAccessToken: string;

beforeAll(async () => {
  // optionalAuthMiddleware가 JWT Manager를 초기화할 수 있도록 환경변수 설정
  process.env.JWT_SECRET =
    "test-secret-key-that-is-at-least-32-characters-long";
  process.env.JWT_EXPIRES_IN = "15m";
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN = "7d";

  // 유효한 Access Token 생성
  const jwtService = new JWTService(testConfig);
  validAccessToken = await jwtService.createAccessToken({
    id: testUser.id,
    userId: testUser.id,
    email: testUser.email,
    role: testUser.role,
    emailVerified: testUser.emailVerified,
  });

  // 만료된 Access Token 생성
  const shortJwtService = new JWTService(shortExpiryConfig);
  expiredAccessToken = await shortJwtService.createAccessToken({
    id: testUser.id,
    userId: testUser.id,
    email: testUser.email,
    role: testUser.role,
    emailVerified: testUser.emailVerified,
  });

  // 토큰이 만료될 때까지 대기
  await new Promise((resolve) => setTimeout(resolve, 1500));
});

/**
 * Mock NextRequest 생성 헬퍼
 */
function createMockRequest(
  authHeader?: string
): IApiContext["request"] {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (authHeader) {
    headers.set("authorization", authHeader);
  }

  return {
    headers,
    method: "POST",
    url: "http://localhost:3000/api/a/create",
  } as unknown as IApiContext["request"];
}

/**
 * Mock IApiContext 생성 헬퍼
 */
function createMockContext(authHeader?: string): IApiContext {
  return {
    request: createMockRequest(authHeader),
    locale: "ko",
    requestId: "test-request-id",
    startTime: Date.now(),
    metadata: {},
  };
}

// ============================================================================
// SC-UNIT-OPTAUTH-001: optionalAuthMiddleware 단위 테스트
// ============================================================================
describe("SC-UNIT-OPTAUTH-001: optionalAuthMiddleware 단위 테스트", () => {
  // 동적 import로 모듈 캐시 문제 회피
  let optionalAuthMiddleware: any;

  beforeAll(async () => {
    // JWT_SECRET 환경변수가 설정된 후 import
    const authModule = await import("@withwiz/middleware/auth");
    optionalAuthMiddleware = authModule.optionalAuthMiddleware;
  });

  // TC-UNIT-OPTAUTH-001: 토큰 없이 요청 시 context.user 미설정
  test("TC-UNIT-OPTAUTH-001: 토큰 없이 요청 시 context.user 미설정", async () => {
    const context = createMockContext(); // Authorization 헤더 없음
    let nextCalled = false;

    const mockNext = async () => {
      nextCalled = true;
      return NextResponse.json({ ok: true });
    };

    await optionalAuthMiddleware(context, mockNext);

    // context.user는 설정되지 않아야 함
    expect(context.user).toBeUndefined();
    // next()는 정상 호출되어야 함
    expect(nextCalled).toBe(true);
  });

  // TC-UNIT-OPTAUTH-002: 유효한 토큰으로 요청 시 context.user 설정
  test("TC-UNIT-OPTAUTH-002: 유효한 토큰으로 요청 시 context.user 설정", async () => {
    const context = createMockContext(`Bearer ${validAccessToken}`);
    let nextCalled = false;

    const mockNext = async () => {
      nextCalled = true;
      return NextResponse.json({ ok: true });
    };

    await optionalAuthMiddleware(context, mockNext);

    // context.user가 설정되어야 함
    expect(context.user).toBeDefined();
    expect(context.user!.id).toBe(testUser.id);
    expect(context.user!.email).toBe(testUser.email);
    expect(context.user!.role).toBe("USER");
    // next()도 정상 호출
    expect(nextCalled).toBe(true);
  });

  // TC-UNIT-OPTAUTH-003: 만료된 토큰으로 요청 시 에러 없이 진행
  test("TC-UNIT-OPTAUTH-003: 만료된 토큰으로 요청 시 에러 없이 진행", async () => {
    const context = createMockContext(`Bearer ${expiredAccessToken}`);
    let nextCalled = false;

    const mockNext = async () => {
      nextCalled = true;
      return NextResponse.json({ ok: true });
    };

    // 에러 없이 실행되어야 함
    await expect(
      optionalAuthMiddleware(context, mockNext)
    ).resolves.toBeDefined();

    // context.user는 설정되지 않아야 함 (만료 토큰)
    expect(context.user).toBeUndefined();
    // next()는 정상 호출되어야 함
    expect(nextCalled).toBe(true);
  });

  // TC-UNIT-OPTAUTH-004: 잘못된 형식의 토큰으로 요청
  test("TC-UNIT-OPTAUTH-004: 잘못된 형식의 토큰으로 요청", async () => {
    const context = createMockContext("Bearer invalid-token-format");
    let nextCalled = false;

    const mockNext = async () => {
      nextCalled = true;
      return NextResponse.json({ ok: true });
    };

    // 에러 없이 실행되어야 함
    await expect(
      optionalAuthMiddleware(context, mockNext)
    ).resolves.toBeDefined();

    // context.user는 설정되지 않아야 함
    expect(context.user).toBeUndefined();
    // next()는 정상 호출되어야 함
    expect(nextCalled).toBe(true);
  });

  // TC-UNIT-OPTAUTH-005: Authorization 헤더만 있고 토큰 값이 없는 경우
  test("TC-UNIT-OPTAUTH-005: 빈 Bearer 토큰으로 요청", async () => {
    const context = createMockContext("Bearer ");
    let nextCalled = false;

    const mockNext = async () => {
      nextCalled = true;
      return NextResponse.json({ ok: true });
    };

    await optionalAuthMiddleware(context, mockNext);

    // context.user는 설정되지 않아야 함
    expect(context.user).toBeUndefined();
    // next()는 정상 호출되어야 함
    expect(nextCalled).toBe(true);
  });
});

// ============================================================================
// authMiddleware와의 동작 차이 검증
// ============================================================================
describe("optionalAuthMiddleware vs authMiddleware 동작 차이", () => {
  let optionalAuthMiddleware: any;
  let authMiddleware: any;

  beforeAll(async () => {
    const authModule = await import("@withwiz/middleware/auth");
    optionalAuthMiddleware = authModule.optionalAuthMiddleware;
    authMiddleware = authModule.authMiddleware;
  });

  test("authMiddleware: 토큰 없으면 에러 발생", async () => {
    const context = createMockContext(); // 토큰 없음
    const mockNext = async () => NextResponse.json({ ok: true });

    // authMiddleware는 에러를 발생시켜야 함
    await expect(authMiddleware(context, mockNext)).rejects.toThrow();
  });

  test("optionalAuthMiddleware: 토큰 없어도 정상 진행", async () => {
    const context = createMockContext(); // 토큰 없음
    const mockNext = async () => NextResponse.json({ ok: true });

    // optionalAuthMiddleware는 에러 없이 진행
    await expect(
      optionalAuthMiddleware(context, mockNext)
    ).resolves.toBeDefined();
    expect(context.user).toBeUndefined();
  });

  test("두 미들웨어 모두 유효 토큰 시 context.user 설정", async () => {
    // optionalAuth
    const ctx1 = createMockContext(`Bearer ${validAccessToken}`);
    await optionalAuthMiddleware(ctx1, async () =>
      NextResponse.json({ ok: true })
    );

    // authMiddleware
    const ctx2 = createMockContext(`Bearer ${validAccessToken}`);
    await authMiddleware(ctx2, async () => NextResponse.json({ ok: true }));

    // 두 미들웨어 모두 같은 사용자 정보 설정
    expect(ctx1.user).toBeDefined();
    expect(ctx2.user).toBeDefined();
    expect(ctx1.user!.id).toBe(ctx2.user!.id);
    expect(ctx1.user!.email).toBe(ctx2.user!.email);
  });
});
