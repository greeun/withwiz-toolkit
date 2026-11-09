/**
 * `/mfa/*` 처리기 (0.30+)
 *
 * - verify: 로그인·OAuth 가 남긴 대기 토큰 + 코드(또는 복구 코드) → 세션 발급
 * - status·setup·enable·disable·recovery-codes: 로그인한 사용자의 MFA 관리(access 토큰, `/me` 와 같은 방식)
 *
 * `options.mfa` 가 없거나 꺼져 있으면 모두 404 `MFA_NOT_CONFIGURED`.
 * 본문 검증 실패는 서비스에 닿지 않으므로 실패 횟수에 들어가지 않는다.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, MfaLockedError } from '@withwiz/toolkit/core/auth/errors';
import { AMR, type MfaProof } from '@withwiz/toolkit/core/auth/mfa';
import type { BaseUser } from '@withwiz/toolkit/core/auth/types';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { AUTH_ERROR_CODE_MAP } from '@withwiz/toolkit/next/error/error-handler';
import { createAuthResponder, readJsonBody, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';
import { createSessionIssuer } from '@withwiz/toolkit/next/auth-handlers/session';
import { getMfaRuntime, type MfaRuntime } from '@withwiz/toolkit/next/auth-handlers/mfa-runtime';
import { clearMfaPendingCookie, readMfaPendingToken } from '@withwiz/toolkit/next/auth-handlers/mfa-pending';
import { createAccessUserResolver } from '@withwiz/toolkit/next/auth-handlers/me.handler';

type Handler = (req: NextRequest) => Promise<Response>;
type Responder = ReturnType<typeof createAuthResponder>;

const codeField = z.string().regex(/^\d{6}$/);
const recoveryCodeField = z.string().min(1).max(32);

/** 코드 또는 복구 코드 중 정확히 하나 (verify·disable) */
const proofSchema = z
  .object({ code: codeField.optional(), recoveryCode: recoveryCodeField.optional() })
  .refine((d) => (d.code === undefined) !== (d.recoveryCode === undefined), {
    message: 'Provide either code or recoveryCode',
    path: ['code'],
  });

/** TOTP 코드만 (enable·recovery-codes) */
const codeSchema = z.object({ code: codeField });

const toProof = (d: { code?: string; recoveryCode?: string }): MfaProof =>
  d.code !== undefined ? { code: d.code } : { recoveryCode: d.recoveryCode! };

function notConfigured(respond: Responder, request: NextRequest): Response {
  return respond.error(request, {
    status: 404,
    key: 'MFA_NOT_CONFIGURED',
    message: 'MFA is not configured',
    legacyCode: 'MFA_NOT_CONFIGURED',
  });
}

function invalidInput(respond: Responder, request: NextRequest, error: z.ZodError): Response {
  return respond.error(request, {
    status: 400,
    key: 'VALIDATION_ERROR',
    message: 'Invalid input',
    fieldErrors: zodFieldErrors(error, request, respond.locale(request)),
  });
}

