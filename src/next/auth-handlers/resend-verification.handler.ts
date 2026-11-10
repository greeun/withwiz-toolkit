import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { EmailVerificationService } from '@withwiz/toolkit/core/auth/services/email-verification.service';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder, readJsonBody, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';

const schema = z.object({ email: z.string().email() });

/** 계정 상태를 드러내는 서비스 거부 — 응답에는 싣지 않고 조용히 넘긴다. */
const SILENT_CODES = new Set(['USER_NOT_FOUND', 'EMAIL_ALREADY_VERIFIED']);

/**
 * 인증 메일 재발송 (0.31+). `POST { email }`.
 *
 * 가입 여부가 드러나지 않도록 계정이 없거나 이미 인증된 경우에도 `{ success: true }` 200 을 준다.
 * 저장소·메일 발송 실패 같은 예상 밖 오류도 응답은 같지만, 장애가 숨지 않도록 logger.error 로 남긴다.
 * 메일 폭탄을 막는 요청 한도는 앱의 rate limit 이 맡는다.
 */
export function createResendVerificationHandler(options: AuthHandlerOptions) {
  const respond = createAuthResponder(options);
  const { dependencies } = options;

  return async (request: NextRequest): Promise<Response> => {
    const body = await readJsonBody(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return respond.error(request, {
        status: 400, key: 'VALIDATION_ERROR', message: 'Invalid email',
        fieldErrors: zodFieldErrors(parsed.error, request, respond.locale(request)),
      });
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

    try {
      await service.resend(parsed.data.email);
    } catch (error) {
      if (!(error instanceof AuthError && SILENT_CODES.has(error.code))) {
        dependencies.logger?.error('Verification email resend failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return NextResponse.json({ success: true });
  };
}
