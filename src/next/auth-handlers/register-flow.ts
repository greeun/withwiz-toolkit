import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { RegisterService } from '@withwiz/toolkit/core/auth/services/register.service';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { BaseUser } from '@withwiz/toolkit/core/auth/types';
import type { AuthHandlerOptions, RegisterHookContext } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder, readJsonBody, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';
import { passwordField, checkPasswordPolicy, passwordPolicyViolation } from '@withwiz/toolkit/next/auth-handlers/password-policy';

export type RegisterOutcome =
  | { response: Response }
  | { user: BaseUser; verificationSent: boolean };

/**
 * 가입 흐름 — register 와 signup 이 공유한다.
 * 본문 검증 → 이메일 허용 → 비밀번호 정책 → onBeforeRegister → extendRegisterData → 가입 → onAfterRegister.
 * 실패는 응답(`{ response }`)으로, 성공은 가입 결과로 돌려준다.
 */
export function createRegisterFlow(options: AuthHandlerOptions) {
  const { dependencies, hooks, features, passwordPolicy } = options;
  const respond = createAuthResponder(options);
  const registerSchema = z.object({
    email: z.string().email(),
    password: passwordField(passwordPolicy),
    name: z.string().min(1).optional(),
  });
  const registerService = new RegisterService({
    userRepository: dependencies.userRepository,
    emailTokenRepository: dependencies.emailTokenRepository,
    emailSender: dependencies.emailSender,
    emailVerificationRequired: features?.emailVerificationRequired ?? true,
    logger: dependencies.logger,
  });

  return async (request: NextRequest): Promise<RegisterOutcome> => {
    try {
      const body = await readJsonBody(request);
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return {
          response: respond.error(request, {
            status: 400,
            key: 'VALIDATION_ERROR',
            message: 'Invalid input',
            legacyDetails: parsed.error.flatten(),
            fieldErrors: zodFieldErrors(parsed.error, request, respond.locale(request)),
          }),
        };
      }

      if (hooks?.allowEmail) {
        const allowed = await hooks.allowEmail(parsed.data.email);
        if (!allowed) return { response: respond.error(request, { status: 403, key: 'EMAIL_NOT_ALLOWED', message: 'Email not allowed' }) };
      }

      const policy = await checkPasswordPolicy(passwordPolicy, parsed.data.password, 'register', request, respond.locale(request));
      if (!policy.ok) return { response: passwordPolicyViolation(respond, request, policy.message) };

      // 훅이 ctx 를 로그에 남겨도 평문 비밀번호가 새지 않도록 본문에서 password 를 뺀다
      const { password: _password, ...rest } =
        body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
      const ctx: RegisterHookContext = { body: rest, request };

      if (hooks?.onBeforeRegister) {
        const hookResult = await hooks.onBeforeRegister({ email: parsed.data.email, name: parsed.data.name }, ctx);
        if (hookResult instanceof Response) return { response: hookResult };
      }

      const extra = hooks?.extendRegisterData
        ? await hooks.extendRegisterData({ email: parsed.data.email, name: parsed.data.name }, ctx)
        : undefined;

      const result = await registerService.register(extra ? { ...parsed.data, extra } : parsed.data);

      if (hooks?.onAfterRegister) await hooks.onAfterRegister(result.user, ctx);

      return { user: result.user, verificationSent: result.verificationSent };
    } catch (error) {
      if (error instanceof AuthError) return { response: respond.fromAuthError(request, error, true) };
      return { response: respond.error(request, { status: 500, key: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' }) };
    }
  };
}
