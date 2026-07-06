/**
 * 엣지 라우트 가드 — Next middleware.ts/proxy.ts 에서 쿠키의 access_token 을
 * 검증해 리다이렉트하는 헬퍼.
 *
 * 엣지 안전 제약: 이 모듈은 `next/server` + `jose` + cookie-names leaf 외에는
 * 절대 import 하지 않는다. core auth 배럴(JWTManager)·winston·node:crypto 를
 * 끌어오면 엣지 런타임에서 깨진다. 검증은 jose 의 jwtVerify 직접 호출이며,
 * HS256 대칭키를 우선 지원한다(비대칭 RS256/JWKS 는 후속 범위).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';
import { ACCESS_TOKEN_COOKIE } from '@withwiz/toolkit/core/auth/cookie-names';

export interface AuthProxyOptions {
  /** JWT_SECRET (HS256 대칭키) */
  secret: string;
  /** 허용 알고리즘. 기본 ['HS256'] */
  algorithms?: string[];
  /** access 토큰 쿠키명. 기본 'access_token' */
  cookieName?: string;
  /** 미인증 리다이렉트 대상. 기본 '/login' */
  loginPath?: string;
  /** 원래 목적지를 붙일 쿼리 파라미터명. false면 미부착. 기본 false */
  redirectParam?: string | false;
  /** 이 경로를 보호할지 판정. true인 경로만 가드가 동작. */
  isProtected: (pathname: string) => boolean;
}

function redirectToLogin(req: NextRequest, opts: AuthProxyOptions): NextResponse {
  const url = new URL(opts.loginPath ?? '/login', req.url);
  if (opts.redirectParam) {
    url.searchParams.set(opts.redirectParam, req.nextUrl.pathname + req.nextUrl.search);
  }
  const res = NextResponse.redirect(url);
  res.cookies.delete(opts.cookieName ?? ACCESS_TOKEN_COOKIE);
  return res;
}

/**
 * 엣지 라우트 가드 팩토리. 반환 함수는:
 *  - 보호 대상이 아니면 `undefined` (호출측 proxy 로직과 합성 가능 — 라우팅/locale 등)
 *  - 미인증/무효면 로그인 리다이렉트 NextResponse
 *  - 유효면 NextResponse.next()
 */
export function createAuthProxy(opts: AuthProxyOptions) {
  const key = new TextEncoder().encode(opts.secret);
  const algorithms = opts.algorithms ?? ['HS256'];
  const cookieName = opts.cookieName ?? ACCESS_TOKEN_COOKIE;

  return async function authProxy(req: NextRequest): Promise<NextResponse | undefined> {
    if (!opts.isProtected(req.nextUrl.pathname)) return undefined;
    const token = req.cookies.get(cookieName)?.value;
    if (!token) return redirectToLogin(req, opts);
    try {
      await jwtVerify(token, key, { algorithms });
      return NextResponse.next();
    } catch {
      return redirectToLogin(req, opts);
    }
  };
}

/** 저수준: 커스텀 합성용. 유효하면 payload, 아니면 null. */
export async function verifyAccessTokenEdge(
  token: string,
  args: { secret: string; algorithms?: string[] },
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(args.secret),
      { algorithms: args.algorithms ?? ['HS256'] },
    );
    return payload;
  } catch {
    return null;
  }
}
