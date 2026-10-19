import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { EmailVerificationService } from '@withwiz/toolkit/core/auth/services/email-verification.service';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import { TokenType } from '@withwiz/toolkit/core/auth/types';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder, readJsonBody, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';
import { requiredFieldMessage } from '@withwiz/toolkit/next/auth-handlers/field-messages';
import { LocaleDetector } from '@withwiz/toolkit/next/error/locale-detector';
import { resolveTokenEmail, linkTokenError, isLinkTokenError } from '@withwiz/toolkit/next/auth-handlers/token-email';

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
        const body = await readJsonBody(request);
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return respond.error(request, {
            status: 400, key: 'VALIDATION_ERROR', message: 'Invalid input', fieldErrors: zodFieldErrors(parsed.error, request),
          });
        }
        email = parsed.data.email;
        token = parsed.data.token;
      }

      if (!token) return missing(request);

      const account = await resolveTokenEmail(dependencies.emailTokenRepository, email, token, TokenType.EMAIL_VERIFICATION);
      if ('unsupported' in account) {
        // 0.20 과 같은 응답: POST 는 스키마 검증 실패(Invalid input), GET 은 Missing email or token
        if (request.method === 'GET') return missing(request);
        return respond.error(request, { status: 400, key: 'VALIDATION_ERROR', message: 'Invalid input', fieldErrors: { email: [requiredFieldMessage(LocaleDetector.detectServer(request))] } });
      }
      if ('notFound' in account) return linkTokenError(respond, request, 'Invalid or expired verification token');

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
      if (isLinkTokenError(error)) return linkTokenError(respond, request, error.message);
      if (error instanceof AuthError) return respond.fromAuthError(request, error, false);
      return respond.error(request, { status: 500, key: 'INTERNAL_SERVER_ERROR', message: 'Verification failed' });
    }
  };
}
