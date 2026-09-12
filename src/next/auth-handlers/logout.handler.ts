import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clearTokenCookies } from '@withwiz/toolkit/core/auth/jwt/cookie';
import { TokenRefreshService } from '@withwiz/toolkit/core/auth/services/token-refresh.service';
import { getTokenDeliveryStrategy } from '@withwiz/toolkit/core/auth/token-delivery';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

export function createLogoutHandler(options: AuthHandlerOptions) {
  const { dependencies, jwt, hooks, tokenDelivery, refreshTokenStore } = options;
  // store 가 있을 때만 stateful 무효화를 수행한다(미주입 시 쿠키 삭제만 — 하위 호환).
  const refreshService = refreshTokenStore
    ? new TokenRefreshService({
        userRepository: dependencies.userRepository,
        jwtSecret: jwt.secret,
        accessTokenExpiry: jwt.accessTokenExpiry,
        refreshTokenExpiry: jwt.refreshTokenExpiry,
        isTokenBlacklisted: hooks?.isTokenBlacklisted,
        refreshTokenStore,
        logger: dependencies.logger,
      })
    : undefined;

  return async (request: NextRequest): Promise<Response> => {
    if (refreshService) {
      try {
        const refreshToken = await getTokenDeliveryStrategy(tokenDelivery).extractRefreshToken(request);
        if (refreshToken) await refreshService.revokeByToken(refreshToken);
      } catch (error) {
        // 만료·위조 토큰이어도 로그아웃(쿠키 삭제)은 항상 성공해야 한다.
        dependencies.logger?.debug('Logout: refresh token revoke skipped', {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const response = NextResponse.json({ success: true });
    clearTokenCookies(response);
    return response;
  };
}
