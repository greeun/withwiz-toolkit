import type { NextRequest } from 'next/server';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createLoginHandler } from '@withwiz/toolkit/next/auth-handlers/login.handler';
import { createRegisterHandler } from '@withwiz/toolkit/next/auth-handlers/register.handler';
import { createLogoutHandler } from '@withwiz/toolkit/next/auth-handlers/logout.handler';
import { createRefreshHandler } from '@withwiz/toolkit/next/auth-handlers/refresh.handler';
import { createMeHandler } from '@withwiz/toolkit/next/auth-handlers/me.handler';
import { createOAuthAuthorizeHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-authorize.handler';
import { createOAuthCallbackHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-callback.handler';
import { createForgotPasswordHandler } from '@withwiz/toolkit/next/auth-handlers/forgot-password.handler';
import { createResetPasswordHandler } from '@withwiz/toolkit/next/auth-handlers/reset-password.handler';
import { createVerifyEmailHandler } from '@withwiz/toolkit/next/auth-handlers/verify-email.handler';
import { createResendVerificationHandler } from '@withwiz/toolkit/next/auth-handlers/resend-verification.handler';
import { createSignupHandler } from '@withwiz/toolkit/next/auth-handlers/signup.handler';
import {
  createMfaVerifyHandler,
  createMfaStatusHandler,
  createMfaSetupHandler,
  createMfaEnableHandler,
  createMfaDisableHandler,
  createMfaRecoveryCodesHandler,
} from '@withwiz/toolkit/next/auth-handlers/mfa.handlers';

export interface AuthRouteHandlers {
  login: (req: NextRequest) => Promise<Response>;
  register: (req: NextRequest) => Promise<Response>;
  /** 가입 + 자동 로그인 (0.21+) */
  signup: (req: NextRequest) => Promise<Response>;
  logout: (req: NextRequest) => Promise<Response>;
  refresh: (req: NextRequest) => Promise<Response>;
  me: (req: NextRequest) => Promise<Response>;
  oauthAuthorize: (req: NextRequest) => Promise<Response>;
  oauthCallback: (req: NextRequest) => Promise<Response>;
  forgotPassword: (req: NextRequest) => Promise<Response>;
  resetPassword: (req: NextRequest) => Promise<Response>;
  verifyEmail: (req: NextRequest) => Promise<Response>;
  /** 인증 메일 재발송 (0.31+). 계정 상태와 무관하게 200 */
  resendVerification: (req: NextRequest) => Promise<Response>;
  /** 로그인 2단계 검증 (0.30+). `mfa` 미설정이면 404 */
  mfaVerify: (req: NextRequest) => Promise<Response>;
  /** MFA 상태 (0.30+) */
  mfaStatus: (req: NextRequest) => Promise<Response>;
  /** MFA 등록 시작 — 비밀 키·otpauth URI (0.30+) */
  mfaSetup: (req: NextRequest) => Promise<Response>;
  /** MFA 켜기 — 복구 코드 발급 (0.30+) */
  mfaEnable: (req: NextRequest) => Promise<Response>;
  /** MFA 끄기 (0.30+) */
  mfaDisable: (req: NextRequest) => Promise<Response>;
  /** 복구 코드 재발급 (0.30+) */
  mfaRecoveryCodes: (req: NextRequest) => Promise<Response>;
}

export function createAuthHandlers(options: AuthHandlerOptions): AuthRouteHandlers {
  return {
    login: createLoginHandler(options),
    register: createRegisterHandler(options),
    signup: createSignupHandler(options),
    logout: createLogoutHandler(options),
    refresh: createRefreshHandler(options),
    me: createMeHandler(options),
    oauthAuthorize: createOAuthAuthorizeHandler(options),
    oauthCallback: createOAuthCallbackHandler(options),
    forgotPassword: createForgotPasswordHandler(options),
    resetPassword: createResetPasswordHandler(options),
    verifyEmail: createVerifyEmailHandler(options),
    resendVerification: createResendVerificationHandler(options),
    mfaVerify: createMfaVerifyHandler(options),
    mfaStatus: createMfaStatusHandler(options),
    mfaSetup: createMfaSetupHandler(options),
    mfaEnable: createMfaEnableHandler(options),
    mfaDisable: createMfaDisableHandler(options),
    mfaRecoveryCodes: createMfaRecoveryCodesHandler(options),
  };
}

export { createLoginHandler } from '@withwiz/toolkit/next/auth-handlers/login.handler';
export { createRegisterHandler } from '@withwiz/toolkit/next/auth-handlers/register.handler';
export { createLogoutHandler } from '@withwiz/toolkit/next/auth-handlers/logout.handler';
export { createRefreshHandler } from '@withwiz/toolkit/next/auth-handlers/refresh.handler';
export { createMeHandler } from '@withwiz/toolkit/next/auth-handlers/me.handler';
export { createOAuthAuthorizeHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-authorize.handler';
export { createOAuthCallbackHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-callback.handler';
export { createForgotPasswordHandler } from '@withwiz/toolkit/next/auth-handlers/forgot-password.handler';
export { createResetPasswordHandler } from '@withwiz/toolkit/next/auth-handlers/reset-password.handler';
export { createVerifyEmailHandler } from '@withwiz/toolkit/next/auth-handlers/verify-email.handler';
export { createResendVerificationHandler } from '@withwiz/toolkit/next/auth-handlers/resend-verification.handler';
export { createSignupHandler } from '@withwiz/toolkit/next/auth-handlers/signup.handler';
export {
  createMfaVerifyHandler,
  createMfaStatusHandler,
  createMfaSetupHandler,
  createMfaEnableHandler,
  createMfaDisableHandler,
  createMfaRecoveryCodesHandler,
} from '@withwiz/toolkit/next/auth-handlers/mfa.handlers';
// next/error 묶음(index)은 클라이언트 컴포넌트(ErrorBoundary)를 함께 불러오므로 개별 모듈에서 가져온다
export { buildErrorResponse } from '@withwiz/toolkit/next/error/build-error-response';
export { withStandardErrors } from '@withwiz/toolkit/next/error/with-standard-errors';
