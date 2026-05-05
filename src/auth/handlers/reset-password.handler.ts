import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { PasswordResetService } from '../services/password-reset.service';
import { AuthError } from '../errors';
import type { AuthHandlerOptions } from '../types/handler-types';

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8),
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
