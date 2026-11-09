/**
 * MFA 런타임(getMfaRuntime) + 대기 토큰 전달(mfa-pending) 검증
 */
import { NextRequest } from 'next/server';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import type { MfaRepository } from '@withwiz/toolkit/core/auth/mfa';
import { getMfaRuntime } from '@withwiz/toolkit/next/auth-handlers/mfa-runtime';
import {
  MFA_PENDING_COOKIE,
  mfaRequiredResponse,
  readMfaPendingToken,
  setMfaPendingCookie,
  clearMfaPendingCookie,
} from '@withwiz/toolkit/next/auth-handlers/mfa-pending';
import { createAuthResponder } from '@withwiz/toolkit/next/auth-handlers/respond';
import { NextResponse } from 'next/server';

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
const KEY = Buffer.alloc(32, 7).toString('base64url');

function makeOptions(over: Partial<AuthHandlerOptions> = {}, mfa: Partial<NonNullable<AuthHandlerOptions['mfa']>> = {}): AuthHandlerOptions {
  return {
    dependencies: {
      userRepository: { findById: vi.fn() } as any,
      oauthAccountRepository: {} as any,
      emailTokenRepository: {} as any,
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    },
    jwt: { secret: SECRET },
    urls: { baseUrl: 'http://localhost', mfaChallenge: '/mfa' },
    mfa: { enabled: true, issuer: 'Test', encryptionKeys: [KEY], repository: {} as MfaRepository, ...mfa },
    ...over,
  } as AuthHandlerOptions;
}

describe('getMfaRuntime', () => {
  it('꺼져 있으면 null', () => {
    expect(getMfaRuntime(makeOptions({ mfa: undefined }))).toBeNull();
    expect(getMfaRuntime(makeOptions({}, { enabled: false }))).toBeNull();
  });

  it('같은 options 로 두 번 부르면 같은 객체', () => {
    const o = makeOptions();
    const a = getMfaRuntime(o);
    expect(a).not.toBeNull();
    expect(getMfaRuntime(o)).toBe(a);
    expect(a!.cookiePath).toBe('/api/auth');
  });

  it('mfaChallenge 가 없으면 throw', () => {
    const o = makeOptions();
    delete o.urls.mfaChallenge;
    expect(() => getMfaRuntime(o)).toThrow();
  });

  it('attemptStore 가 없으면 warn 1회', () => {
    const o = makeOptions();
    getMfaRuntime(o);
    getMfaRuntime(o);
    expect(o.dependencies.logger!.warn).toHaveBeenCalledTimes(1);
  });

  it('attemptStore 가 있으면 warn 하지 않고 그대로 쓴다', () => {
    const store = { fake: true } as any;
    const o = makeOptions({}, { attemptStore: store });
    expect(getMfaRuntime(o)!.attemptStore).toBe(store);
    expect(o.dependencies.logger!.warn).not.toHaveBeenCalled();
  });

  it('jwtService 가 만든 대기 토큰을 검증할 수 있다', async () => {
    const rt = getMfaRuntime(makeOptions())!;
    const { token } = await rt.jwtService.createMfaPendingToken({ userId: 'u1', amr: ['pwd'], origin: 'password' });
    expect((await rt.jwtService.verifyMfaPendingToken(token)).userId).toBe('u1');
  });
});

describe('mfaRequiredResponse', () => {
  const request = new NextRequest('http://localhost/api/auth/login', { method: 'POST' });

  async function run(tokenDelivery: 'cookie' | 'header' | 'hybrid') {
    const options = makeOptions({ tokenDelivery });
    const runtime = getMfaRuntime(options)!;
    const respond = createAuthResponder(options);
    const res = mfaRequiredResponse(request, respond, 'tok123', options, runtime);
    return { res, body: await res.json() };
  }

  it('cookie 모드: 쿠키만', async () => {
    const { res, body } = await run('cookie');
    expect(res.status).toBe(401);
    expect(body.error.key).toBe('MFA_REQUIRED');
    expect(body.error.code).toBe(40120);
    expect(body.mfaToken).toBeUndefined();
    const c = res.cookies.get(MFA_PENDING_COOKIE);
    expect(c?.value).toBe('tok123');
    expect(c?.path).toBe('/api/auth');
    expect(c?.httpOnly).toBe(true);
    expect(c?.maxAge).toBe(300);
  });

  it('header 모드: 본문 mfaToken 만', async () => {
    const { res, body } = await run('header');
    expect(res.status).toBe(401);
    expect(body.error.key).toBe('MFA_REQUIRED');
    expect(body.mfaToken).toBe('tok123');
    expect(res.cookies.get(MFA_PENDING_COOKIE)).toBeUndefined();
  });

  it('hybrid 모드: 둘 다', async () => {
    const { res, body } = await run('hybrid');
    expect(body.error.code).toBe(40120);
    expect(body.mfaToken).toBe('tok123');
    expect(res.cookies.get(MFA_PENDING_COOKIE)?.value).toBe('tok123');
  });
});

describe('readMfaPendingToken / clear', () => {
  it('쿠키 우선, 없으면 본문', () => {
    const withCookie = new NextRequest('http://localhost/x', { headers: { cookie: `${MFA_PENDING_COOKIE}=fromCookie` } });
    expect(readMfaPendingToken(withCookie, { mfaToken: 'fromBody' })).toBe('fromCookie');
    const bare = new NextRequest('http://localhost/x');
    expect(readMfaPendingToken(bare, { mfaToken: 'fromBody' })).toBe('fromBody');
    expect(readMfaPendingToken(bare, {})).toBeNull();
    expect(readMfaPendingToken(bare, null)).toBeNull();
  });

  it('clear 는 maxAge 0', () => {
    const res = NextResponse.json({});
    setMfaPendingCookie(res, 't', { path: '/api/auth' });
    clearMfaPendingCookie(res, { path: '/api/auth' });
    expect(res.cookies.get(MFA_PENDING_COOKIE)?.maxAge).toBe(0);
  });
});
