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

export interface AuthRouteHandlers {
  login: (req: NextRequest) => Promise<Response>;
  register: (req: NextRequest) => Promise<Response>;
  logout: (req: NextRequest) => Promise<Response>;
  refresh: (req: NextRequest) => Promise<Response>;
  me: (req: NextRequest) => Promise<Response>;
  oauthAuthorize: (req: NextRequest) => Promise<Response>;
  oauthCallback: (req: NextRequest) => Promise<Response>;
  forgotPassword: (req: NextRequest) => Promise<Response>;
  resetPassword: (req: NextRequest) => Promise<Response>;
  verifyEmail: (req: NextRequest) => Promise<Response>;
}

export function createAuthHandlers(options: AuthHandlerOptions): AuthRouteHandlers {
  return {
    login: createLoginHandler(options),
    register: createRegisterHandler(options),
    logout: createLogoutHandler(options),
    refresh: createRefreshHandler(options),
    me: createMeHandler(options),
    oauthAuthorize: createOAuthAuthorizeHandler(options),
    oauthCallback: createOAuthCallbackHandler(options),
    forgotPassword: createForgotPasswordHandler(options),
    resetPassword: createResetPasswordHandler(options),
    verifyEmail: createVerifyEmailHandler(options),
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
