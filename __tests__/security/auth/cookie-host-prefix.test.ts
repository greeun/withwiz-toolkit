/**
 * cookieHostPrefix — 쿠키 토싱 방어
 *
 * 같은 등록 도메인의 다른 서브도메인은 `Domain=.example.com` 쿠키를 심을 수 있다. 공격자 계정의 유효한 토큰이나
 * 자기가 아는 OAuth state 를 심으면 피해자가 공격자 계정으로 로그인된다. `__Host-` 쿠키는 브라우저가
 * Domain 이 있는 설정을 거부하므로, 이 이름만 읽으면 심은 쿠키가 무시된다.
 */
import { NextResponse } from 'next/server';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { initializeAuth, resetAuth } from '@withwiz/toolkit/core/auth/config';
import { clearTokenCookies, setTokenCookies } from '@withwiz/toolkit/core/auth/jwt/cookie';
import { getTokenDeliveryStrategy } from '@withwiz/toolkit/core/auth/token-delivery';
import { clearOAuthStateCookie, setOAuthStateCookie } from '@withwiz/toolkit/core/auth/oauth/state-cookie';
import { ConfigurationError } from '@withwiz/toolkit/core/config/errors';
import { createOAuthCallbackHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-callback.handler';

const SECRET = 'a'.repeat(32);
const tokens = { accessToken: 'at', refreshToken: 'rt' };

function enable() {
  initializeAuth({ jwtSecret: SECRET, cookieSecure: true, cookieHostPrefix: true });
}

function setCookieLines(res: Response): string[] {
  return res.headers.getSetCookie();
}

function lineFor(res: Response, name: string): string {
  const line = setCookieLines(res).find((l) => l.startsWith(`${name}=`));
  expect(line, `${name} Set-Cookie`).toBeDefined();
  return line!;
}

/** 브라우저가 __Host- 쿠키를 받아들이는 조건 */
function expectValidHostCookie(line: string) {
  expect(line).toMatch(/;\s*Secure/i);
  expect(line).toMatch(/;\s*Path=\/(;|$)/i);
  expect(line).not.toMatch(/;\s*Domain=/i);
}

function source(cookies: Record<string, string>) {
  return {
    cookies: {
      get: (name: string) => (cookies[name] !== undefined ? { value: cookies[name] } : undefined),
    },
    headers: { get: () => null },
  };
}

beforeEach(() => resetAuth());
afterEach(() => resetAuth());

describe('설정 검증', () => {
  it('cookieSecure 없이 켜면 부팅 때 실패한다 — 브라우저가 쿠키를 거부해 로그인이 조용히 깨지기 때문이다', () => {
    expect(() => initializeAuth({ jwtSecret: SECRET, cookieHostPrefix: true })).toThrow(ConfigurationError);
    expect(() =>
      initializeAuth({ jwtSecret: SECRET, cookieSecure: false, cookieHostPrefix: true }),
    ).toThrow(ConfigurationError);
  });
});

describe('기본값(꺼짐)은 기존 동작을 유지한다', () => {
  it('쿠키 이름과 refresh 경로가 그대로다', () => {
    initializeAuth({ jwtSecret: SECRET, cookieSecure: true });
    const res = setTokenCookies(NextResponse.json({}), tokens);
    expect(lineFor(res, 'access_token')).toMatch(/Path=\/(;|$)/i);
    expect(lineFor(res, 'refresh_token')).toMatch(/Path=\/api\/auth/i);
  });

  it('기존 이름의 쿠키를 읽는다', async () => {
    initializeAuth({ jwtSecret: SECRET, cookieSecure: true });
    const strategy = getTokenDeliveryStrategy('cookie');
    const src = source({ access_token: 'a', refresh_token: 'r' });
    expect(strategy.extractAccessToken(src, () => null)).toBe('a');
    expect(await strategy.extractRefreshToken(src)).toBe('r');
  });
});

describe('토큰 쿠키 쓰기', () => {
  it('__Host- 이름과 브라우저가 요구하는 속성으로 쓴다', () => {
    enable();
    const res = setTokenCookies(NextResponse.json({}), tokens);
    expectValidHostCookie(lineFor(res, '__Host-access_token'));
    expectValidHostCookie(lineFor(res, '__Host-refresh_token'));
    expect(setCookieLines(res)).toHaveLength(2);
  });

  it('호출자 옵션이 __Host- 조건을 깨지 못한다', () => {
    enable();
    const res = setTokenCookies(NextResponse.json({}), tokens, {
      secure: false,
      domain: '.example.com',
      refreshTokenPath: '/api/auth',
    });
    expectValidHostCookie(lineFor(res, '__Host-access_token'));
    expectValidHostCookie(lineFor(res, '__Host-refresh_token'));
  });

  it('로그아웃도 같은 이름과 속성으로 지운다 — 다르면 브라우저가 삭제를 거부한다', () => {
    enable();
    const res = clearTokenCookies(NextResponse.json({}), { secure: false, domain: '.example.com' });
    for (const name of ['__Host-access_token', '__Host-refresh_token']) {
      const line = lineFor(res, name);
      expectValidHostCookie(line);
      expect(line).toMatch(/Max-Age=0/i);
    }
  });
});

describe.each(['cookie', 'hybrid'] as const)('토큰 쿠키 읽기 (%s)', (mode) => {
  it('__Host- 쿠키를 읽는다', async () => {
    enable();
    const strategy = getTokenDeliveryStrategy(mode);
    const src = source({ '__Host-access_token': 'a', '__Host-refresh_token': 'r' });
    expect(strategy.extractAccessToken(src, () => null)).toBe('a');
    expect(await strategy.extractRefreshToken(src)).toBe('r');
  });

  it('다른 서브도메인이 심을 수 있는 접두사 없는 쿠키는 무시한다', async () => {
    enable();
    const strategy = getTokenDeliveryStrategy(mode);
    const src = source({ access_token: 'tossed', refresh_token: 'tossed' });
    expect(strategy.extractAccessToken(src, () => null)).toBeNull();
    expect(await strategy.extractRefreshToken(src)).toBeUndefined();
  });
});

describe('OAuth state 쿠키', () => {
  const options = {
    dependencies: { userRepository: {}, oauthAccountRepository: {}, emailTokenRepository: {} },
    oauth: { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/cb' } },
    jwt: { secret: SECRET },
    urls: { baseUrl: 'http://localhost:3000' },
  } as unknown as AuthHandlerOptions;

  function callback(cookies: Record<string, string>) {
    const req = new Request(
      'http://localhost/api/auth/oauth/callback?code=abc&provider=google&state=S1',
    ) as unknown as Request & { cookies: unknown };
    req.cookies = { get: (name: string) => (cookies[name] !== undefined ? { name, value: cookies[name] } : undefined) };
    return createOAuthCallbackHandler(options)(req as never);
  }

  it('__Host- 이름과 속성으로 쓰고 지운다', () => {
    enable();
    const set = setOAuthStateCookie(NextResponse.json({}), 'S1', { secure: false, domain: '.example.com' });
    expectValidHostCookie(lineFor(set, '__Host-oauth_state'));
    const cleared = clearOAuthStateCookie(NextResponse.json({}), { secure: false, domain: '.example.com' });
    expectValidHostCookie(lineFor(cleared, '__Host-oauth_state'));
  });

  it('공격자가 심은 접두사 없는 state 로는 콜백을 통과하지 못한다', async () => {
    enable();
    const res = await callback({ oauth_state: 'S1' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual(expect.objectContaining({ key: 'OAUTH_STATE_INVALID' }));
  });

  it('__Host- state 는 검증을 통과한다', async () => {
    enable();
    const res = await callback({ '__Host-oauth_state': 'S1' });
    // state 검증 뒤 단계(코드 교환)로 넘어간다 — 외부 호출이 없는 테스트 환경에서는 다른 오류가 된다.
    const body = await res.json();
    expect(body.error?.key).not.toBe('OAUTH_STATE_INVALID');
  });

  it('기본값(꺼짐)은 기존 이름을 쓴다', () => {
    initializeAuth({ jwtSecret: SECRET, cookieSecure: true });
    expect(lineFor(setOAuthStateCookie(NextResponse.json({}), 'S1'), 'oauth_state')).toBeTruthy();
  });
});
