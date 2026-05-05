import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { EmailVerificationService } from '../services/email-verification.service';
import { AuthError } from '../errors';
import type { AuthHandlerOptions } from '../types/handler-types';

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
});

export function createVerifyEmailHandler(options: AuthHandlerOptions) {
  const { dependencies } = options;

  return async (request: NextRequest): Promise<Response> => {
    try {
      let email: string, token: string;

      if (request.method === 'GET') {
        const url = new URL(request.url);
        email = url.searchParams.get('email') ?? '';
        token = url.searchParams.get('token') ?? '';
      } else {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
        }
        email = parsed.data.email;
        token = parsed.data.token;
      }

      if (!email || !token) {
        return NextResponse.json({ success: false, error: 'Missing email or token' }, { status: 400 });
      }

      if (!dependencies.emailSender) {
        return NextResponse.json({ success: false, error: 'Email service not configured' }, { status: 500 });
      }

      const service = new EmailVerificationService({
        userRepository: dependencies.userRepository,
        emailTokenRepository: dependencies.emailTokenRepository,
        emailSender: dependencies.emailSender,
        logger: dependencies.logger,
      });

      await service.verify(email, token);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.statusCode },
        );
      }
      return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
    }
  };
}
