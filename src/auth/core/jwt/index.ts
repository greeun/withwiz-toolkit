/**
 * Shared Auth - JWT Core Module
 *
 * JWT 토큰 생성 및 검증 모듈 (프레임워크 독립적)
 * Next.js, Express, Fastify 등 어디서나 사용 가능
 */

import { SignJWT, jwtVerify } from "jose";
import type { JWTConfig, JWTPayload, TokenPair, Logger } from "@withwiz/auth/types";
import { JWTError } from "@withwiz/auth/errors";

// ============================================================================
// JWT Manager Class
// ============================================================================

export class JWTManager {
  private config: JWTConfig;
  private logger: Logger;
  private secretKey: Uint8Array;

  constructor(config: JWTConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.secretKey = new TextEncoder().encode(config.secret);

    // 보안 검증
    if (config.secret.length < 32) {
      throw new JWTError("JWT secret must be at least 32 characters long", "TOKEN_CREATION_FAILED");
    }
  }

  /**
   * Access JWT 토큰 생성
   */
  async createAccessToken(
    payload: Omit<JWTPayload, "iat" | "exp">,
  ): Promise<string> {
    try {
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: this.config.algorithm })
        .setIssuedAt()
        .setExpirationTime(this.config.accessTokenExpiry)
        .sign(this.secretKey);

      this.logger.debug("Access token created successfully", {
        userId: payload.userId,
        expiresIn: this.config.accessTokenExpiry,
      });

