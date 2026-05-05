import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TokenRefreshService } from '../services/token-refresh.service';
import { setTokenCookies } from '../core/jwt/cookie';
import { AuthError } from '../errors';
import type { AuthHandlerOptions } from '../types/handler-types';

export function createRefreshHandler(options: AuthHandlerOptions) {
  const { dependencies, jwt, hooks, cookie } = options;
  const refreshService = new TokenRefreshService({
    userRepository: dependencies.userRepository,
    jwtSecret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry,
    refreshTokenExpiry: jwt.refreshTokenExpiry,
    isTokenBlacklisted: hooks?.isTokenBlacklisted,
    logger: dependencies.logger,
  });

  return async (request: NextRequest): Promise<Response> => {
    try {
      const refreshToken = request.cookies.get('refresh_token')?.value;
      if (!refreshToken) {
        return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 });
      }

      if (hooks?.onBeforeTokenRefresh) {
        const hookResult = await hooks.onBeforeTokenRefresh(refreshToken);
        if (hookResult instanceof Response) return hookResult;
      }

      const result = await refreshService.refresh(refreshToken);
      const response = NextResponse.json({
        success: true,
        accessToken: result.accessToken,
        user: result.user,
      });
      setTokenCookies(response, { accessToken: result.accessToken, refreshToken }, { secure: cookie?.secure });
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
