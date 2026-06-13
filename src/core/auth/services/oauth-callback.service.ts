import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { UserRepository, OAuthAccountRepository, BaseUser, TokenPair, Logger } from '@withwiz/toolkit/core/auth/types';
import { JWT_DEFAULTS } from '@withwiz/toolkit/core/constants/security';

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
  /**
   * provider 가 이 이메일을 검증했는지 여부. 기존 로컬 계정에 OAuth 를
   * 연결할 때 반드시 true 여야 한다(미검증/부재 시 계정 탈취 방지를 위해 차단).
   * OAuthUserInfo.emailVerified 를 그대로 전달할 것.
   */
  emailVerified?: boolean;
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
      accessTokenExpiry: config.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
      refreshTokenExpiry: config.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
      algorithm: JWT_DEFAULTS.ALGORITHM,
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
      // 보안: 기존 로컬 계정에 OAuth 를 연결하려면 provider 가 이메일을 검증했어야 한다.
      // 미검증 이메일을 신뢰하면 공격자가 피해자 이메일을 주장해 계정을 탈취할 수 있다
      // (pre-account hijacking). 검증되지 않았으면 연결을 거부한다.
      if (input.emailVerified !== true) {
        this.logger.warn('Blocked OAuth account linking for unverified email', {
          provider: input.provider,
          userId: existingUser.id,
        });
        throw new AuthError(
          'OAuth email is not verified by the provider; cannot link to an existing account',
          'OAUTH_EMAIL_NOT_VERIFIED',
          403,
        );
      }

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
    // provider 가 이메일을 검증한 경우에만 자동 인증 처리한다. 미검증이면
    // emailVerified=null 로 두어 로컬 이메일 인증 흐름을 거치게 한다.
    const newUser = await this.userRepo.create({
      email: input.email,
      name: input.name,
      image: input.image,
      emailVerified: input.emailVerified === true ? new Date() : null,
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
