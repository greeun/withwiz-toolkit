import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { PasswordResetService } from '@withwiz/toolkit/core/auth/services/password-reset.service';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder, readJsonBody, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';

const schema = z.object({ email: z.string().email() });

export function createForgotPasswordHandler(options: AuthHandlerOptions) {
  const respond = createAuthResponder(options);
  const { dependencies } = options;

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await readJsonBody(request);
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return respond.error(request, { status: 400, key: 'VALIDATION_ERROR', message: 'Invalid email', fieldErrors: zodFieldErrors(parsed.error, request, respond.locale(request)) });
      }

      if (!dependencies.emailSender) {
        return respond.error(request, { status: 500, key: 'SERVER_ERROR', message: 'Email service not configured' });
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
