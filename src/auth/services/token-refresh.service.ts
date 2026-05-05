import { JWTService } from '../core/jwt';
import { AuthError } from '../errors';
import type { UserRepository, Logger } from '../types';

export interface TokenRefreshServiceConfig {
  userRepository: UserRepository;
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  isTokenBlacklisted?: (token: string) => Promise<boolean>;
  logger?: Logger;
}

export interface RefreshResult {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

export class TokenRefreshService {
  private userRepo: UserRepository;
  private jwtService: JWTService;
  private isTokenBlacklisted?: (token: string) => Promise<boolean>;
  private logger: Logger;

  constructor(config: TokenRefreshServiceConfig) {
    this.userRepo = config.userRepository;
    this.jwtService = new JWTService({
      secret: config.jwtSecret,
      accessTokenExpiry: config.accessTokenExpiry ?? '7d',
      refreshTokenExpiry: config.refreshTokenExpiry ?? '30d',
      algorithm: 'HS256',
    }, config.logger);
    this.isTokenBlacklisted = config.isTokenBlacklisted;
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    if (this.isTokenBlacklisted) {
      const blacklisted = await this.isTokenBlacklisted(refreshToken);
      if (blacklisted) {
        throw new AuthError('Token has been revoked', 'TOKEN_REVOKED', 401);
      }
    }

    const { userId } = await this.jwtService.verifyRefreshToken(refreshToken);
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 401);
    }

    if (user.isActive === false) {
      throw new AuthError('Account is disabled', 'ACCOUNT_DISABLED', 403);
    }

    const accessToken = await this.jwtService.createAccessToken({
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role ?? 'USER',
      emailVerified: user.emailVerified,
    });

    return { accessToken, user: { id: user.id, email: user.email, role: user.role ?? 'USER' } };
  }
}
