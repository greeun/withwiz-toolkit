import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { RegisterService } from '../services/register.service';
import { AuthError } from '../errors';
import type { AuthHandlerOptions } from '../types/handler-types';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
