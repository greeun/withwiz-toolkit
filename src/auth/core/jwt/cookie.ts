/**
 * JWT 토큰을 HttpOnly 쿠키로 설정/삭제하는 유틸리티
 *
 * NextResponse 타입을 제네릭으로 처리하여
 * symlink 환경에서의 next 패키지 경로 충돌을 방지합니다.
 */
import type { TokenPair } from '@withwiz/auth/types';

/** cookies.set()을 지원하는 Response 타입 */
interface CookieSettableResponse {
  cookies: {
    set(name: string, value: string, options?: Record<string, unknown>): void;
  };
}

export interface CookieOptions {
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  domain?: string;
}

const DEFAULT_OPTIONS: CookieOptions = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};

export function setTokenCookies<T extends CookieSettableResponse>(
  response: T,
  tokenPair: TokenPair,
  options: CookieOptions = {},
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  response.cookies.set('access_token', tokenPair.accessToken, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: '/',
    maxAge: 15 * 60,
  });

  response.cookies.set('refresh_token', tokenPair.refreshToken, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}

export function clearTokenCookies<T extends CookieSettableResponse>(
  response: T,
  options: CookieOptions = {},
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  response.cookies.set('access_token', '', {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: '/api/auth',
    maxAge: 0,
  });

  return response;
}
