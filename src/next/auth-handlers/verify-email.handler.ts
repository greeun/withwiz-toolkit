import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { EmailVerificationService } from '@withwiz/toolkit/core/auth/services/email-verification.service';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import { TokenType } from '@withwiz/toolkit/core/auth/types';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';
import { resolveTokenEmail } from '@withwiz/toolkit/next/auth-handlers/token-email';

// email 은 0.21 부터 선택 항목 — 없으면 토큰으로 찾는다(저장소가 findEmailByToken 을 구현한 경우)
const schema = z.object({
  email: z.string().email().optional(),
  token: z.string().min(1),
});

export function createVerifyEmailHandler(options: AuthHandlerOptions) {
  const { dependencies } = options;
  const respond = createAuthResponder(options);
  const missing = (request: NextRequest) =>
    respond.error(request, { status: 400, key: 'BAD_REQUEST', message: 'Missing email or token' });

  return async (request: NextRequest): Promise<Response> => {
    try {
      let email: string | undefined;
      let token: string;

      if (request.method === 'GET') {
        const url = new URL(request.url);
        email = url.searchParams.get('email') || undefined;
        token = url.searchParams.get('token') ?? '';
      } else {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return respond.error(request, {
            status: 400, key: 'VALIDATION_ERROR', message: 'Invalid input', fieldErrors: zodFieldErrors(parsed.error),
          });
        }
        email = parsed.data.email;
        token = parsed.data.token;
      }

      if (!token) return missing(request);

      const account = await resolveTokenEmail(dependencies.emailTokenRepository, email, token, TokenType.EMAIL_VERIFICATION);
      if ('unsupported' in account) return missing(request);
      if ('notFound' in account) {
        return respond.error(request, { status: 400, key: 'INVALID_TOKEN', message: 'Invalid or expired verification token' });
      }

      if (!dependencies.emailSender) {
        return respond.error(request, { status: 500, key: 'SERVER_ERROR', message: 'Email service not configured' });
      }

      const service = new EmailVerificationService({
        userRepository: dependencies.userRepository,
        emailTokenRepository: dependencies.emailTokenRepository,
        emailSender: dependencies.emailSender,
        logger: dependencies.logger,
      });

      await service.verify(account.email, token);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof AuthError) return respond.fromAuthError(request, error, false);
      return respond.error(request, { status: 500, key: 'INTERNAL_SERVER_ERROR', message: 'Verification failed' });
    }
  };
}
