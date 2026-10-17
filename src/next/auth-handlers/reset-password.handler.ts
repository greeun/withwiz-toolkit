import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { PasswordResetService } from '@withwiz/toolkit/core/auth/services/password-reset.service';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import { TokenType } from '@withwiz/toolkit/core/auth/types';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';
import { passwordField, checkPasswordPolicy, passwordPolicyViolation } from '@withwiz/toolkit/next/auth-handlers/password-policy';
import { resolveTokenEmail, linkTokenError, isLinkTokenError } from '@withwiz/toolkit/next/auth-handlers/token-email';

export function createResetPasswordHandler(options: AuthHandlerOptions) {
  const { dependencies, passwordPolicy } = options;
  const respond = createAuthResponder(options);
  // email 은 0.21 부터 선택 항목 — 없으면 토큰으로 찾는다(저장소가 findEmailByToken 을 구현한 경우)
  const schema = z.object({
    email: z.string().email().optional(),
    token: z.string().min(1),
    password: passwordField(passwordPolicy),
  });
  const invalidInput = (request: NextRequest, fieldErrors?: Record<string, string[]>) =>
    respond.error(request, { status: 400, key: 'VALIDATION_ERROR', message: 'Invalid input', fieldErrors });

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await request.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) return invalidInput(request, zodFieldErrors(parsed.error));

      const policy = await checkPasswordPolicy(passwordPolicy, parsed.data.password, 'reset', request);
      if (!policy.ok) return passwordPolicyViolation(respond, request, policy.message);

      const account = await resolveTokenEmail(
        dependencies.emailTokenRepository, parsed.data.email, parsed.data.token, TokenType.PASSWORD_RESET,
      );
      if ('unsupported' in account) return invalidInput(request, { email: ['Required'] });
      if ('notFound' in account) return linkTokenError(respond, request, 'Invalid or expired token');

      if (!dependencies.emailSender) {
        return respond.error(request, { status: 500, key: 'SERVER_ERROR', message: 'Email service not configured' });
      }

      const service = new PasswordResetService({
        userRepository: dependencies.userRepository,
        emailTokenRepository: dependencies.emailTokenRepository,
        emailSender: dependencies.emailSender,
        logger: dependencies.logger,
      });

      await service.resetPassword(account.email, parsed.data.token, parsed.data.password);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (isLinkTokenError(error)) return linkTokenError(respond, request, error.message);
      if (error instanceof AuthError) return respond.fromAuthError(request, error, false);
      return respond.error(request, { status: 500, key: 'INTERNAL_SERVER_ERROR', message: 'Reset failed' });
    }
  };
}
