/**
 * authMiddleware / optionalAuthMiddleware 의 tokenDelivery 모드별 토큰 추출 검증.
 * cookie: 쿠키만 (헤더 무시) / header: 헤더만 (쿠키 무시) / hybrid: 쿠키 → 헤더 폴백
 */
import { JWTService } from "@withwiz/core/auth/jwt";
import type { JWTConfig } from "@withwiz/core/auth/types";
import type { IApiContext } from "@withwiz/next/middleware/types";
import { NextResponse } from "next/server";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "@withwiz/next/middleware/auth";
import { initializeAuth, resetAuth } from "../../../src/core/auth/config";
import type { TokenDelivery } from "../../../src/core/auth/config";

const testConfig: JWTConfig = {
  secret: "test-secret-key-that-is-at-least-32-characters-long",
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "7d",
  algorithm: "HS256",
};

let validToken: string;

beforeAll(async () => {
  const jwtService = new JWTService(testConfig);
  validToken = await jwtService.createAccessToken({
    id: "user-mode-test",
    userId: "user-mode-test",
    email: "mode@example.com",
    role: "USER",
    emailVerified: new Date(),
  });
});

function initMode(mode: TokenDelivery) {
  resetAuth();
  initializeAuth({
    jwtSecret: testConfig.secret,
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    tokenDelivery: mode,
  });
}

afterEach(() => resetAuth());

function createMockContext(options: {
  authHeader?: string;
  cookieToken?: string;
}): IApiContext {
  const headers = new Headers();
  if (options.authHeader) headers.set("authorization", options.authHeader);
  const request = {
    headers,
    cookies: {
      get: (name: string) =>
        name === "access_token" && options.cookieToken
          ? { name, value: options.cookieToken }
          : undefined,
    },
    method: "GET",
    url: "http://localhost:3000/api/test",
  };
  return { request } as unknown as IApiContext;
}

const next = () => Promise.resolve(NextResponse.json({ ok: true }));

describe("authMiddleware tokenDelivery 모드", () => {
  it("cookie 모드: 쿠키 토큰으로 인증된다", async () => {
    initMode("cookie");
    const ctx = createMockContext({ cookieToken: validToken });
    await authMiddleware(ctx, next);
    expect(ctx.user?.id).toBe("user-mode-test");
  });

  it("cookie 모드: Authorization 헤더는 무시된다", async () => {
    initMode("cookie");
    const ctx = createMockContext({ authHeader: `Bearer ${validToken}` });
    await expect(authMiddleware(ctx, next)).rejects.toThrow();
  });

  it("header 모드: 헤더 토큰으로 인증된다", async () => {
    initMode("header");
    const ctx = createMockContext({ authHeader: `Bearer ${validToken}` });
    await authMiddleware(ctx, next);
    expect(ctx.user?.id).toBe("user-mode-test");
  });

  it("header 모드: 쿠키는 무시된다", async () => {
    initMode("header");
    const ctx = createMockContext({ cookieToken: validToken });
    await expect(authMiddleware(ctx, next)).rejects.toThrow();
  });

  it("hybrid 모드: 쿠키 우선, 헤더 폴백 둘 다 동작한다", async () => {
    initMode("hybrid");
    const viaCookie = createMockContext({ cookieToken: validToken });
    await authMiddleware(viaCookie, next);
    expect(viaCookie.user?.id).toBe("user-mode-test");

    const viaHeader = createMockContext({ authHeader: `Bearer ${validToken}` });
    await authMiddleware(viaHeader, next);
    expect(viaHeader.user?.id).toBe("user-mode-test");
  });
});

describe("optionalAuthMiddleware tokenDelivery 모드", () => {
  it("cookie 모드: 헤더만 있으면 user 미설정으로 통과한다", async () => {
    initMode("cookie");
    const ctx = createMockContext({ authHeader: `Bearer ${validToken}` });
    await optionalAuthMiddleware(ctx, next);
    expect(ctx.user).toBeUndefined();
  });

  it("header 모드: 쿠키만 있으면 user 미설정으로 통과한다", async () => {
    initMode("header");
    const ctx = createMockContext({ cookieToken: validToken });
    await optionalAuthMiddleware(ctx, next);
    expect(ctx.user).toBeUndefined();
  });
});
