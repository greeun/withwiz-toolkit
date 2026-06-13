import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { PasswordResetService } from '@withwiz/toolkit/core/auth/services/password-reset.service';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

// bcrypt 는 72바이트 초과분을 조용히 절단하므로 검증 단계에서 거부 (바이트 수 기준)
const withinBcryptByteLimit = (value: string): boolean =>
  new TextEncoder().encode(value).length <= 72;

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .refine(withinBcryptByteLimit, { message: 'Password cannot exceed 72 bytes' }),
});

export function createResetPasswordHandler(options: AuthHandlerOptions) {
  const { dependencies } = options;

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await request.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
      }

      if (!dependencies.emailSender) {
        return NextResponse.json({ success: false, error: 'Email service not configured' }, { status: 500 });
      }

      const service = new PasswordResetService({
        userRepository: dependencies.userRepository,
        emailTokenRepository: dependencies.emailTokenRepository,
        emailSender: dependencies.emailSender,
        logger: dependencies.logger,
      });

      await service.resetPassword(parsed.data.email, parsed.data.token, parsed.data.password);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.statusCode },
        );
      }
      return NextResponse.json({ success: false, error: 'Reset failed' }, { status: 500 });
    }
  };
}