/** MfaService 오류 → 응답. 잠금은 429 + Retry-After + 본문 retryAfter, 그 밖의 예외는 500 */
function mfaErrorResponse(respond: Responder, request: NextRequest, error: unknown): NextResponse {
  if (error instanceof MfaLockedError) {
    const body = respond.errorBody(request, {
      status: 429,
      key: error.code,
      code: AUTH_ERROR_CODE_MAP[error.code],
      message: error.message,
      legacyCode: error.code,
    });
    return NextResponse.json(
      { ...body, retryAfter: error.retryAfter },
      { status: 429, headers: { 'Retry-After': String(error.retryAfter) } },
    );
  }
  if (error instanceof AuthError) return respond.fromAuthError(request, error, true);
  return respond.error(request, { status: 500, key: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
}

/** 상태가 이미 바뀐 뒤 부르는 훅 — 실패해도 응답(복구 코드 등)을 잃지 않게 기록만 한다 */
async function safeHook(options: AuthHandlerOptions, name: string, fn: () => Promise<void> | undefined): Promise<void> {
  try {
    await fn();
  } catch (error) {
    options.dependencies.logger?.warn(`MFA hook ${name} failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

interface ManageContext {
  request: NextRequest;
  user: BaseUser;
  runtime: MfaRuntime;
  body: unknown;
}

/**
 * 관리 처리기 공통 틀: 런타임 확인 → access 토큰 사용자 → (선택) 본문 읽기 → 동작.
 * 동작이 던진 MfaService 오류는 mfaErrorResponse 로 바꾼다.
 */
function createManageHandler(
  options: AuthHandlerOptions,
  run: (ctx: ManageContext, respond: Responder) => Promise<Response>,
  readBody: boolean,
): Handler {
  const respond = createAuthResponder(options);
  const runtime = getMfaRuntime(options);
  const resolveUser = createAccessUserResolver(options);

  return async (request) => {
    if (!runtime) return notConfigured(respond, request);

    let user: BaseUser;
    try {
      const result = await resolveUser(request);
      if ('failure' in result) {
        return respond.error(request, {
          status: 401,
          key: 'UNAUTHORIZED',
          message: result.failure === 'no-token' ? 'Not authenticated' : 'User not found',
        });
      }
      user = result.user;
    } catch {
      return respond.error(request, { status: 401, key: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    try {
      const body = readBody ? await readJsonBody(request) : undefined;
      return await run({ request, user, runtime, body }, respond);
    } catch (error) {
      return mfaErrorResponse(respond, request, error);
    }
  };
}

export function createMfaStatusHandler(options: AuthHandlerOptions): Handler {
  return createManageHandler(options, async ({ user, runtime }) => {
    const { enabled, recoveryCodesRemaining } = await runtime.service.status(user.id);
    return NextResponse.json({ success: true, enabled, recoveryCodesRemaining });
  }, false);
}

export function createMfaSetupHandler(options: AuthHandlerOptions): Handler {
  return createManageHandler(options, async ({ user, runtime }) => {
    const { secret, otpauthUri } = await runtime.service.beginSetup(user.id, user.email);
    return NextResponse.json({ success: true, secret, otpauthUri });
  }, false);
}

export function createMfaEnableHandler(options: AuthHandlerOptions): Handler {
  return createManageHandler(options, async ({ request, user, runtime, body }, respond) => {
    const parsed = codeSchema.safeParse(body);
    if (!parsed.success) return invalidInput(respond, request, parsed.error);
    const { recoveryCodes } = await runtime.service.enable(user.id, parsed.data.code);
    await safeHook(options, 'onMfaEnabled', () => options.hooks?.onMfaEnabled?.(user));
    return NextResponse.json({ success: true, recoveryCodes });
  }, true);
}

export function createMfaDisableHandler(options: AuthHandlerOptions): Handler {
  return createManageHandler(options, async ({ request, user, runtime, body }, respond) => {
    const parsed = proofSchema.safeParse(body);
    if (!parsed.success) return invalidInput(respond, request, parsed.error);
    const by = await runtime.service.disable(user.id, toProof(parsed.data));
    await safeHook(options, 'onMfaDisabled', () => options.hooks?.onMfaDisabled?.(user, by));
    return NextResponse.json({ success: true });
  }, true);
}

export function createMfaRecoveryCodesHandler(options: AuthHandlerOptions): Handler {
  return createManageHandler(options, async ({ request, user, runtime, body }, respond) => {
    const parsed = codeSchema.safeParse(body);
    if (!parsed.success) return invalidInput(respond, request, parsed.error);
    const { recoveryCodes } = await runtime.service.regenerateRecoveryCodes(user.id, parsed.data.code);
    return NextResponse.json({ success: true, recoveryCodes });
  }, true);
}

/**
 * 로그인 2단계 검증. 대기 토큰은 쿠키 우선, 없으면 본문 `mfaToken`.
 * 대기 쿠키는 성공과 `MFA_PENDING_EXPIRED` 에서만 지운다 — 틀린 코드·잠금은 같은 대기 토큰으로 다시 시도할 수 있다.
 */
export function createMfaVerifyHandler(options: AuthHandlerOptions): Handler {
  const respond = createAuthResponder(options);
  const runtime = getMfaRuntime(options);
  const issueSession = createSessionIssuer(options);
  const { dependencies, hooks, urls } = options;

  return async (request) => {
    if (!runtime) return notConfigured(respond, request);
    const cookieOpts = { secure: options.cookie?.secure, path: runtime.cookiePath };

    const expired = (): NextResponse => {
      const res = respond.error(request, {
        status: 401,
        key: 'MFA_PENDING_EXPIRED',
        code: AUTH_ERROR_CODE_MAP.MFA_PENDING_EXPIRED,
        message: 'MFA challenge expired',
        legacyCode: 'MFA_PENDING_EXPIRED',
      });
      return clearMfaPendingCookie(res, cookieOpts);
    };

    try {
      const body = await readJsonBody(request);

      const token = readMfaPendingToken(request, body);
      if (!token) return expired();
      let pending: Awaited<ReturnType<MfaRuntime['jwtService']['verifyMfaPendingToken']>>;
      try {
        pending = await runtime.jwtService.verifyMfaPendingToken(token);
      } catch {
        return expired();
      }

      const parsed = proofSchema.safeParse(body);
      if (!parsed.success) return invalidInput(respond, request, parsed.error);

      const method = await runtime.service.verifyChallenge(pending.userId, toProof(parsed.data), pending.jti);

      const user = await dependencies.userRepository.findById(pending.userId);
      if (!user || user.isActive === false) return expired();

      const isOAuth = pending.origin === 'oauth';
      const extra: Record<string, unknown> = isOAuth
        ? { redirectTo: urls.afterOAuth ?? urls.afterLogin ?? '/' }
        : {};
      const res = await issueSession(user, request, extra, 200, {
        amr: [...pending.amr, method, AMR.MFA],
        callAfterLogin: pending.origin === 'password',
      });
      // OAuth 콜백이 미뤄 둔 훅. 기존 계정만 대기 토큰을 받으므로 isNewUser=false, onOAuthFirstLogin 은 부르지 않는다
      if (isOAuth && hooks?.onAfterOAuth) await hooks.onAfterOAuth(user, pending.provider ?? '', false);
      return clearMfaPendingCookie(res, cookieOpts);
    } catch (error) {
      // MFA_NOT_ENABLED: 대기 중에 MFA 가 꺼지거나 초기화됐다 — 이 대기 토큰으로는 더 진행할 수 없다
      if (
        error instanceof AuthError &&
        (error.code === 'MFA_PENDING_EXPIRED' || error.code === 'MFA_NOT_ENABLED')
      ) {
        return expired();
      }
      return mfaErrorResponse(respond, request, error);
    }
  };
}
