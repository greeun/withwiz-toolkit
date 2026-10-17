import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { compare } from 'bcryptjs';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';
import { createSessionIssuer } from '@withwiz/toolkit/next/auth-handlers/session';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * 더미 bcrypt 해시 (cost 12) — 계정이 없거나 비밀번호가 없는 경우에도
 * 동일 비용의 compare 를 수행해 응답 시간을 균일화한다 (타이밍 기반 계정
 * enumeration 방지). 실제 발급 해시와 동일한 cost 여야 의미가 있다.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$/l4jMXYcTL.SQgNWzy1UcuSlrtLlw.GFTpWDYTficzN2kRhN/LwEO';

export function createLoginHandler(options: AuthHandlerOptions) {
  const respond = createAuthResponder(options);
  const { dependencies, hooks, features } = options;
  const issueSession = createSessionIssuer(options);

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await request.json();
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        return respond.error(request, { status: 400, key: 'VALIDATION_ERROR', message: 'Invalid input', fieldErrors: zodFieldErrors(parsed.error) });
      }

      const { email, password } = parsed.data;

      if (hooks?.allowEmail) {
        const allowed = await hooks.allowEmail(email);
        if (!allowed) return respond.error(request, { status: 403, key: 'EMAIL_NOT_ALLOWED', message: 'Email not allowed' });
      }

      if (hooks?.onBeforeLogin) {
        const hookResult = await hooks.onBeforeLogin(email, request);
        if (hookResult instanceof Response) return hookResult;
      }

      const user = await dependencies.userRepository.findByEmail(email);
      if (!user) {
        // 계정이 없어도 동일 비용의 compare 를 수행해 타이밍을 균일화한다
        await compare(password, DUMMY_PASSWORD_HASH);
        return respond.error(request, { status: 401, key: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
      }

      if (user.isActive === false) {
        return respond.error(request, { status: 403, key: 'ACCOUNT_DISABLED', message: 'Account disabled' });
      }

      // The repository findByEmail should return the full user including password for auth
      const userRecord = user as any;
      if (!userRecord.password) {
        // 비밀번호가 없는 계정(OAuth 전용)도 동일하게 더미 compare 로 타이밍 균일화
        await compare(password, DUMMY_PASSWORD_HASH);
        return respond.error(request, { status: 401, key: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
      }

      const isValid = await compare(password, userRecord.password);
      if (!isValid) {
        return respond.error(request, { status: 401, key: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
      }

      if (features?.emailVerificationRequired && !user.emailVerified) {
        return respond.error(request, { status: 403, key: 'EMAIL_NOT_VERIFIED', message: 'Email not verified', legacyCode: 'EMAIL_NOT_VERIFIED' });
      }

      // await: 세션 발급 중 예외도 아래 catch 가 처리해야 한다
      return await issueSession(user, request);
    } catch (error) {
      if (error instanceof AuthError) return respond.fromAuthError(request, error, true);
      return respond.error(request, { status: 500, key: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
    }
  };
}
