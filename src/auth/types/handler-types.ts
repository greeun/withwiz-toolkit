import type { NextRequest } from 'next/server';
import type { BaseUser, OAuthProviderName, UserRepository, OAuthAccountRepository, EmailTokenRepository, EmailSender, Logger } from './index';

export interface AuthHandlerDependencies {
  userRepository: UserRepository;
  oauthAccountRepository: OAuthAccountRepository;
  emailTokenRepository: EmailTokenRepository;
  emailSender?: EmailSender;
  logger?: Logger;
}

export interface AuthHandlerHooks {
  onBeforeLogin?: (email: string, req: NextRequest) => Promise<void | Response>;
  onAfterLogin?: (user: BaseUser, req: NextRequest) => Promise<void>;
  onBeforeRegister?: (data: { email: string; name?: string }) => Promise<void | Response>;
  onAfterRegister?: (user: BaseUser) => Promise<void>;
  onOAuthFirstLogin?: (user: BaseUser, provider: string) => Promise<string | void>;
  onAfterOAuth?: (user: BaseUser, provider: string, isNewUser: boolean) => Promise<void>;
  onBeforeTokenRefresh?: (userId: string) => Promise<void | Response>;
  extendUserResponse?: (user: BaseUser) => Promise<Record<string, unknown>>;
  extendRegisterData?: (data: { email: string; name?: string; password?: string }) => Promise<Record<string, unknown>>;
  allowEmail?: (email: string) => boolean | Promise<boolean>;
  isTokenBlacklisted?: (token: string) => Promise<boolean>;
}

export interface AuthHandlerUrls {
  baseUrl: string;
  afterLogin?: string;
  afterRegister?: string;
  afterOAuth?: string;
  afterLogout?: string;
  verifyEmailPage?: string;
  resetPasswordPage?: string;
}

export interface AuthHandlerOptions {
  dependencies: AuthHandlerDependencies;
  providers?: OAuthProviderName[];
  oauth?: Record<string, { clientId: string; clientSecret: string; redirectUri: string }>;
  jwt: { secret: string; accessTokenExpiry?: string; refreshTokenExpiry?: string };
  urls: AuthHandlerUrls;
  features?: {
    emailVerificationRequired?: boolean;
    magicLinkEnabled?: boolean;
    passwordResetEnabled?: boolean;
  };
  hooks?: AuthHandlerHooks;
  cookie?: {
    secure?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
    domain?: string;
  };
}

export interface AuthHandlerResult {
  GET: (req: NextRequest) => Promise<Response>;
  POST: (req: NextRequest) => Promise<Response>;
}
