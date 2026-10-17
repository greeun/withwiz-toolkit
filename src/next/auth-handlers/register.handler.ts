import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createRegisterFlow } from '@withwiz/toolkit/next/auth-handlers/register-flow';

/** 가입만 한다(세션 발급 없음). 가입 후 자동 로그인이 필요하면 signup 핸들러를 쓴다. */
export function createRegisterHandler(options: AuthHandlerOptions) {
  const register = createRegisterFlow(options);

  return async (request: NextRequest): Promise<Response> => {
    const outcome = await register(request);
    if ('response' in outcome) return outcome.response;
    return NextResponse.json(
      {
        success: true,
        user: { id: outcome.user.id, email: outcome.user.email, name: outcome.user.name },
        verificationSent: outcome.verificationSent,
      },
      { status: 201 },
    );
  };
}
