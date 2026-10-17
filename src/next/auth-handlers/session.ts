import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { getTokenDeliveryStrategy } from '@withwiz/toolkit/core/auth/token-delivery';
import type { BaseUser } from '@withwiz/toolkit/core/auth/types';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { JWT_DEFAULTS, ROLE_DEFAULTS } from '@withwiz/toolkit/core/constants/security';

/**
 * 인증을 마친 사용자에게 세션(access·refresh 토큰)을 발급하는 응답을 만든다.
 * login 과 signup(자동 로그인)이 같은 경로를 쓴다 — 토큰 형태·쿠키·훅 호출이 갈라지지 않게.
 */
export function createSessionIssuer(options: AuthHandlerOptions) {
  const { dependencies, jwt, hooks, cookie, tokenDelivery } = options;
  const jwtService = new JWTService({
    secret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
    refreshTokenExpiry: jwt.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
    algorithm: JWT_DEFAULTS.ALGORITHM,
  });

  return async (
    user: BaseUser,
    request: NextRequest,
    extraBody: Record<string, unknown> = {},
    status = 200,
  ): Promise<NextResponse> => {
    const tokens = await jwtService.createTokenPair({
      id: user.id,
      email: user.email,
      role: user.role ?? ROLE_DEFAULTS.DEFAULT_ROLE,
      emailVerified: user.emailVerified,
    });

    await dependencies.userRepository.updateLastLoginAt(user.id);
    if (hooks?.onAfterLogin) await hooks.onAfterLogin(user, request);

    let userResponse: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    };
    if (hooks?.extendUserResponse) {
      userResponse = { ...userResponse, ...(await hooks.extendUserResponse(user)) };
    }

    const strategy = getTokenDeliveryStrategy(tokenDelivery);
    const response = NextResponse.json(
      strategy.buildTokenResponse({ success: true, user: userResponse, ...extraBody }, { tokens }),
      { status },
    );
    strategy.attachCookies(response, tokens, { secure: cookie?.secure });
    return response;
  };
}
