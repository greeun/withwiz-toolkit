import { randomUUID } from 'node:crypto';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { UserRepository, Logger } from '@withwiz/toolkit/core/auth/types';
import type { IRefreshTokenStore } from '@withwiz/toolkit/core/auth/services/refresh-token-store';
import { JWT_DEFAULTS, ROLE_DEFAULTS } from '@withwiz/toolkit/core/constants/security';

export interface TokenRefreshServiceConfig {
  userRepository: UserRepository;
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  isTokenBlacklisted?: (token: string) => Promise<boolean>;
  /**
   * 주입 시 refresh 토큰 회전(rotation) + 재사용 탐지(reuse detection)를 활성화한다.
   * - 회전: refresh 마다 새 refresh 를 발급하고 구 jti 를 used 로 표시한다.
   * - 재사용 탐지: 이미 used 인 jti 재제출 → family 전체 무효화(탈취 대응).
   * 미주입 시 0.8 이전과 동일하게 access 토큰만 재발급한다(하위 호환).
   *
   * 주의: 동시 요청 경쟁을 막으려면 store 의 isUsed→markUsed 는 원자적이어야 한다.
   */
  refreshTokenStore?: IRefreshTokenStore;
  logger?: Logger;
}

export interface RefreshResult {
  accessToken: string;
  /**
   * 회전이 일어난 경우(store 주입 시)에만 채워진다. 소비자는 이 값으로 기존
   * refresh 토큰(쿠키 등)을 교체해야 한다.
   */
  refreshToken?: string;
  user: { id: string; email: string; role: string };
}

export class TokenRefreshService {
  private userRepo: UserRepository;
  private jwtService: JWTService;
  private isTokenBlacklisted?: (token: string) => Promise<boolean>;
  private store?: IRefreshTokenStore;
  private logger: Logger;

  constructor(config: TokenRefreshServiceConfig) {
    this.userRepo = config.userRepository;
    this.jwtService = new JWTService({
      secret: config.jwtSecret,
      accessTokenExpiry: config.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
      refreshTokenExpiry: config.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
      algorithm: JWT_DEFAULTS.ALGORITHM,
    }, config.logger);
    this.isTokenBlacklisted = config.isTokenBlacklisted;
    this.store = config.refreshTokenStore;
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    if (this.isTokenBlacklisted) {
      const blacklisted = await this.isTokenBlacklisted(refreshToken);
      if (blacklisted) {
        throw new AuthError('Token has been revoked', 'TOKEN_REVOKED', 401);
      }
    }

    const { userId, jti, familyId } = await this.jwtService.verifyRefreshToken(refreshToken);

    // 재사용 탐지: 사용자 조회 전에 먼저 검사해 탈취 토큰의 정보 노출을 줄인다.
    if (this.store) {
      if (familyId && (await this.store.isFamilyRevoked(familyId))) {
        throw new AuthError('Token has been revoked', 'TOKEN_REVOKED', 401);
      }
      if (jti && (await this.store.isUsed(jti))) {
        // 이미 회전된 토큰의 재제출 = 탈취 정황 → family 전체 무효화.
        if (familyId) await this.store.revokeFamily(familyId);
        this.logger.warn('Refresh token reuse detected', { userId, jti, familyId });
        throw new AuthError('Refresh token reuse detected', 'TOKEN_REUSE_DETECTED', 401);
      }
    }

    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 401);
    }

    if (user.isActive === false) {
      throw new AuthError('Account is disabled', 'ACCOUNT_DISABLED', 403);
    }

    const role = user.role ?? ROLE_DEFAULTS.DEFAULT_ROLE;
    const accessToken = await this.jwtService.createAccessToken({
      id: user.id,
      userId: user.id,
      email: user.email,
      role,
      emailVerified: user.emailVerified,
    });

    // store 미주입 → 기존 동작(access 만 재발급).
    if (!this.store) {
      return { accessToken, user: { id: user.id, email: user.email, role } };
    }

    // 회전: 구 jti 소비 처리 후 같은 family 로 새 refresh 발급.
    // 레거시(식별자 없는) 토큰은 첫 회전에서 새 family 를 부여한다.
    const family = familyId ?? randomUUID();
    if (jti) {
      await this.store.markUsed(jti, { familyId: family, userId });
    }
    const newJti = randomUUID();
    const newRefreshToken = await this.jwtService.createRefreshToken(userId, {
      jti: newJti,
      familyId: family,
    });
    await this.store.register?.({ jti: newJti, familyId: family, userId });

    return { accessToken, refreshToken: newRefreshToken, user: { id: user.id, email: user.email, role } };
  }

  /**
   * family 전체를 즉시 무효화한다 (stateful 로그아웃 / 탈취 대응).
   * store 미주입 시 동작하지 않는다.
   */
  async revokeFamily(familyId: string): Promise<void> {
    if (!this.store) {
      throw new AuthError('Refresh token store is not configured', 'STORE_NOT_CONFIGURED', 500);
    }
    await this.store.revokeFamily(familyId);
  }

  /**
   * refresh 토큰을 검증해 그 family 를 무효화한다 (로그아웃 핸들러용).
   * 토큰에 familyId 가 없으면(레거시) 무효화할 family 가 없으므로 무시한다.
   */
  async revokeByToken(refreshToken: string): Promise<void> {
    if (!this.store) {
      throw new AuthError('Refresh token store is not configured', 'STORE_NOT_CONFIGURED', 500);
    }
    const { familyId } = await this.jwtService.verifyRefreshToken(refreshToken);
    if (familyId) await this.store.revokeFamily(familyId);
  }
}
