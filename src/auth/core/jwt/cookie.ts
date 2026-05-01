/**
 * JWT 토큰을 HttpOnly 쿠키로 설정/삭제하는 유틸리티
 *
 * NextResponse 타입을 제네릭으로 처리하여
 * symlink 환경에서의 next 패키지 경로 충돌을 방지합니다.
 */
import type { TokenPair } from '@withwiz/auth/types';
import { getCommonConfig } from '../../../config/common';

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
}

/**
 * 기본 옵션 산출
 * - secure 기본값은 initializeCommon()으로 주입된 nodeEnv에서 파생
 * - 미초기화 시 false로 폴백 (dev/test 안전 기본값)
 */
function getDefaultOptions(): CookieOptions {
  let isProduction = false;
  try {
    isProduction = getCommonConfig().nodeEnv === 'production';
  } catch {
    // common config 미초기화 시 secure=false (호출자가 명시 주입 권장)
  }
  return {
    secure: isProduction,
    sameSite: 'lax',
  };
}

export function setTokenCookies<T extends CookieSettableResponse>(
  response: T,
  tokenPair: TokenPair,
  options: CookieOptions = {},
): T {
  const opts = { ...getDefaultOptions(), ...options };

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
    path: opts.refreshTokenPath ?? '/api/auth',
    maxAge: 7 * 24 * 60 * 60,
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
