import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { PasswordResetService } from '../services/password-reset.service';
import type { AuthHandlerOptions } from '../types/handler-types';

const schema = z.object({ email: z.string().email() });

export function createForgotPasswordHandler(options: AuthHandlerOptions) {
  const { dependencies } = options;

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await request.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 });
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

      await service.requestReset(parsed.data.email);
      return NextResponse.json({ success: true }); // Always 200 to prevent enumeration
    } catch {
      return NextResponse.json({ success: true }); // Silent fail
    }
  };
}
