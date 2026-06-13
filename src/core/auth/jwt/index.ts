/**
 * Shared Auth - JWT Core Module
 *
 * JWT 토큰 생성 및 검증 모듈 (프레임워크 독립적)
 * Next.js, Express, Fastify 등 어디서나 사용 가능
 */

import { randomUUID } from "node:crypto";
import {
  SignJWT,
  jwtVerify,
  importPKCS8,
  importSPKI,
  createRemoteJWKSet,
  type CryptoKey,
  type JWTVerifyGetKey,
} from "jose";
import type { JWTConfig, JWTPayload, TokenPair, Logger } from "@withwiz/toolkit/core/auth/types";
import { JWTError } from "@withwiz/toolkit/core/auth/errors";

type SigningKey = Uint8Array | CryptoKey;

// ============================================================================
// JWT Manager Class
// ============================================================================

export class JWTManager {
  private config: JWTConfig;
  private logger: Logger;
  private secretKey?: Uint8Array;
  private signingKeyCache?: Promise<SigningKey>;
  private verifyKeyCache?: Promise<Uint8Array | CryptoKey>;
  private jwks?: JWTVerifyGetKey;

  constructor(config: JWTConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    if (this.isSymmetric()) {
      // HS*(대칭): secret 필수, 32자 이상.
      if (!config.secret || config.secret.length < 32) {
        throw new JWTError("JWT secret must be at least 32 characters long", "TOKEN_CREATION_FAILED");
      }
      this.secretKey = new TextEncoder().encode(config.secret);
    } else {
      // 비대칭: 발급(privateKey) 또는 검증(publicKey/jwksUri) 중 최소 하나 필요.
      if (!config.privateKey && !config.publicKey && !config.jwksUri) {
        throw new JWTError(
          "Asymmetric JWT requires privateKey (sign) and/or publicKey/jwksUri (verify)",
          "TOKEN_CREATION_FAILED",
        );
      }
    }
  }

  private isSymmetric(): boolean {
    return this.config.algorithm.startsWith("HS");
  }

  /** 발급용 키 (HS: secret, 비대칭: PKCS#8 개인키). 결과를 캐시한다. */
  private async getSigningKey(): Promise<SigningKey> {
    if (this.isSymmetric()) {
      return this.secretKey!;
    }
    if (!this.config.privateKey) {
      throw new JWTError("No privateKey configured for signing", "TOKEN_CREATION_FAILED");
    }
    this.signingKeyCache ??= importPKCS8(this.config.privateKey, this.config.algorithm);
    return this.signingKeyCache;
  }

  /**
   * 검증용 키를 jose getKey 함수로 정규화해 반환한다 (HS: secret, 비대칭:
   * SPKI 공개키 또는 원격 JWKS). 정적 키도 함수로 감싸 단일 호출 경로를 쓰며,
   * jose 는 함수 호출 전 알고리즘 allowlist 를 검증하므로 confusion 가드는 유지된다.
   */
  private async getVerifyKey(): Promise<JWTVerifyGetKey> {
    if (this.isSymmetric()) {
      const key = this.secretKey!;
      return async () => key;
    }
    if (this.config.jwksUri) {
      this.jwks ??= createRemoteJWKSet(new URL(this.config.jwksUri));
      return this.jwks;
    }
    if (this.config.publicKey) {
      this.verifyKeyCache ??= importSPKI(this.config.publicKey, this.config.algorithm);
      const key = await this.verifyKeyCache;
      return async () => key;
    }
    throw new JWTError("No publicKey or jwksUri configured for verification", "TOKEN_VERIFICATION_FAILED");
  }

  /**
   * Access JWT 토큰 생성
   */
  async createAccessToken(
    payload: Omit<JWTPayload, "iat" | "exp">,
  ): Promise<string> {
    try {
      const jwt = await new SignJWT({ ...payload, tokenType: "access" })
        .setProtectedHeader({ alg: this.config.algorithm })
        .setIssuedAt()
        .setExpirationTime(this.config.accessTokenExpiry)
        .sign(await this.getSigningKey());

      this.logger.debug("Access token created successfully", {
        userId: payload.userId,
        expiresIn: this.config.accessTokenExpiry,
      });

      return jwt;
    } catch (error) {
      this.logger.error("Failed to create access token", { error, userId: payload.userId });
      throw new JWTError(
        "Access token creation failed",
        "TOKEN_CREATION_FAILED",
      );
    }
  }

