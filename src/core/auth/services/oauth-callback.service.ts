import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { UserRepository, OAuthAccountRepository, BaseUser, TokenPair, Logger } from '@withwiz/toolkit/core/auth/types';
import { JWT_DEFAULTS, ROLE_DEFAULTS } from '@withwiz/toolkit/core/constants/security';

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

  /**
   * 콜백 처리 전체: 사용자 확정·연결 → (기존 사용자면) 로그인 기록 → 토큰 발급.
   * MFA 를 거쳐야 하는 호출자는 `resolveUser`·`issueTokens` 를 나눠 부른다.
   */
  async handleCallback(input: OAuthCallbackInput): Promise<OAuthCallbackResult> {
    const { user, isNewUser } = await this.resolveUser(input);
    // 신규 사용자는 로그인 기록을 남기지 않는다(0.29 동작 유지).
    if (!isNewUser) await this.userRepo.updateLastLoginAt(user.id);
    const tokens = await this.issueTokens(user);
    return { user, tokens, isNewUser };
  }

  /**
   * OAuth 계정으로 사용자를 확정한다(기존 연결 갱신·기존 이메일 계정 연결·신규 생성).
   * 모든 보안 검사(비활성 계정, 미검증 이메일 연결 거부 등)를 여기서 한다.
   * 로그인 기록(`updateLastLoginAt`)과 토큰 발급은 하지 않는다.
   */
  async resolveUser(input: OAuthCallbackInput): Promise<{ user: BaseUser; isNewUser: boolean }> {
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

      return { user, isNewUser: false };
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

      // 보안(0.25): 기존 계정 자체가 이메일 인증을 마치지 않았으면 연결하지 않는다. 그 계정은 이메일 소유를
      // 증명하지 않은 누군가가 먼저 만든 것일 수 있다 — 연결하면 그 사람의 비밀번호로 피해자 계정에 들어온다.
      if (!existingUser.emailVerified) {
        this.logger.warn('Blocked OAuth account linking to an unverified local account', {
          provider: input.provider,
          userId: existingUser.id,
        });
        throw new AuthError(
          'The existing account has not verified its email; cannot link an OAuth account to it',
          'OAUTH_ACCOUNT_NOT_VERIFIED',
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

      return { user: existingUser, isNewUser: false };
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

    this.logger.info('New OAuth user created', { userId: newUser.id, provider: input.provider });
    return { user: newUser, isNewUser: true };
  }

  /** 세션 토큰 발급. `amr` 를 주면 access 클레임에 싣고, 없으면 넣지 않는다. */
  async issueTokens(user: BaseUser, opts?: { amr?: string[] }): Promise<TokenPair> {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role ?? ROLE_DEFAULTS.DEFAULT_ROLE,
      emailVerified: user.emailVerified,
    };
    // amr 가 없으면 0.29 와 같은 인자 하나짜리 호출을 유지한다.
    return opts?.amr
      ? this.jwtService.createTokenPair(payload, { amr: opts.amr })
      : this.jwtService.createTokenPair(payload);
  }
}
