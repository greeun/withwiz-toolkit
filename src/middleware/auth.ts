/**
 * 인증 미들웨어
 *
 * - JWT 토큰 검증
 * - Access Token 블랙리스트 체크
 * - 사용자 정보 context에 추가
 * - 인증 실패 시 401 에러
 *
 * 완전 독립적 패키지:
 * @withwiz/auth/core/jwt를 사용하여 비즈니스 로직에 의존하지 않음
 */

import type { TApiMiddleware } from "./types";
import { AppError } from "@withwiz/error/app-error";
import { ERROR_CODES } from "@withwiz/constants/error-codes";
import { JWTManager } from "@withwiz/auth/core/jwt";
import { logger as winstonLogger } from "@withwiz/logger/logger";
import { getAuthConfig } from "../auth/config";

// ============================================================================
// Access Token Blacklist Checker (의존성 주입 방식)
// ============================================================================

/**
 * Access Token 블랙리스트 체커 인터페이스
 * src/lib/services/auth/refreshTokenService에서 구현체 주입
 */
export interface IAccessTokenBlacklistChecker {
  isAccessTokenRevoked(token: string): Promise<boolean>;
}

// globalThis를 사용하여 Next.js 핫 리로드/서버리스 환경에서도 상태 유지
declare global {
  // eslint-disable-next-line no-var
  var __accessTokenBlacklistChecker: IAccessTokenBlacklistChecker | undefined;
}

/**
 * Access Token 블랙리스트 체커 설정
 * 애플리케이션 시작 시 refreshTokenService를 주입
 */
export function setAccessTokenBlacklistChecker(
  checker: IAccessTokenBlacklistChecker,
): void {
  globalThis.__accessTokenBlacklistChecker = checker;
  winstonLogger.info(
    "[Auth Middleware] Access Token blacklist checker configured",
  );
}

/**
 * Access Token 블랙리스트 체커 가져오기
 */
function getAccessTokenChecker(): IAccessTokenBlacklistChecker | null {
  return globalThis.__accessTokenBlacklistChecker ?? null;
}

// ============================================================================
// JWT Manager 싱글톤 (환경 변수 기반)
// ============================================================================

let _jwtManager: JWTManager | null = null;
let _jwtWarningLogged = false; // 경고 한 번만 출력

/**
 * JWT Manager 인스턴스 가져오기
 * 환경 변수에서 설정을 읽어 JWTManager 생성
 *
 * ⚠️ CONDITIONAL: JWT_SECRET이 없으면 null 반환 (경고만)
 * authMiddleware 사용 시에는 반드시 필요
 *
 * @returns {JWTManager | null} JWT Manager 또는 null
 */
function getJWTManager(): JWTManager | null {
  if (!_jwtManager) {
    let authConfig;
    try {
      authConfig = getAuthConfig();
    } catch {
      if (!_jwtWarningLogged) {
        winstonLogger.warn(
          "[Auth Middleware] Auth not initialized. Authentication is DISABLED.\n" +
            "Call initializeAuth() or initialize() to enable auth.",
        );
        _jwtWarningLogged = true;
      }
      return null;
    }

    if (authConfig.jwtSecret.length < 32) {
      winstonLogger.error(
        "[Auth Middleware] JWT_SECRET must be at least 32 characters long",
      );
      return null;
    }

    _jwtManager = new JWTManager(
      {
        secret: authConfig.jwtSecret,
        accessTokenExpiry: authConfig.accessTokenExpiry,
        refreshTokenExpiry: authConfig.refreshTokenExpiry,
        algorithm: "HS256",
      },
      {
        debug: (msg: string, meta?: any) => winstonLogger.debug(`[Auth] ${msg}`, meta),
        info: (msg: string, meta?: any) => winstonLogger.info(`[Auth] ${msg}`, meta),
        warn: (msg: string, meta?: any) => winstonLogger.warn(`[Auth] ${msg}`, meta),
        error: (msg: string, meta?: any) => winstonLogger.error(`[Auth] ${msg}`, meta),
      },
    );

    winstonLogger.info(
      `[Auth Middleware] ✅ Initialized - Access: ${authConfig.accessTokenExpiry}, Refresh: ${authConfig.refreshTokenExpiry}`,
    );
  }

  return _jwtManager;
}

/**
 * Auth Middleware 명시적 초기화
 *
 * instrumentation.ts에서 서버 시작 시 호출하여 JWT Manager를 미리 초기화합니다.
 *
 * @returns {boolean} 초기화 성공 여부
 *
 * @example
 * ```typescript
 * // instrumentation.ts
 * import { initializeAuthMiddleware } from '@withwiz/middleware/auth';
 *
 * export async function register() {
 *   initializeAuthMiddleware();
 * }
 * ```
 */
export function initializeAuthMiddleware(): boolean {
  const jwtManager = getJWTManager();
  return jwtManager !== null;
}

// ============================================================================
// 인증 미들웨어
// ============================================================================

