import { compare } from 'bcryptjs';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { UserRepository, BaseUser, TokenPair, Logger } from '@withwiz/toolkit/core/auth/types';
import type { IPasswordHasher } from '@withwiz/toolkit/core/auth/password/hasher';
import { JWT_DEFAULTS } from '@withwiz/toolkit/core/constants/security';

/**
 * 더미 bcrypt 해시 (cost 12) — 계정이 없을 때도 동일 비용의 compare 를 수행해
 * 응답 시간을 균일화한다 (타이밍 기반 계정 enumeration 방지).
 */
const DUMMY_PASSWORD_HASH = '$2b$12$/l4jMXYcTL.SQgNWzy1UcuSlrtLlw.GFTpWDYTficzN2kRhN/LwEO';

export interface LoginServiceConfig {
  userRepository: UserRepository;
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  /**
   * 비밀번호 검증/재해시에 사용할 pluggable 해셔.
   * 미지정 시 bcryptjs.compare 로 폴백한다 (하위 호환).
   * `MigratingPasswordHasher` 를 주입하면 레거시 해시(scrypt 등)를 검증하고
   * needsRehash 시 LoginResult.rehashedPassword 로 신규 해시를 반환한다.
   */
  passwordHasher?: IPasswordHasher;
  logger?: Logger;
}

export interface LoginResult {
  user: BaseUser;
  tokens: TokenPair;
  /**
   * storedHash 가 재해시 대상일 때(rehash-on-login)에만 채워진다.
   * 소비자는 이 값을 사용자 레코드에 저장해 무중단 해시 마이그레이션을 수행한다.
   */
  rehashedPassword?: string;
}

export class LoginService {
  private jwtService: JWTService;
  private userRepo: UserRepository;
  private passwordHasher?: IPasswordHasher;
  private logger: Logger;

  constructor(config: LoginServiceConfig) {
    this.userRepo = config.userRepository;
    this.jwtService = new JWTService({
      secret: config.jwtSecret,
      accessTokenExpiry: config.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
      refreshTokenExpiry: config.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
      algorithm: JWT_DEFAULTS.ALGORITHM,
    }, config.logger);
    this.passwordHasher = config.passwordHasher;
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async login(email: string, password: string, storedHash: string): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      // 계정이 없어도 동일 비용의 작업을 수행해 타이밍을 균일화한다.
      // 해셔 주입 시 동일 스킴으로 해싱해 verify 와 비용을 맞춘다(폴백: 더미 compare).
      if (this.passwordHasher) {
        await this.passwordHasher.hash(password).catch(() => undefined);
      } else {
        await compare(password, DUMMY_PASSWORD_HASH);
      }
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    if (user.isActive === false) {
      throw new AuthError('Account is disabled', 'ACCOUNT_DISABLED', 403);
    }

    const isValid = this.passwordHasher
      ? await this.passwordHasher.verify(password, storedHash)
      : await compare(password, storedHash);
    if (!isValid) {
      this.logger.warn('Failed login attempt', { email });
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const tokens = await this.jwtService.createTokenPair({
      id: user.id,
      email: user.email,
      role: user.role ?? 'USER',
      emailVerified: user.emailVerified,
    });

    // rehash-on-login: storedHash 가 약하거나 레거시 스킴이면 신규 해시를 발급한다.
    let rehashedPassword: string | undefined;
    if (this.passwordHasher && this.passwordHasher.needsRehash(storedHash)) {
      try {
        rehashedPassword = await this.passwordHasher.hash(password);
      } catch (error) {
        // 재해시 실패는 로그인 자체를 막지 않는다 (다음 로그인에 재시도).
        this.logger.warn('Password rehash failed', { userId: user.id, error });
      }
    }

    await this.userRepo.updateLastLoginAt(user.id);
    this.logger.info('User logged in successfully', { userId: user.id });

    return { user, tokens, ...(rehashedPassword ? { rehashedPassword } : {}) };
  }
}
