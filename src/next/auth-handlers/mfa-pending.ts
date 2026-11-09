import { NextResponse, type NextRequest } from 'next/server';
import { authCookieName } from '@withwiz/toolkit/core/auth/config';
import { setScopedCookie } from '@withwiz/toolkit/core/auth/jwt/cookie';
import { MFA_LIMITS } from '@withwiz/toolkit/core/auth/mfa';
import { resolveTokenDelivery } from '@withwiz/toolkit/core/auth/token-delivery';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import type { createAuthResponder } from '@withwiz/toolkit/next/auth-handlers/respond';
import type { MfaRuntime } from '@withwiz/toolkit/next/auth-handlers/mfa-runtime';

/** MFA 대기 토큰 쿠키의 논리 이름(실제 이름은 `authCookieName` 적용) */
export const MFA_PENDING_COOKIE = 'mfa_pending';

interface PendingCookieOpts {
  secure?: boolean;
  path: string;
}

export function setMfaPendingCookie(res: NextResponse, token: string, opts: PendingCookieOpts): NextResponse {
  return setScopedCookie(res, authCookieName(MFA_PENDING_COOKIE), token, opts.path, MFA_LIMITS.pendingTtlSec, {
    secure: opts.secure,
  });
}

export function clearMfaPendingCookie(res: NextResponse, opts: PendingCookieOpts): NextResponse {
  return setScopedCookie(res, authCookieName(MFA_PENDING_COOKIE), '', opts.path, 0, { secure: opts.secure });
}

/**
 * 2단계 인증이 남았음을 알리는 401 응답. 표준 오류 본문에 전달 모드별로 대기 토큰을 싣는다.
 * header·hybrid 는 본문 최상위 `mfaToken`, cookie·hybrid 는 쿠키.
 */
export function mfaRequiredResponse(
  request: NextRequest,
  respond: ReturnType<typeof createAuthResponder>,
  token: string,
  options: AuthHandlerOptions,
  runtime: MfaRuntime,
): NextResponse {
  const mode = resolveTokenDelivery(options.tokenDelivery);
  const body = respond.errorBody(request, {
    status: 401,
    key: 'MFA_REQUIRED',
    message: 'Two-factor authentication required',
    legacyCode: 'MFA_REQUIRED',
  });
  const res = NextResponse.json(
    mode === 'header' || mode === 'hybrid' ? { ...body, mfaToken: token } : body,
    { status: 401 },
  );
  if (mode === 'cookie' || mode === 'hybrid') {
    setMfaPendingCookie(res, token, { secure: options.cookie?.secure, path: runtime.cookiePath });
  }
  return res;
}

/** 대기 토큰 읽기 — 쿠키 우선, 없으면 본문 `mfaToken` */
export function readMfaPendingToken(request: NextRequest, body: unknown): string | null {
  const fromCookie = request.cookies.get(authCookieName(MFA_PENDING_COOKIE))?.value;
  if (fromCookie) return fromCookie;
  const fromBody = (body as { mfaToken?: unknown } | null | undefined)?.mfaToken;
  return typeof fromBody === 'string' && fromBody ? fromBody : null;
}