      return jwt;
    } catch (error) {
      this.logger.error("Failed to create access token", { error, payload });
      throw new JWTError(
        "Access token creation failed",
        "TOKEN_CREATION_FAILED",
      );
    }
  }

  /**
   * Refresh 토큰 생성
   */
  async createRefreshToken(userId: string): Promise<string> {
    try {
      const payload = {
        userId,
        tokenType: "refresh",
      };

      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: this.config.algorithm })
        .setIssuedAt()
        .setExpirationTime(this.config.refreshTokenExpiry)
        .sign(this.secretKey);

      this.logger.debug("Refresh token created successfully", {
        userId,
        expiresIn: this.config.refreshTokenExpiry,
      });

      return jwt;
    } catch (error) {
      this.logger.error("Failed to create refresh token", { error, userId });
      throw new JWTError(
        "Refresh token creation failed",
        "TOKEN_CREATION_FAILED",
      );
    }
  }

  /**
   * 토큰 쌍 생성 (Access + Refresh)
   */
  async createTokenPair(user: {
    id: string;
    email: string;
    role: string;
    emailVerified?: Date | null;
  }): Promise<TokenPair> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.createAccessToken({
          id: user.id,
          userId: user.id,
          email: user.email,
          role: user.role as any,
          emailVerified: user.emailVerified,
        }),
        this.createRefreshToken(user.id),
      ]);

      this.logger.debug("Token pair created successfully", { userId: user.id });

      return { accessToken, refreshToken };
    } catch (error) {
      this.logger.error("Failed to create token pair", {
        error,
        userId: user.id,
      });
      throw new JWTError("Token pair creation failed", "TOKEN_CREATION_FAILED");
    }
  }

  /**
   * Access JWT 토큰 검증
   */
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey, {
        algorithms: [this.config.algorithm] as const,
      });

      // 페이로드 타입 검증
      const userId = (payload.userId || payload.sub || payload.id) as string;
      if (!userId || !payload.email || !payload.role) {
        throw new JWTError("Invalid JWT payload structure", "INVALID_PAYLOAD");
      }

      this.logger.debug("Access token verified successfully", {
        userId,
      });

      return {
        id: userId,
        userId: userId,
        email: payload.email as string,
        role: payload.role as any,
        emailVerified: payload.emailVerified as Date | null | undefined,
        tokenType: payload.tokenType as "access" | "refresh" | undefined,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error: any) {
      this.logger.error("Failed to verify access token", {
        error: error.message,
        token: token.substring(0, 20) + "...",
      });

      if (error.code === "ERR_JWT_EXPIRED") {
        throw new JWTError("Token has expired", "TOKEN_EXPIRED");
      }

      throw new JWTError(
        "Token verification failed",
        "TOKEN_VERIFICATION_FAILED",
      );
    }
  }

  /**
   * Refresh 토큰 검증
   */
  async verifyRefreshToken(
    token: string,
  ): Promise<{ userId: string; tokenType: string }> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey, {
        algorithms: [this.config.algorithm] as const,
      });

      // Refresh 토큰 타입 검증
      const userId = (payload.userId || payload.sub || payload.id) as string;
      if (!userId || payload.tokenType !== "refresh") {
        throw new JWTError(
          "Invalid refresh token payload structure",
          "INVALID_PAYLOAD",
        );
      }

      this.logger.debug("Refresh token verified successfully", {
        userId,
      });

      return {
        userId,
        tokenType: payload.tokenType as string,
      };
    } catch (error: any) {
      this.logger.error("Failed to verify refresh token", {
        error: error.message,
        token: token.substring(0, 20) + "...",
      });

      if (error.code === "ERR_JWT_EXPIRED") {
        throw new JWTError(
          "Refresh token has expired",
          "REFRESH_TOKEN_EXPIRED",
        );
      }

      throw new JWTError(
        "Refresh token verification failed",
        "TOKEN_VERIFICATION_FAILED",
      );
    }
  }

  /**
   * Authorization 헤더에서 토큰 추출
   */
  extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * 토큰 만료 여부 확인
   */
  isTokenExpired(payload: JWTPayload): boolean {
    if (!payload.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  }

  /**
   * 토큰 남은 시간 (초)
   */
  getTokenRemainingTime(payload: JWTPayload): number {
    if (!payload.exp) {
      return 0;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const remainingTime = payload.exp - currentTime;

    return Math.max(0, remainingTime);
  }

  /**
   * 토큰에서 사용자 정보 추출
   */
  extractUserFromPayload(payload: JWTPayload) {
    return {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  }
}

// ============================================================================
// JWTService (간단한 wrapper - 테스트 및 기본 사용을 위한 클래스)
// ============================================================================

/**
 * JWTService는 JWTManager의 간단한 wrapper로, Logger 없이 사용 가능합니다.
 * 테스트 및 간단한 사용 사례를 위한 클래스입니다.
 */
export class JWTService {
  private manager: JWTManager;

  constructor(config: JWTConfig) {
    // 간단한 console logger 사용
    const logger: Logger = {
      debug: () => {}, // 테스트에서는 로그 출력 안 함
      info: () => {},
      warn: () => {},
      error: (message: string, meta?: any) => {
        // 테스트 디버깅을 위해 에러는 출력
        if (process.env.NODE_ENV === "test") {
          console.error("[JWTService Error]", message, meta);
        }
      },
    };

    this.manager = new JWTManager(config, logger);
  }

  /**
   * Access 토큰 생성 (sign으로 alias)
   */
  async sign(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
    return this.manager.createAccessToken(payload);
  }

  /**
   * 토큰 검증
   */
  async verify(token: string): Promise<JWTPayload> {
    return this.manager.verifyAccessToken(token);
  }

  /**
   * Refresh 토큰 생성
   */
  async createRefreshToken(userId: string): Promise<string> {
    return this.manager.createRefreshToken(userId);
  }

  /**
   * Refresh 토큰 검증
   */
  async verifyRefreshToken(
    token: string,
  ): Promise<{ userId: string; tokenType: string }> {
    return this.manager.verifyRefreshToken(token);
  }

  /**
   * 토큰 쌍 생성
   */
  async createTokenPair(user: {
    id: string;
    email: string;
    role: string;
    emailVerified?: Date | null;
  }): Promise<TokenPair> {
    return this.manager.createTokenPair(user);
  }

  /**
   * Access 토큰 생성
   */
  async createAccessToken(
    payload: Omit<JWTPayload, "iat" | "exp">,
  ): Promise<string> {
    return this.manager.createAccessToken(payload);
  }

  /**
   * Access 토큰 검증
   */
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    return this.manager.verifyAccessToken(token);
  }

  /**
   * Authorization 헤더에서 토큰 추출
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    return this.manager.extractTokenFromHeader(authHeader ?? null);
  }
}

// Export types
export type { JWTConfig, JWTPayload, TokenPair };
