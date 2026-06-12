import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { JWTService } from '@withwiz/core/auth/jwt';
import { getTokenDeliveryStrategy } from '@withwiz/core/auth/token-delivery';
import type { AuthHandlerOptions } from '../auth-types/handler-types';
import { JWT_DEFAULTS } from '@withwiz/core/constants/security';

export function createMeHandler(options: AuthHandlerOptions) {
  const { dependencies, jwt, hooks } = options;
  const jwtService = new JWTService({
    secret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
    refreshTokenExpiry: jwt.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
    algorithm: JWT_DEFAULTS.ALGORITHM,
  });

  return async (request: NextRequest): Promise<Response> => {
    try {
      const token = getTokenDeliveryStrategy(options.tokenDelivery).extractAccessToken(
        request,
        (header) => jwtService.extractTokenFromHeader(header ?? undefined),
      );

      if (!token) {
        return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
      }

      const payload = await jwtService.verifyAccessToken(token);
      const user = await dependencies.userRepository.findById(payload.userId);

      if (!user || user.isActive === false) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
      }

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

      return NextResponse.json({ success: true, user: userResponse });
    } catch {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
  };
}