/**
 * 인증 미들웨어
 *
 * 쿠키(access_token) 또는 Authorization 헤더에서 JWT 토큰을 추출하고 검증합니다.
 * 쿠키를 우선 확인하며, 없을 경우 Authorization 헤더로 폴백합니다 (OAPI 호환).
 * 검증된 사용자 정보를 context.user에 추가합니다.
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain()
 *   .use(authMiddleware);
 * ```
 */
export const authMiddleware: TApiMiddleware = async (context, next) => {
  try {
    const jwtManager = getJWTManager();

    // JWT Manager가 초기화되지 않음 (JWT_SECRET 없음)
    if (!jwtManager) {
      winstonLogger.error(
        "[Auth Middleware] Cannot authenticate - JWT_SECRET not configured",
      );
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED.code,
        "Authentication not configured. Contact administrator.",
      );
    }

    // 쿠키에서 토큰 추출 (Authorization 헤더 폴백 — OAPI 호환)
    let token: string | null = context.request.cookies.get("access_token")?.value ?? null;
    if (!token) {
      const authHeader = context.request.headers.get("authorization");
      token = jwtManager.extractTokenFromHeader(authHeader);
    }

    if (!token) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED.code);
    }

    // Access Token 블랙리스트 체크 (로그아웃된 토큰 거부)
    const tokenChecker = getAccessTokenChecker();
    if (tokenChecker) {
      const isRevoked = await tokenChecker.isAccessTokenRevoked(token);
      if (isRevoked) {
        winstonLogger.debug(
          "[Auth Middleware] Access token is revoked (blacklisted)",
        );
        throw new AppError(
          ERROR_CODES.INVALID_TOKEN.code,
          "Token has been revoked",
        );
      }
    }

    // JWT 토큰 검증
    const payload = await jwtManager.verifyAccessToken(token);

    // 사용자 정보 context에 추가
    context.user = {
      id: payload.userId,
      email: payload.email ?? "",
      name: undefined, // 필요시 DB에서 조회
      role: payload.role === "ADMIN" ? "ADMIN" : "USER",
    };
  } catch (error: any) {
    // JWT 검증 실패 (만료, 유효하지 않음 등)
    if (error instanceof AppError) {
      throw error;
    }

    // 토큰 만료 에러인 경우 40103(TOKEN_EXPIRED) 반환
    if (error.code === "TOKEN_EXPIRED" || error.message?.includes("expired")) {
      throw new AppError(ERROR_CODES.TOKEN_EXPIRED.code, error.message);
    }

    // 그 외 검증 실패는 40102(INVALID_TOKEN) 반환하되 원래 메시지 유지
    throw new AppError(
      ERROR_CODES.INVALID_TOKEN.code,
      error.message || "Invalid token",
    );
  }

  return await next();
};

/**
 * 선택적 인증 미들웨어
 *
 * 쿠키(access_token) 또는 Authorization 헤더가 있으면 JWT 토큰을 검증하고
 * context.user를 설정합니다. 쿠키를 우선 확인하며, 없을 경우 Authorization
 * 헤더로 폴백합니다 (OAPI 호환).
 * 토큰이 없거나 유효하지 않아도 에러를 발생시키지 않고 계속 진행합니다.
 * 공개 API이지만 로그인 사용자를 선택적으로 인식해야 하는 경우에 사용합니다.
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain()
 *   .use(optionalAuthMiddleware);
 * // context.user가 설정되면 로그인 사용자, 아니면 비로그인
 * ```
 */
export const optionalAuthMiddleware: TApiMiddleware = async (context, next) => {
  try {
    const jwtManager = getJWTManager();

    if (jwtManager) {
      // 쿠키에서 토큰 추출 (Authorization 헤더 폴백 — OAPI 호환)
      let token: string | null = context.request.cookies.get("access_token")?.value ?? null;
      if (!token) {
        const authHeader = context.request.headers.get("authorization");
        token = jwtManager.extractTokenFromHeader(authHeader);
      }

      if (token) {
        // Access Token 블랙리스트 체크
        const tokenChecker = getAccessTokenChecker();
        let isRevoked = false;
        if (tokenChecker) {
          isRevoked = await tokenChecker.isAccessTokenRevoked(token);
        }

        if (!isRevoked) {
          // JWT 토큰 검증
          const payload = await jwtManager.verifyAccessToken(token);

          // 사용자 정보 context에 추가
          context.user = {
            id: payload.userId,
            email: payload.email ?? "",
            name: undefined,
            role: payload.role === "ADMIN" ? "ADMIN" : "USER",
          };
        }
      }
    }
  } catch {
    // 인증 실패해도 무시하고 계속 진행
  }

  return await next();
};

/**
 * 관리자 권한 검증 미들웨어
 *
 * authMiddleware 이후에 실행되어야 합니다.
 * context.user가 없거나 role이 admin이 아니면 403 에러를 발생시킵니다.
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain()
 *   .use(authMiddleware)
 *   .use(adminMiddleware);
 * ```
 */
export const adminMiddleware: TApiMiddleware = async (context, next) => {
  if (!context.user) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED.code);
  }

  if (context.user.role !== "ADMIN") {
    throw new AppError(ERROR_CODES.FORBIDDEN.code);
  }

  return await next();
};
