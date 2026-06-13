import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { RegisterService } from '@withwiz/toolkit/core/auth/services/register.service';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

// bcrypt 는 72바이트 초과분을 조용히 절단하므로 검증 단계에서 거부 (바이트 수 기준)
const withinBcryptByteLimit = (value: string): boolean =>
  new TextEncoder().encode(value).length <= 72;

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .refine(withinBcryptByteLimit, { message: 'Password cannot exceed 72 bytes' }),
  name: z.string().min(1).optional(),
});

export function createRegisterHandler(options: AuthHandlerOptions) {
  const { dependencies, hooks, features } = options;
  const registerService = new RegisterService({
    userRepository: dependencies.userRepository,
    emailTokenRepository: dependencies.emailTokenRepository,
    emailSender: dependencies.emailSender,
    emailVerificationRequired: features?.emailVerificationRequired ?? true,
    logger: dependencies.logger,
  });

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await request.json();
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid input', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      if (hooks?.allowEmail) {
        const allowed = await hooks.allowEmail(parsed.data.email);
        if (!allowed) return NextResponse.json({ success: false, error: 'Email not allowed' }, { status: 403 });
      }

      if (hooks?.onBeforeRegister) {
        const hookResult = await hooks.onBeforeRegister({ email: parsed.data.email, name: parsed.data.name });
        if (hookResult instanceof Response) return hookResult;
      }

      const result = await registerService.register(parsed.data);

      if (hooks?.onAfterRegister) await hooks.onAfterRegister(result.user);

      return NextResponse.json(
        {
          success: true,
          user: { id: result.user.id, email: result.user.email, name: result.user.name },
          verificationSent: result.verificationSent,
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { success: false, error: error.message, code: error.code },
          { status: error.statusCode },
        );
      }
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}