  /**
   * Refresh 토큰 생성
   *
   * rotation/reuse detection 용 `jti`(토큰 고유 id)와 `familyId`(회전 계보 id)를
   * 함께 발급할 수 있다. 미지정 시 0.8 이전과 동일하게 식별자 없는 refresh
   * 토큰을 만든다(하위 호환).
   */
  async createRefreshToken(
    userId: string,
    options?: { jti?: string; familyId?: string },
  ): Promise<string> {
    try {
      const payload: Record<string, unknown> = {
        userId,
        tokenType: "refresh",
      };
      if (options?.jti) payload.jti = options.jti;
      if (options?.familyId) payload.familyId = options.familyId;

      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: this.config.algorithm })
        .setIssuedAt()
        .setExpirationTime(this.config.refreshTokenExpiry)
        .sign(await this.getSigningKey());

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
  async createTokenPair(
    user: {
      id: string;
      email: string;
      role: string;
      emailVerified?: Date | null;
    },
    options?: { jti?: string; familyId?: string },
  ): Promise<TokenPair> {
    try {
      // 신규 refresh 는 기본으로 jti+familyId 를 부여한다 → 첫 회전부터
      // rotation/reuse detection 이 동작한다. 소비자가 명시하면 그 값을 쓴다.
      const jti = options?.jti ?? randomUUID();
      const familyId = options?.familyId ?? randomUUID();

      const [accessToken, refreshToken] = await Promise.all([
        this.createAccessToken({
          id: user.id,
          userId: user.id,
          email: user.email,
          role: user.role as any,
          emailVerified: user.emailVerified,
        }),
        this.createRefreshToken(user.id, { jti, familyId }),
      ]);

      this.logger.debug("Token pair created successfully", { userId: user.id, familyId });

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
  async verifyAccessToken<TRole extends string = string>(
    token: string,
  ): Promise<JWTPayload<TRole>> {
    try {
      const { payload } = await jwtVerify(token, await this.getVerifyKey(), {
        algorithms: [this.config.algorithm] as const,
      });

      // 페이로드 타입 검증
      const userId = (payload.userId || payload.sub || payload.id) as string;
      if (!userId || !payload.email || !payload.role) {
        throw new JWTError("Invalid JWT payload structure", "INVALID_PAYLOAD");
      }

      // 토큰 혼동 방지(J-1): tokenType 이 명시되었으면 'access' 여야 한다.
      // tokenType 부재는 0.7 이전 레거시 access 토큰으로 간주해 허용
      // (업그레이드 시 기존 발급 access 토큰 대량 무효화 방지).
      if (payload.tokenType !== undefined && payload.tokenType !== "access") {
        throw new JWTError("Token is not an access token", "INVALID_PAYLOAD");
      }

      this.logger.debug("Access token verified successfully", {
        userId,
      });

      return {
        id: userId,
        userId: userId,
        email: payload.email as string,
        // role 은 신뢰 불가 토큰에서 옴 — TRole 단언은 소비자 어휘로의 타입 편의일 뿐
        // 런타임 검증은 아니다.
        role: payload.role as TRole,
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
  ): Promise<{ userId: string; tokenType: string; jti?: string; familyId?: string }> {
    try {
      const { payload } = await jwtVerify(token, await this.getVerifyKey(), {
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
        jti: typeof payload.jti === "string" ? payload.jti : undefined,
        familyId: typeof payload.familyId === "string" ? payload.familyId : undefined,
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

  constructor(config: JWTConfig, logger?: Logger) {
    const resolvedLogger: Logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    this.manager = new JWTManager(config, resolvedLogger);
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
  async verify<TRole extends string = string>(
    token: string,
  ): Promise<JWTPayload<TRole>> {
    return this.manager.verifyAccessToken<TRole>(token);
  }

  /**
   * Refresh 토큰 생성
   */
  async createRefreshToken(
    userId: string,
    options?: { jti?: string; familyId?: string },
  ): Promise<string> {
    return this.manager.createRefreshToken(userId, options);
  }

  /**
   * Refresh 토큰 검증
   */
  async verifyRefreshToken(
    token: string,
  ): Promise<{ userId: string; tokenType: string; jti?: string; familyId?: string }> {
    return this.manager.verifyRefreshToken(token);
  }

  /**
   * 토큰 쌍 생성
   */
  async createTokenPair(
    user: {
      id: string;
      email: string;
      role: string;
      emailVerified?: Date | null;
    },
    options?: { jti?: string; familyId?: string },
  ): Promise<TokenPair> {
    return this.manager.createTokenPair(user, options);
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
  async verifyAccessToken<TRole extends string = string>(
    token: string,
  ): Promise<JWTPayload<TRole>> {
    return this.manager.verifyAccessToken<TRole>(token);
  }

  /**
   * Authorization 헤더에서 토큰 추출
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    return this.manager.extractTokenFromHeader(authHeader ?? null);
  }
}

// Cookie utilities
export { setTokenCookies, clearTokenCookies } from '@withwiz/toolkit/core/auth/jwt/cookie';
export type { CookieOptions } from '@withwiz/toolkit/core/auth/jwt/cookie';

// Export types
export type { JWTConfig, JWTPayload, TokenPair };
