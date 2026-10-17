import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createRegisterFlow } from '@withwiz/toolkit/next/auth-handlers/register-flow';
import { createSessionIssuer } from '@withwiz/toolkit/next/auth-handlers/session';

/**
 * 가입 + 자동 로그인 (0.21+) — `POST /signup`.
 *
 * 검증·정책·훅은 register 와 같다. 가입 직후 로그인이 가능한 상태(인증 메일이 필요 없거나 이미 인증됨)면
 * login 과 같은 경로로 세션을 발급하고 `verificationSent: false` 를 돌려준다. 메일 인증이 필요하면
 * 세션 없이 `verificationSent` 를 돌려준다. `signup.autoLogin: false` 면 항상 세션을 발급하지 않는다.
 *
 * 세션 발급이 실패해도 가입은 이미 끝났으므로 실패로 응답하지 않는다 — 실패로 알리면 사용자가 다시 시도해
 * "이미 가입된 이메일" 을 받는다. 세션 없는 가입 성공(201)으로 폴백하고 오류는 로그에 남긴다.
 */
export function createSignupHandler(options: AuthHandlerOptions) {
  const register = createRegisterFlow(options);
  const issueSession = createSessionIssuer(options);
  const autoLogin = options.signup?.autoLogin ?? true;

  return async (request: NextRequest): Promise<Response> => {
    const outcome = await register(request);
    if ('response' in outcome) return outcome.response;

    const { user, verificationSent } = outcome;
    if (autoLogin && user.emailVerified) {
      try {
        return await issueSession(user, request, { verificationSent: false }, 201);
      } catch (error) {
        options.dependencies.logger?.error('Signup auto-login failed; responding without a session', {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return NextResponse.json(
      { success: true, user: { id: user.id, email: user.email, name: user.name }, verificationSent },
      { status: 201 },
    );
  };
}
