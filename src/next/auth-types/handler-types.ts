import type { NextRequest } from 'next/server';
import type { BaseUser, OAuthProviderName, UserRepository, OAuthAccountRepository, EmailTokenRepository, EmailSender, Logger } from '@withwiz/toolkit/core/auth/types';
import type { TokenDelivery } from '@withwiz/toolkit/core/auth/config';
import type { IRefreshTokenStore } from '@withwiz/toolkit/core/auth/services/refresh-token-store';
import type { PasswordConfig } from '@withwiz/toolkit/core/auth/types';
import type { TLocale } from '@withwiz/toolkit/core/error/messages/types';

/** 가입 훅이 받는 요청 맥락 (0.21+). `body` 는 검증 전 원본 본문이다 — 동의 여부·추가 필드 검사에 쓴다. */
export interface RegisterHookContext {
  body: Record<string, unknown>;
  request: NextRequest;
}

/** 비밀번호 정책 함수의 결과. 위반 사유는 화면에 그대로 표시되므로 요청 로케일로 만든다. */
export type PasswordPolicyResult = { ok: true } | { ok: false; message: string };

/**
 * 비밀번호 정책 (0.21+). register·signup·reset-password 가 같은 정책을 쓴다.
 * - 설정 객체: 기본 `PasswordValidator` 규칙으로 검사한다
 * - 함수: 소비자 규칙. `purpose` 로 가입·재설정을 구분할 수 있다
 * 72바이트 제한은 정책과 별개로 항상 적용된다. 미지정이면 최소 8자다.
 */
export type PasswordPolicy =
  | Partial<PasswordConfig>
  | ((password: string, ctx: { purpose: 'register' | 'reset'; locale: TLocale }) => PasswordPolicyResult | Promise<PasswordPolicyResult>);

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
  /** `ctx` 는 0.21 에서 추가됐다(기존 1인자 훅은 그대로 동작) */
  onBeforeRegister?: (data: { email: string; name?: string }, ctx: RegisterHookContext) => Promise<void | Response>;
  /** `ctx` 는 0.21 에서 추가됐다(기존 1인자 훅은 그대로 동작) */
  onAfterRegister?: (user: BaseUser, ctx: RegisterHookContext) => Promise<void>;
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
  /** 토큰 전달 모드. 미지정 시 전역 AuthConfig → 'hybrid' 순으로 해석 */
  tokenDelivery?: TokenDelivery;
  /**
   * refresh 토큰 store. 주입 시:
   * - refresh 핸들러가 회전(rotation) + 재사용 탐지(reuse detection)를 수행하고
   *   새 refresh 토큰을 쿠키/응답에 반영한다.
   * - logout 핸들러가 제출된 refresh 토큰의 family 를 즉시 무효화한다.
   * 미주입 시 0.13 이전과 동일하게 동작한다(access 재발급만, 로그아웃은 쿠키 삭제만).
   */
  refreshTokenStore?: IRefreshTokenStore;
  /**
   * 오류 응답 형태 (0.21+).
   * - 'legacy'(0.21 기본): `{ success: false, error: "문자열", code? }` — 0.20 과 같다
   * - 'standard'(0.22 기본 예정): `{ success: false, error: { code, key, message, userMessage, details? } }`
   * legacy 의 `code` 값은 standard 의 `key` 로 그대로 옮겨지므로 분기 문자열은 바뀌지 않는다.
   */
  errorFormat?: 'legacy' | 'standard';
  /** 비밀번호 정책 (0.21+) */
  passwordPolicy?: PasswordPolicy;
  /** signup 핸들러 옵션 (0.21+) */
  signup?: {
    /** 가입 직후 로그인이 가능하면 세션을 발급한다. 기본 true */
    autoLogin?: boolean;
  };
}

export interface AuthHandlerResult {
  GET: (req: NextRequest) => Promise<Response>;
  POST: (req: NextRequest) => Promise<Response>;
}

export { resolveTokenDelivery } from '@withwiz/toolkit/core/auth/token-delivery';
