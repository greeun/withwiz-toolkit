/**
 * Unit Tests: 엣지 라우트 가드 (next/proxy)
 *
 * createAuthProxy / verifyAccessTokenEdge 의 계약을 검증한다.
 * DoD: 유효 / 만료 / 서명불일치 / 토큰없음 / 미보호경로.
 *
 * 검증은 jose 의 HS256 대칭키 서명 토큰으로 수행하며, 응답은 실제
 * NextResponse 동작(redirect status/location, next pass-through)으로 판정한다.
 */
import { SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import {
  createAuthProxy,
  verifyAccessTokenEdge,
} from '@withwiz/toolkit/next/proxy';

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
const WRONG_SECRET = 'another-secret-key-that-is-also-at-least-32-chars';
const key = new TextEncoder().encode(SECRET);
const wrongKey = new TextEncoder().encode(WRONG_SECRET);

/** 유효 access 토큰 (기본 15m 만료) */
async function validToken(signWith: Uint8Array = key): Promise<string> {
  return new SignJWT({ userId: 'u1', role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(signWith);
}

/** 이미 만료된 토큰 (exp 과거) */
async function expiredToken(): Promise<string> {
  const past = Math.floor(Date.now() / 1000) - 3600;
  return new SignJWT({ userId: 'u1', role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(past)
    .setExpirationTime(past + 60)
    .sign(key);
}

/** 최소 NextRequest 목 — proxy 가 참조하는 필드만 채운다 */
function mockRequest(opts: {
  pathname: string;
  search?: string;
  token?: string;
  cookieName?: string;
}): NextRequest {
  const cookieName = opts.cookieName ?? 'access_token';
  const search = opts.search ?? '';
  const url = `http://localhost:3000${opts.pathname}${search}`;
  return {
    url,
    nextUrl: { pathname: opts.pathname, search },
    cookies: {
      get: (name: string) =>
        name === cookieName && opts.token
          ? { name, value: opts.token }
          : undefined,
    },
  } as unknown as NextRequest;
}

const isProtected = (p: string) =>
  p === '/dashboard' || p.startsWith('/dashboard/');

function isRedirect(res: { status: number }): boolean {
  return res.status === 307 || res.status === 308;
}

describe('createAuthProxy', () => {
  const guard = createAuthProxy({ secret: SECRET, isProtected });

  it('미보호 경로면 undefined 를 반환한다 (합성 가능)', async () => {
    const res = await guard(mockRequest({ pathname: '/public' }));
    expect(res).toBeUndefined();
  });

  it('유효 토큰이면 NextResponse.next() 로 통과시킨다', async () => {
    const res = await guard(
      mockRequest({ pathname: '/dashboard', token: await validToken() }),
    );
    expect(res).toBeDefined();
    expect(isRedirect(res!)).toBe(false);
    expect(res!.status).toBe(200);
    // next() pass-through 표식
    expect(res!.headers.get('x-middleware-next')).toBe('1');
  });

  it('토큰이 없으면 로그인으로 리다이렉트한다', async () => {
    const res = await guard(mockRequest({ pathname: '/dashboard/settings' }));
    expect(res).toBeDefined();
    expect(isRedirect(res!)).toBe(true);
    expect(res!.headers.get('location')).toContain('/login');
  });

  it('만료 토큰이면 로그인으로 리다이렉트한다', async () => {
    const res = await guard(
      mockRequest({ pathname: '/dashboard', token: await expiredToken() }),
    );
    expect(res).toBeDefined();
    expect(isRedirect(res!)).toBe(true);
    expect(res!.headers.get('location')).toContain('/login');
  });

  it('서명 불일치(다른 시크릿) 토큰이면 리다이렉트한다', async () => {
    const res = await guard(
      mockRequest({ pathname: '/dashboard', token: await validToken(wrongKey) }),
    );
    expect(res).toBeDefined();
    expect(isRedirect(res!)).toBe(true);
    expect(res!.headers.get('location')).toContain('/login');
  });

  it('리다이렉트 시 access_token 쿠키를 제거한다', async () => {
    const res = await guard(mockRequest({ pathname: '/dashboard' }));
    // NextResponse.cookies.delete → 빈 값 + Max-Age=0
    expect(res!.cookies.get('access_token')?.value).toBe('');
  });

  it('redirectParam 지정 시 원래 목적지를 쿼리로 붙인다', async () => {
    const g = createAuthProxy({
      secret: SECRET,
      isProtected,
      redirectParam: 'redirect',
    });
    const res = await g(
      mockRequest({ pathname: '/dashboard', search: '?tab=1' }),
    );
    const location = res!.headers.get('location')!;
    const dest = new URL(location).searchParams.get('redirect');
    expect(dest).toBe('/dashboard?tab=1');
  });

  it('loginPath override 가 리다이렉트 대상에 반영된다', async () => {
    const g = createAuthProxy({
      secret: SECRET,
      isProtected,
      loginPath: '/signin',
    });
    const res = await g(mockRequest({ pathname: '/dashboard' }));
    expect(res!.headers.get('location')).toContain('/signin');
  });

  it('cookieName override 로 커스텀 쿠키명에서 토큰을 읽는다', async () => {
    const g = createAuthProxy({
      secret: SECRET,
      isProtected,
      cookieName: 'sid',
    });
    const res = await g(
      mockRequest({
        pathname: '/dashboard',
        token: await validToken(),
        cookieName: 'sid',
      }),
    );
    expect(res!.status).toBe(200);
    expect(res!.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('verifyAccessTokenEdge', () => {
  it('유효 토큰이면 payload 를 반환한다', async () => {
    const payload = await verifyAccessTokenEdge(await validToken(), {
      secret: SECRET,
    });
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('u1');
  });

  it('만료 토큰이면 null 을 반환한다', async () => {
    const payload = await verifyAccessTokenEdge(await expiredToken(), {
      secret: SECRET,
    });
    expect(payload).toBeNull();
  });

  it('서명 불일치면 null 을 반환한다', async () => {
    const payload = await verifyAccessTokenEdge(await validToken(wrongKey), {
      secret: SECRET,
    });
    expect(payload).toBeNull();
  });

  it('형식이 깨진 토큰이면 null 을 반환한다', async () => {
    const payload = await verifyAccessTokenEdge('not-a-jwt', {
      secret: SECRET,
    });
    expect(payload).toBeNull();
  });
});
