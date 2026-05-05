import { JWTService } from '../core/jwt';
import { AuthError } from '../errors';
import type { UserRepository, OAuthAccountRepository, BaseUser, TokenPair, Logger } from '../types';

export interface OAuthCallbackServiceConfig {
  userRepository: UserRepository;
  oauthAccountRepository: OAuthAccountRepository;
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  logger?: Logger;
}

export interface OAuthCallbackInput {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string | null;
  image: string | null;
  accessToken: string;
  refreshToken?: string;
}

export interface OAuthCallbackResult {
  user: BaseUser;
  tokens: TokenPair;
  isNewUser: boolean;
}

export class OAuthCallbackService {
  private userRepo: UserRepository;
  private oauthRepo: OAuthAccountRepository;
  private jwtService: JWTService;
  private logger: Logger;

  constructor(config: OAuthCallbackServiceConfig) {
    this.userRepo = config.userRepository;
    this.oauthRepo = config.oauthAccountRepository;
    this.jwtService = new JWTService({
      secret: config.jwtSecret,
      accessTokenExpiry: config.accessTokenExpiry ?? '7d',
      refreshTokenExpiry: config.refreshTokenExpiry ?? '30d',
      algorithm: 'HS256',
    }, config.logger);
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async handleCallback(input: OAuthCallbackInput): Promise<OAuthCallbackResult> {
    // 1. Check if OAuth account already exists
    const existingAccount = await this.oauthRepo.findByProvider(input.provider, input.providerAccountId);

    if (existingAccount) {
      const user = await this.userRepo.findById(existingAccount.userId);
      if (!user) {
        throw new AuthError('User not found for OAuth account', 'USER_NOT_FOUND', 404);
      }
      if (user.isActive === false) {
        throw new AuthError('Account is disabled', 'ACCOUNT_DISABLED', 403);
      }

      // Update OAuth tokens
      await this.oauthRepo.update(existingAccount.id, {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
      });

      await this.userRepo.updateLastLoginAt(user.id);
      const tokens = await this.createTokens(user);
      return { user, tokens, isNewUser: false };
    }

    // 2. Check if user with same email exists
    const existingUser = await this.userRepo.findByEmail(input.email);

    if (existingUser) {
      // Link OAuth account to existing user
      await this.oauthRepo.create({
        userId: existingUser.id,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
      });

      await this.userRepo.updateLastLoginAt(existingUser.id);
      const tokens = await this.createTokens(existingUser);
      return { user: existingUser, tokens, isNewUser: false };
    }

    // 3. Create new user + OAuth account
    const newUser = await this.userRepo.create({
      email: input.email,
      name: input.name,
      image: input.image,
      role: 'USER',
      emailVerified: new Date(), // OAuth users are auto-verified
    });

    await this.oauthRepo.create({
      userId: newUser.id,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
    });

    const tokens = await this.createTokens(newUser);
    this.logger.info('New OAuth user created', { userId: newUser.id, provider: input.provider });
    return { user: newUser, tokens, isNewUser: true };
  }

  private async createTokens(user: BaseUser): Promise<TokenPair> {
    return this.jwtService.createTokenPair({
      id: user.id,
      email: user.email,
      role: user.role ?? 'USER',
      emailVerified: user.emailVerified,
    });
  }
}
