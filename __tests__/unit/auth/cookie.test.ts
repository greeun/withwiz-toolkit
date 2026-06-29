/**
 * Unit Tests: JWT Cookie Utility
 *
 * SC-UNIT-COOKIE-001: setTokenCookies / clearTokenCookies 단위 테스트
 *
 * HttpOnly 쿠키로 JWT 토큰을 설정/삭제하는 유틸리티 검증
 */

import { NextResponse } from "next/server";
import { setTokenCookies, clearTokenCookies } from "@withwiz/toolkit/core/auth/jwt";
import { initializeAuth, resetAuth } from "@withwiz/toolkit/core/auth/config";
import type { TokenPair } from "@withwiz/toolkit/core/auth/types";

const mockTokenPair: TokenPair = {
  accessToken: "mock-access-token-value",
  refreshToken: "mock-refresh-token-value",
};

describe("SC-UNIT-COOKIE-001: setTokenCookies", () => {
  beforeEach(() => resetAuth()); // 전역 싱글톤 격리 — 각 TC 미초기화 시작

  test("TC-UNIT-COOKIE-001: access_token 쿠키 설정", () => {
    const response = NextResponse.json({ success: true });
    const result = setTokenCookies(response, mockTokenPair);

    const cookie = result.cookies.get("access_token");
    expect(cookie).toBeDefined();
    expect(cookie!.value).toBe("mock-access-token-value");
  });

  test("TC-UNIT-COOKIE-002: refresh_token 쿠키 설정", () => {
    const response = NextResponse.json({ success: true });
    const result = setTokenCookies(response, mockTokenPair);

    const cookie = result.cookies.get("refresh_token");
    expect(cookie).toBeDefined();
    expect(cookie!.value).toBe("mock-refresh-token-value");
  });

  test("TC-UNIT-COOKIE-003: 원본 response 객체를 그대로 반환", () => {
    const response = NextResponse.json({ success: true });
    const result = setTokenCookies(response, mockTokenPair);

    expect(result).toBe(response); // 동일 참조
  });

  test("TC-UNIT-COOKIE-004: Set-Cookie 헤더에 HttpOnly 포함", () => {
    const response = NextResponse.json({ success: true });
    setTokenCookies(response, mockTokenPair);

    const setCookieHeaders = response.headers.getSetCookie();
    const accessCookie = setCookieHeaders.find((h) =>
      h.startsWith("access_token="),
    );
    const refreshCookie = setCookieHeaders.find((h) =>
      h.startsWith("refresh_token="),
    );

    expect(accessCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("HttpOnly");
  });

  test("TC-UNIT-COOKIE-005: Set-Cookie 헤더에 SameSite=Lax 포함", () => {
    const response = NextResponse.json({ success: true });
    setTokenCookies(response, mockTokenPair);

    const setCookieHeaders = response.headers.getSetCookie();
    const accessCookie = setCookieHeaders.find((h) =>
      h.startsWith("access_token="),
    );

    // Next.js는 SameSite 값을 소문자로 직렬화
    expect(accessCookie?.toLowerCase()).toContain("samesite=lax");
  });

  test("TC-UNIT-COOKIE-006: access_token Path=/, refresh_token Path=/api/auth", () => {
    const response = NextResponse.json({ success: true });
    setTokenCookies(response, mockTokenPair);

    const setCookieHeaders = response.headers.getSetCookie();
    const accessCookie = setCookieHeaders.find((h) =>
      h.startsWith("access_token="),
    );
    const refreshCookie = setCookieHeaders.find((h) =>
      h.startsWith("refresh_token="),
    );

    expect(accessCookie).toContain("Path=/;");
    expect(refreshCookie).toContain("Path=/api/auth");
  });

  test("TC-UNIT-COOKIE-007: maxAge는 auth config 만료값에서 도출 (JWT 만료와 단일 소스)", () => {
    // 미초기화 → JWT_DEFAULTS (access 7d=604800, refresh 30d=2592000)
    const res1 = NextResponse.json({ success: true });
    setTokenCookies(res1, mockTokenPair);
    const h1 = res1.headers.getSetCookie();
    expect(h1.find((c) => c.startsWith("access_token="))).toContain("Max-Age=604800");
    expect(h1.find((c) => c.startsWith("refresh_token="))).toContain("Max-Age=2592000");

    // config 초기화 → accessTokenExpiry/refreshTokenExpiry(=JWT 만료)에서 도출 → 동일 값
    initializeAuth({ jwtSecret: "test-secret", accessTokenExpiry: "15m", refreshTokenExpiry: "7d" });
    const res2 = NextResponse.json({ success: true });
    setTokenCookies(res2, mockTokenPair);
    const h2 = res2.headers.getSetCookie();
    expect(h2.find((c) => c.startsWith("access_token="))).toContain("Max-Age=900");
    expect(h2.find((c) => c.startsWith("refresh_token="))).toContain("Max-Age=604800");
  });

  test("TC-UNIT-COOKIE-007b: accessTokenMaxAge/refreshTokenMaxAge override가 config보다 우선", () => {
    const response = NextResponse.json({ success: true });
    setTokenCookies(response, mockTokenPair, {
      accessTokenMaxAge: 1800,
      refreshTokenMaxAge: 1209600,
    });
    const h = response.headers.getSetCookie();
    expect(h.find((c) => c.startsWith("access_token="))).toContain("Max-Age=1800");
    expect(h.find((c) => c.startsWith("refresh_token="))).toContain("Max-Age=1209600");
  });

  test("TC-UNIT-COOKIE-008: 테스트 환경에서 Secure 미포함 (NODE_ENV=test)", () => {
    const response = NextResponse.json({ success: true });
    setTokenCookies(response, mockTokenPair);

    const setCookieHeaders = response.headers.getSetCookie();
    const accessCookie = setCookieHeaders.find((h) =>
      h.startsWith("access_token="),
    );

    // test 환경에서는 Secure가 없어야 함
    expect(accessCookie).not.toContain("Secure");
  });

  test("TC-UNIT-COOKIE-009: 커스텀 옵션으로 SameSite=Strict 설정", () => {
    const response = NextResponse.json({ success: true });
    setTokenCookies(response, mockTokenPair, { sameSite: "strict" });

    const setCookieHeaders = response.headers.getSetCookie();
    const accessCookie = setCookieHeaders.find((h) =>
      h.startsWith("access_token="),
    );

    expect(accessCookie?.toLowerCase()).toContain("samesite=strict");
  });
});

describe("SC-UNIT-COOKIE-002: clearTokenCookies", () => {
  test("TC-UNIT-COOKIE-010: access_token 쿠키 삭제 (Max-Age=0)", () => {
    const response = NextResponse.json({ success: true });
    clearTokenCookies(response);

    const setCookieHeaders = response.headers.getSetCookie();
    const accessCookie = setCookieHeaders.find((h) =>
      h.startsWith("access_token="),
    );

    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain("Max-Age=0");
  });

  test("TC-UNIT-COOKIE-011: refresh_token 쿠키 삭제 (Max-Age=0)", () => {
    const response = NextResponse.json({ success: true });
    clearTokenCookies(response);

    const setCookieHeaders = response.headers.getSetCookie();
    const refreshCookie = setCookieHeaders.find((h) =>
      h.startsWith("refresh_token="),
    );

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("Max-Age=0");
  });

  test("TC-UNIT-COOKIE-012: 삭제 시 빈 값으로 설정", () => {
    const response = NextResponse.json({ success: true });
    clearTokenCookies(response);

    const accessCookie = response.cookies.get("access_token");
    const refreshCookie = response.cookies.get("refresh_token");

    expect(accessCookie?.value).toBe("");
    expect(refreshCookie?.value).toBe("");
  });

  test("TC-UNIT-COOKIE-013: 원본 response 객체를 그대로 반환", () => {
    const response = NextResponse.json({ success: true });
    const result = clearTokenCookies(response);

    expect(result).toBe(response);
  });
});
