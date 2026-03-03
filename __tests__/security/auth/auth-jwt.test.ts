/**
 * Unit Tests: @withwiz/auth JWT module tests
 * Based on: TEST_SCENARIOS.md - auth module
 */

import { JWTService, JWTManager } from "@withwiz/auth/core/jwt";
import { JWTError } from "@withwiz/auth/errors";
import type { JWTConfig } from "@withwiz/auth/types";

// JWT configuration for testing
const testConfig: JWTConfig = {
  secret: "test-secret-key-that-is-at-least-32-characters-long",
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "7d",
  algorithm: "HS256",
};

// Configuration for short expiry time test
const shortExpiryConfig: JWTConfig = {
  secret: "test-secret-key-that-is-at-least-32-characters-long",
  accessTokenExpiry: "1s",
  refreshTokenExpiry: "2s",
  algorithm: "HS256",
};

// User information for testing
const testUser = {
  id: "user-123",
  email: "test@example.com",
  role: "USER",
  emailVerified: new Date(),
};

// ============================================================================
// SC-AUTH-JWT-001: JWT 토큰 생성
// ============================================================================
describe("SC-AUTH-JWT-001: JWT token creation", () => {
  let jwtService: JWTService;

  beforeAll(() => {
    jwtService = new JWTService(testConfig);
  });

  // TC-AUTH-JWT-001: Create Access token
  test("TC-AUTH-JWT-001: Create Access token", async () => {
    const payload = {
      id: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role as any,
      emailVerified: testUser.emailVerified,
    };

    const token = await jwtService.createAccessToken(payload);

    // Verify JWT format (header.payload.signature)
    expect(token).toBeDefined();
    expect(token.split(".")).toHaveLength(3);
  });

  // TC-AUTH-JWT-002: Create Refresh token
  test("TC-AUTH-JWT-002: Create Refresh token", async () => {
    const token = await jwtService.createRefreshToken(testUser.id);

    expect(token).toBeDefined();
    expect(token.split(".")).toHaveLength(3);

    // Verify Refresh token
    const verified = await jwtService.verifyRefreshToken(token);
    expect(verified.userId).toBe(testUser.id);
    expect(verified.tokenType).toBe("refresh");
  });

  // TC-AUTH-JWT-003: Create token pair
  test("TC-AUTH-JWT-003: Create token pair", async () => {
    const tokenPair = await jwtService.createTokenPair(testUser);

    expect(tokenPair).toHaveProperty("accessToken");
    expect(tokenPair).toHaveProperty("refreshToken");
    expect(tokenPair.accessToken.split(".")).toHaveLength(3);
    expect(tokenPair.refreshToken.split(".")).toHaveLength(3);
  });
});

// ============================================================================
// SC-AUTH-JWT-002: JWT 토큰 검증
// ============================================================================
describe("SC-AUTH-JWT-002: JWT token verification", () => {
  let jwtService: JWTService;

  beforeAll(() => {
    jwtService = new JWTService(testConfig);
  });

  // TC-AUTH-JWT-004: Verify valid Access token
  test("TC-AUTH-JWT-004: Verify valid Access token", async () => {
    const payload = {
      id: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role as any,
      emailVerified: testUser.emailVerified,
    };

    const token = await jwtService.createAccessToken(payload);
    const verified = await jwtService.verifyAccessToken(token);

    expect(verified.userId).toBe(testUser.id);
    expect(verified.email).toBe(testUser.email);
    expect(verified.role).toBe(testUser.role);
  });

  // TC-AUTH-JWT-006: Verify token with invalid signature
  test("TC-AUTH-JWT-006: Verify token with invalid signature", async () => {
    // Create token signed with a different secret
    const otherService = new JWTService({
      ...testConfig,
      secret: "another-secret-key-that-is-at-least-32-characters-long",
    });

    const token = await otherService.createAccessToken({
      id: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role as any,
    });

    // Attempt verification with the original service
    await expect(jwtService.verifyAccessToken(token)).rejects.toThrow(JWTError);
  });
});

// ============================================================================
// SC-AUTH-JWT-003: Token expiration handling
// ============================================================================
describe("SC-AUTH-JWT-003: Token expiration handling", () => {
  // TC-AUTH-JWT-005: Verify expired token
  test("TC-AUTH-JWT-005: Verify expired token", async () => {
    const shortService = new JWTService(shortExpiryConfig);

    const payload = {
      id: testUser.id,
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role as any,
    };

    const token = await shortService.createAccessToken(payload);

    // Wait 2 seconds (1 second expiry + buffer)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await expect(shortService.verifyAccessToken(token)).rejects.toThrow(
      JWTError,
    );
  }, 10000);
});

// ============================================================================
// SC-AUTH-JWT-004: Token header extraction
// ============================================================================
describe("SC-AUTH-JWT-004: Token header extraction", () => {
  let jwtService: JWTService;

  beforeAll(() => {
    jwtService = new JWTService(testConfig);
  });

  // TC-AUTH-JWT-007: Authorization header extraction - Bearer
  test("TC-AUTH-JWT-007: Authorization header extraction - Bearer", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";
    const header = `Bearer ${token}`;

    const extracted = jwtService.extractTokenFromHeader(header);
    expect(extracted).toBe(token);
  });

  // TC-AUTH-JWT-008: Authorization header extraction - Invalid format
  test("TC-AUTH-JWT-008: Authorization header extraction - Invalid format", () => {
    expect(jwtService.extractTokenFromHeader(undefined)).toBeNull();
    expect(jwtService.extractTokenFromHeader("Basic xxx")).toBeNull();
    expect(jwtService.extractTokenFromHeader("Bearer")).toBeNull();
    expect(jwtService.extractTokenFromHeader("")).toBeNull();
  });
});

// ============================================================================
// TC-AUTH-JWT-010: Short secret error
// ============================================================================
describe("JWT configuration validation", () => {
  test("TC-AUTH-JWT-010: Short secret error", () => {
    const shortSecretConfig: JWTConfig = {
      secret: "short", // 32자 미만
      accessTokenExpiry: "15m",
      refreshTokenExpiry: "7d",
      algorithm: "HS256",
    };

    expect(() => new JWTService(shortSecretConfig)).toThrow(
      "JWT secret must be at least 32 characters long",
    );
  });
});
