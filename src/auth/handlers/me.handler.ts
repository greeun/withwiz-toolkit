import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { JWTService } from '../core/jwt';
import type { AuthHandlerOptions } from '../types/handler-types';

export function createMeHandler(options: AuthHandlerOptions) {
  const { dependencies, jwt, hooks } = options;
  const jwtService = new JWTService({
    secret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry ?? '7d',
    refreshTokenExpiry: jwt.refreshTokenExpiry ?? '30d',
    algorithm: 'HS256',
  });

  return async (request: NextRequest): Promise<Response> => {
    try {
      const token = request.cookies.get('access_token')?.value
        ?? jwtService.extractTokenFromHeader(request.headers.get('authorization') ?? undefined);

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
