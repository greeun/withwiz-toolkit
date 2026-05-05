import { compare } from 'bcryptjs';
import { JWTService } from '../core/jwt';
import { AuthError } from '../errors';
import type { UserRepository, BaseUser, TokenPair, Logger } from '../types';

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
      accessTokenExpiry: config.accessTokenExpiry ?? '7d',
      refreshTokenExpiry: config.refreshTokenExpiry ?? '30d',
      algorithm: 'HS256',
    }, config.logger);
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async login(email: string, password: string, storedHash: string): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
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
