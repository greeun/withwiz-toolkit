import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TokenRefreshService } from '@withwiz/toolkit/core/auth/services/token-refresh.service';
import { getTokenDeliveryStrategy } from '@withwiz/toolkit/core/auth/token-delivery';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

export function createRefreshHandler(options: AuthHandlerOptions) {
  const { dependencies, jwt, hooks, cookie, tokenDelivery, refreshTokenStore } = options;
  const refreshService = new TokenRefreshService({
    userRepository: dependencies.userRepository,
    jwtSecret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry,
    refreshTokenExpiry: jwt.refreshTokenExpiry,
    isTokenBlacklisted: hooks?.isTokenBlacklisted,
    refreshTokenStore,
    logger: dependencies.logger,
  });

  return async (request: NextRequest): Promise<Response> => {
    try {
      const strategy = getTokenDeliveryStrategy(tokenDelivery);
      const refreshToken = await strategy.extractRefreshToken(request);
      if (!refreshToken) {
        return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 });
      }

      if (hooks?.onBeforeTokenRefresh) {
        const hookResult = await hooks.onBeforeTokenRefresh(refreshToken);
        if (hookResult instanceof Response) return hookResult;
      }

      const result = await refreshService.refresh(refreshToken);
      // 회전이 일어났으면(store 주입) 새 refresh 로 교체해야 한다.
      // 구 토큰을 재부착하면 다음 refresh 에서 reuse 로 탐지되어 family 가 폐기된다.
      const rotated = result.refreshToken !== undefined;
      const nextRefreshToken = result.refreshToken ?? refreshToken;
      const response = NextResponse.json(
        strategy.buildTokenResponse(
          { success: true, user: result.user },
          rotated
            ? { accessToken: result.accessToken, refreshToken: nextRefreshToken }
            : { accessToken: result.accessToken },
        ),
      );
      strategy.attachCookies(
        response,
        { accessToken: result.accessToken, refreshToken: nextRefreshToken },
        { secure: cookie?.secure },
      );
      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { success: false, error: error.message, code: error.code },
          { status: error.statusCode },
        );
      }
      return NextResponse.json({ success: false, error: 'Token refresh failed' }, { status: 401 });
    }
  };
}
