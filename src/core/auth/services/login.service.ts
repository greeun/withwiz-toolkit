import { compare } from 'bcryptjs';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { UserRepository, BaseUser, TokenPair, Logger } from '@withwiz/toolkit/core/auth/types';
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
  logger?: Logger;
}

export interface LoginResult {
  user: BaseUser;
  tokens: TokenPair;
}

export class LoginService {
  private jwtService: JWTService;
  private userRepo: UserRepository;
  private logger: Logger;

  constructor(config: LoginServiceConfig) {
    this.userRepo = config.userRepository;
    this.jwtService = new JWTService({
      secret: config.jwtSecret,
      accessTokenExpiry: config.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
      refreshTokenExpiry: config.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
      algorithm: JWT_DEFAULTS.ALGORITHM,
    }, config.logger);
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async login(email: string, password: string, storedHash: string): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      // 계정이 없어도 동일 비용의 compare 를 수행해 타이밍을 균일화한다
      await compare(password, DUMMY_PASSWORD_HASH);
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    if (user.isActive === false) {
      throw new AuthError('Account is disabled', 'ACCOUNT_DISABLED', 403);
    }

    const isValid = await compare(password, storedHash);
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

    await this.userRepo.updateLastLoginAt(user.id);
    this.logger.info('User logged in successfully', { userId: user.id });

    return { user, tokens };
  }
}
