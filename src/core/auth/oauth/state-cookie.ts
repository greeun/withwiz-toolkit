/**
 * OAuth state(CSRF) 를 HttpOnly 쿠키로 설정/검증/삭제하는 유틸리티
 *
 * NextResponse 타입을 제네릭으로 처리하여 next 패키지 경로 충돌을
 * 방지한다 (core 티어 — next 비의존, jwt/cookie.ts 패턴 미러).
 */

/** cookies.set() 을 지원하는 Response 타입 */
interface CookieSettableResponse {
  cookies: {
    set(name: string, value: string, options?: Record<string, unknown>): void;
  };
}

export const OAUTH_STATE_COOKIE = 'oauth_state';

const STATE_COOKIE_MAX_AGE = 600; // 10분

export interface OAuthStateCookieOptions {
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  domain?: string;
}

/** CSRF 방지용 OAuth state nonce 생성 */
export function generateOAuthState(): string {
  return crypto.randomUUID();
}

function buildCookieOptions(
  options: OAuthStateCookieOptions,
  maxAge: number,
): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    httpOnly: true,
    secure: options.secure ?? false,
    sameSite: options.sameSite ?? 'lax',
    path: '/',
    maxAge,
  };
  if (options.domain) opts.domain = options.domain;
  return opts;
}

export function setOAuthStateCookie<T extends CookieSettableResponse>(
  response: T,
  state: string,
  options: OAuthStateCookieOptions = {},
): T {
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    state,
    buildCookieOptions(options, STATE_COOKIE_MAX_AGE),
  );
  return response;
}

export function clearOAuthStateCookie<T extends CookieSettableResponse>(
  response: T,
  options: OAuthStateCookieOptions = {},
): T {
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    '',
    buildCookieOptions(options, 0),
  );
  return response;
}

/**
 * 콜백 쿼리 state 와 쿠키 state 의 일치 검증.
 * 양쪽 모두 비공백 문자열이고 strict 일치일 때만 true.
 */
export function validateOAuthState(
  cookieValue: string | null | undefined,
  queryState: string | null | undefined,
): boolean {
  if (typeof cookieValue !== 'string' || typeof queryState !== 'string') {
    return false;
  }
  if (cookieValue.length === 0 || queryState.length === 0) return false;
  return cookieValue === queryState;
}
