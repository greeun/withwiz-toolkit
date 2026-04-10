/**
 * Unit Tests: JWT Cookie Utility
 *
 * SC-UNIT-COOKIE-001: setTokenCookies / clearTokenCookies 단위 테스트
 *
 * HttpOnly 쿠키로 JWT 토큰을 설정/삭제하는 유틸리티 검증
 */

import { NextResponse } from "next/server";
import { setTokenCookies, clearTokenCookies } from "@withwiz/auth/core/jwt";
import type { TokenPair } from "@withwiz/auth/types";

const mockTokenPair: TokenPair = {
  accessToken: "mock-access-token-value",
  refreshToken: "mock-refresh-token-value",
};

describe("SC-UNIT-COOKIE-001: setTokenCookies", () => {
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

  test("TC-UNIT-COOKIE-007: access_token Max-Age=900, refresh_token Max-Age=604800", () => {
    const response = NextResponse.json({ success: true });
    setTokenCookies(response, mockTokenPair);

    const setCookieHeaders = response.headers.getSetCookie();
    const accessCookie = setCookieHeaders.find((h) =>
      h.startsWith("access_token="),
    );
    const refreshCookie = setCookieHeaders.find((h) =>
      h.startsWith("refresh_token="),
    );

    expect(accessCookie).toContain("Max-Age=900");
    expect(refreshCookie).toContain("Max-Age=604800");
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
