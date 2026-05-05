import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { compare } from 'bcryptjs';
import { JWTService } from '../core/jwt';
import { setTokenCookies } from '../core/jwt/cookie';
import { AuthError } from '../errors';
import type { AuthHandlerOptions } from '../types/handler-types';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function createLoginHandler(options: AuthHandlerOptions) {
  const { dependencies, jwt, hooks, features, cookie } = options;
  const jwtService = new JWTService({
    secret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry ?? '7d',
    refreshTokenExpiry: jwt.refreshTokenExpiry ?? '30d',
    algorithm: 'HS256',
  });

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await request.json();
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
      }

      const { email, password } = parsed.data;

      if (hooks?.allowEmail) {
        const allowed = await hooks.allowEmail(email);
        if (!allowed) return NextResponse.json({ success: false, error: 'Email not allowed' }, { status: 403 });
      }

      if (hooks?.onBeforeLogin) {
        const hookResult = await hooks.onBeforeLogin(email, request);
        if (hookResult instanceof Response) return hookResult;
      }

      const user = await dependencies.userRepository.findByEmail(email);
      if (!user) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
      }

      if (user.isActive === false) {
        return NextResponse.json({ success: false, error: 'Account disabled' }, { status: 403 });
      }

      // The repository findByEmail should return the full user including password for auth
      const userRecord = user as any;
      if (!userRecord.password) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
      }

      const isValid = await compare(password, userRecord.password);
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
      }

      if (features?.emailVerificationRequired && !user.emailVerified) {
        return NextResponse.json(
          { success: false, error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' },
          { status: 403 },
        );
      }

      const tokens = await jwtService.createTokenPair({
        id: user.id,
        email: user.email,
        role: user.role ?? 'USER',
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

      const response = NextResponse.json({ success: true, user: userResponse, tokens });
      setTokenCookies(response, tokens, { secure: cookie?.secure });
      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { success: false, error: error.message, code: error.code },
          { status: error.statusCode },
        );
      }
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}
