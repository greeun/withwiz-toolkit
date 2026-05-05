import type { NextRequest } from 'next/server';
import type { AuthHandlerOptions } from '../types/handler-types';
import { createLoginHandler } from './login.handler';
import { createRegisterHandler } from './register.handler';
import { createLogoutHandler } from './logout.handler';
import { createRefreshHandler } from './refresh.handler';
import { createMeHandler } from './me.handler';
import { createOAuthAuthorizeHandler } from './oauth-authorize.handler';
import { createOAuthCallbackHandler } from './oauth-callback.handler';
import { createForgotPasswordHandler } from './forgot-password.handler';
import { createResetPasswordHandler } from './reset-password.handler';
import { createVerifyEmailHandler } from './verify-email.handler';

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

export { createLoginHandler } from './login.handler';
export { createRegisterHandler } from './register.handler';
export { createLogoutHandler } from './logout.handler';
export { createRefreshHandler } from './refresh.handler';
export { createMeHandler } from './me.handler';
export { createOAuthAuthorizeHandler } from './oauth-authorize.handler';
export { createOAuthCallbackHandler } from './oauth-callback.handler';
export { createForgotPasswordHandler } from './forgot-password.handler';
export { createResetPasswordHandler } from './reset-password.handler';
export { createVerifyEmailHandler } from './verify-email.handler';
