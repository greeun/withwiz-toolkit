/**
 * JWT 토큰을 HttpOnly 쿠키로 설정/삭제하는 유틸리티
 */
import { NextResponse } from 'next/server';
import type { TokenPair } from '@withwiz/auth/types';

export interface CookieOptions {
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  domain?: string;
}

const DEFAULT_OPTIONS: CookieOptions = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};

export function setTokenCookies(
  response: NextResponse,
  tokenPair: TokenPair,
  options: CookieOptions = {},
): NextResponse {
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

export function clearTokenCookies(
  response: NextResponse,
  options: CookieOptions = {},
): NextResponse {
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
