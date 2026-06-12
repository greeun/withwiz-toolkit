import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TokenRefreshService } from '@withwiz/core/auth/services/token-refresh.service';
import { setTokenCookies } from '@withwiz/core/auth/jwt/cookie';
import { AuthError } from '@withwiz/core/auth/errors';
import type { AuthHandlerOptions } from '../auth-types/handler-types';
import { resolveTokenDelivery } from '../auth-types/handler-types';

export function createRefreshHandler(options: AuthHandlerOptions) {
  const { dependencies, jwt, hooks, cookie, tokenDelivery } = options;
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
      const mode = resolveTokenDelivery(tokenDelivery);

      let refreshToken: string | undefined;
      if (mode !== 'header') {
        refreshToken = request.cookies.get('refresh_token')?.value;
      }
      if (!refreshToken && mode !== 'cookie') {
        try {
          const body = await request.json();
          if (typeof body?.refreshToken === 'string') {
            refreshToken = body.refreshToken;
          }
        } catch {
          // body 없음 또는 JSON 아님 — 아래에서 401 처리
        }
      }
      if (!refreshToken) {
        return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 });
      }

      if (hooks?.onBeforeTokenRefresh) {
        const hookResult = await hooks.onBeforeTokenRefresh(refreshToken);
        if (hookResult instanceof Response) return hookResult;
      }

      const result = await refreshService.refresh(refreshToken);
      const responseBody: Record<string, unknown> = { success: true, user: result.user };
      if (mode !== 'cookie') {
        responseBody.accessToken = result.accessToken;
      }
      const response = NextResponse.json(responseBody);
      if (mode !== 'header') {
        setTokenCookies(
          response,
          { accessToken: result.accessToken, refreshToken },
          { secure: cookie?.secure },
        );
      }
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
