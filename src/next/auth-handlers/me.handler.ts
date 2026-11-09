import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { getTokenDeliveryStrategy } from '@withwiz/toolkit/core/auth/token-delivery';
import type { BaseUser } from '@withwiz/toolkit/core/auth/types';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder } from '@withwiz/toolkit/next/auth-handlers/respond';
import { getMfaRuntime } from '@withwiz/toolkit/next/auth-handlers/mfa-runtime';
import { JWT_DEFAULTS } from '@withwiz/toolkit/core/constants/security';

/** access 토큰으로 찾은 요청 사용자. 토큰이 없으면 `no-token`, 사용자가 없거나 비활성이면 `no-user` */
export type AccessUserResult = { user: BaseUser } | { failure: 'no-token' | 'no-user' };

/**
 * 요청의 access 토큰(전달 모드별 쿠키·헤더) → 사용자. `/me` 와 `/mfa/*` 관리 처리기가 같은 규칙을 쓴다.
 * 토큰 검증 실패는 예외로 던진다 — 호출부가 401 로 바꾼다.
 */
export function createAccessUserResolver(options: AuthHandlerOptions) {
  const { dependencies, jwt } = options;
  const jwtService = new JWTService({
    secret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
    refreshTokenExpiry: jwt.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
    algorithm: JWT_DEFAULTS.ALGORITHM,
  });
  const strategy = getTokenDeliveryStrategy(options.tokenDelivery);

  return async (request: NextRequest): Promise<AccessUserResult> => {
    const token = strategy.extractAccessToken(
      request,
      (header) => jwtService.extractTokenFromHeader(header ?? undefined),
    );
    if (!token) return { failure: 'no-token' };

    const payload = await jwtService.verifyAccessToken(token);
    const user = await dependencies.userRepository.findById(payload.userId);
    if (!user || user.isActive === false) return { failure: 'no-user' };
    return { user };
  };
}

export function createMeHandler(options: AuthHandlerOptions) {
  const respond = createAuthResponder(options);
  const { hooks } = options;
  const resolveUser = createAccessUserResolver(options);
  const mfaRuntime = getMfaRuntime(options);

  return async (request: NextRequest): Promise<Response> => {
    try {
      const result = await resolveUser(request);
      if ('failure' in result) {
        return result.failure === 'no-token'
          ? respond.error(request, { status: 401, key: 'UNAUTHORIZED', message: 'Not authenticated' })
          : respond.error(request, { status: 401, key: 'UNAUTHORIZED', message: 'User not found' });
      }
      const { user } = result;

      let userResponse: Record<string, unknown> = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      };
      // extendUserResponse 보다 먼저 넣어 소비자가 덮어쓸 수 있게 한다
      if (mfaRuntime) {
        userResponse.mfaEnabled = await mfaRuntime.service.isEnabled(user.id);
      }
      if (hooks?.extendUserResponse) {
        userResponse = { ...userResponse, ...(await hooks.extendUserResponse(user)) };
      }

      return NextResponse.json({ success: true, user: userResponse });
    } catch {
      return respond.error(request, { status: 401, key: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
  };
}
