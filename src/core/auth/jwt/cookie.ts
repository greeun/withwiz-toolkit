/**
 * JWT 토큰을 HttpOnly 쿠키로 설정/삭제하는 유틸리티
 *
 * NextResponse 타입을 제네릭으로 처리하여
 * symlink 환경에서의 next 패키지 경로 충돌을 방지합니다.
 *
 * 쿠키 maxAge는 하드코딩하지 않고 auth config(초기화 시 ENV 주입된
 * accessTokenExpiry/refreshTokenExpiry)에서 도출하여 JWT 만료와 단일 소스로
 * 일치시킨다. 미초기화 시 JWT_DEFAULTS, 명시 override는 CookieOptions로 가능.
 */
import type { TokenPair } from '@withwiz/toolkit/core/auth/types';
import { getAuthConfig } from '@withwiz/toolkit/core/auth/config';
import { JWT_DEFAULTS } from '@withwiz/toolkit/core/constants/security';
import { durationToSeconds } from '@withwiz/toolkit/core/auth/duration';

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
  refreshTokenPath?: string;
  /** access_token 쿠키 maxAge(초) override. 미지정 시 auth config accessTokenExpiry에서 도출. */
  accessTokenMaxAge?: number;
  /** refresh_token 쿠키 maxAge(초) override. 미지정 시 auth config refreshTokenExpiry에서 도출. */
  refreshTokenMaxAge?: number;
}

function getDefaultOptions(): CookieOptions {
  let secure = false;
  try {
    secure = getAuthConfig().cookieSecure;
  } catch {
    // auth config 미초기화 시 secure=false
  }
  return {
    secure,
    sameSite: 'lax',
  };
}

/**
 * 쿠키 maxAge(초)를 auth config의 만료 설정에서 도출.
 * 초기화되어 있으면 accessTokenExpiry/refreshTokenExpiry(ENV 주입값) 사용,
 * 미초기화 시 JWT_DEFAULTS 기본값. → JWT 만료와 단일 소스 일치.
 */
function resolveMaxAge(): { access: number; refresh: number } {
  let access = JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES;
  let refresh = JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES;
  try {
    const cfg = getAuthConfig();
    access = cfg.accessTokenExpiry;
    refresh = cfg.refreshTokenExpiry;
  } catch {
    // 미초기화 → JWT_DEFAULTS
  }
  return { access: durationToSeconds(access), refresh: durationToSeconds(refresh) };
}

export function setTokenCookies<T extends CookieSettableResponse>(
  response: T,
  tokenPair: TokenPair,
  options: CookieOptions = {},
): T {
  const opts = { ...getDefaultOptions(), ...options };
  const maxAge = resolveMaxAge();

  response.cookies.set('access_token', tokenPair.accessToken, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: '/',
    maxAge: opts.accessTokenMaxAge ?? maxAge.access,
  });

  response.cookies.set('refresh_token', tokenPair.refreshToken, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.refreshTokenPath ?? '/api/auth',
    maxAge: opts.refreshTokenMaxAge ?? maxAge.refresh,
  });

  return response;
}

export function clearTokenCookies<T extends CookieSettableResponse>(
  response: T,
  options: CookieOptions = {},
): T {
  const opts = { ...getDefaultOptions(), ...options };

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
    path: opts.refreshTokenPath ?? '/api/auth',
    maxAge: 0,
  });

  return response;
}
