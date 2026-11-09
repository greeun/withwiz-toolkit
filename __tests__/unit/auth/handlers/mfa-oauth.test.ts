/**
 * OAuth 콜백의 MFA 분기 — MFA 를 켠 사용자는 access·refresh 쿠키를 하나도 받지 않는다(Review Focus 4).
 */
import { NextRequest } from 'next/server';
import { decodeJwt } from 'jose';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { initializeAuth, resetAuth } from '@withwiz/toolkit/core/auth/config';
import { createOAuthCallbackHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-callback.handler';
import { InMemoryMfaRepository } from '../mfa/fakes';

const mockExchangeCodeForToken = vi.fn();
const mockGetUserInfo = vi.fn();
vi.mock('@withwiz/toolkit/core/auth/oauth', () => ({
  OAuthManager: vi.fn().mockImplementation(function (this: any) {
    this.exchangeCodeForToken = mockExchangeCodeForToken;
    this.getUserInfo = mockGetUserInfo;
  }),
}));

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
const KEY = Buffer.alloc(32, 7).toString('base64url');

const existingUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'User One',
  role: 'USER',
  emailVerified: new Date(),
  isActive: true,
};

interface MakeOpts {
  withMfa?: boolean;
  mfaOn?: boolean;
  /** 'linked' = 기존 OAuth 연결, 'email' = 이메일로 기존 계정 연결, 'new' = 신규 생성 */
  account?: 'linked' | 'email' | 'new';
}

function makeOptions({ withMfa = true, mfaOn = true, account = 'linked' }: MakeOpts = {}) {
  const repo = new InMemoryMfaRepository();
  if (mfaOn) repo.records.set('u1', { userId: 'u1', secretEnc: 'x', enabledAt: new Date(), lastUsedStep: null });
  const updateLastLoginAt = vi.fn();
  const onAfterOAuth = vi.fn();
  const onOAuthFirstLogin = vi.fn().mockResolvedValue(undefined);
  const options = {
    dependencies: {
      userRepository: {
        findById: vi.fn().mockResolvedValue(existingUser),
        findByEmail: vi.fn().mockResolvedValue(account === 'new' ? null : existingUser),
        create: vi.fn().mockResolvedValue({ ...existingUser, id: 'u-new' }),
        updateLastLoginAt,
      } as any,
      oauthAccountRepository: {
        findByProvider: vi.fn().mockResolvedValue(account === 'linked' ? { id: 'acc-1', userId: 'u1' } : null),
        create: vi.fn().mockResolvedValue({ id: 'acc-2' }),
        update: vi.fn().mockResolvedValue(undefined),
      } as any,
      emailTokenRepository: {} as any,
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    },
    jwt: { secret: SECRET },
    oauth: { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/cb' } },
    urls: { baseUrl: 'http://localhost:3000', mfaChallenge: '/mfa', afterOAuth: '/dashboard' },
    hooks: { onAfterOAuth, onOAuthFirstLogin },
    ...(withMfa ? { mfa: { enabled: true, issuer: 'T', encryptionKeys: [KEY], repository: repo } } : {}),
  } as unknown as AuthHandlerOptions;
  return { options, updateLastLoginAt, onAfterOAuth, onOAuthFirstLogin };
}

function callbackReq(stateCookieName = 'oauth_state') {
  return new NextRequest('http://localhost/api/auth/oauth/callback/google?code=abc&state=st', {
    method: 'GET',
    headers: { cookie: `${stateCookieName}=st` },
  });
}

/** Set-Cookie 들을 이름 → 원문으로 */
function setCookies(res: Response): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of res.headers.getSetCookie()) map.set(c.slice(0, c.indexOf('=')), c);
  return map;
}

const TOKEN_COOKIE = /^(__Host-)?(access_token|refresh_token)$/;

describe('OAuth 콜백 MFA 분기', () => {
  beforeEach(() => {
    resetAuth();
    initializeAuth({ jwtSecret: SECRET } as any);
    mockExchangeCodeForToken.mockReset().mockResolvedValue('provider-at');
    mockGetUserInfo.mockReset().mockResolvedValue({
      id: 'g-1',
      email: 'u1@example.com',
      name: 'User One',
      image: null,
      emailVerified: true,
    });
  });

  afterAll(() => resetAuth());

  it.each(['linked', 'email'] as const)(
    'MFA 켠 기존 사용자(%s): 302 → mfaChallenge, mfa_pending 만, 토큰 쿠키 없음, 훅·로그인 기록 미호출',
    async (account) => {
      const { options, updateLastLoginAt, onAfterOAuth, onOAuthFirstLogin } = makeOptions({ account });
      const res = await createOAuthCallbackHandler(options)(callbackReq());

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('http://localhost:3000/mfa');

      const cookies = setCookies(res);
      expect([...cookies.keys()].filter((n) => TOKEN_COOKIE.test(n))).toEqual([]);
      expect(res.headers.getSetCookie().join('\n')).not.toMatch(/(access|refresh)_token=/);

      const pending = cookies.get('mfa_pending');
      expect(pending).toBeDefined();
      expect(pending).toMatch(/HttpOnly/i);
      expect(pending).toMatch(/Path=\/api\/auth/);

      // state 쿠키 삭제
      expect(cookies.get('oauth_state')).toMatch(/^oauth_state=;/);
      expect(cookies.get('oauth_state')).toMatch(/Max-Age=0/);

      const claims = decodeJwt(pending!.slice('mfa_pending='.length, pending!.indexOf(';')));
      expect(claims).toMatchObject({
        userId: 'u1',
        amr: ['fed'],
        origin: 'oauth',
        provider: 'google',
        tokenType: 'mfa_pending',
      });

      expect(updateLastLoginAt).not.toHaveBeenCalled();
      expect(onAfterOAuth).not.toHaveBeenCalled();
      expect(onOAuthFirstLogin).not.toHaveBeenCalled();
    },
  );

  it('cookieHostPrefix 를 켜도 __Host- 토큰 쿠키가 없고 __Host-mfa_pending 이 실린다', async () => {
    resetAuth();
    initializeAuth({ jwtSecret: SECRET, cookieSecure: true, cookieHostPrefix: true } as any);
    const { options, updateLastLoginAt } = makeOptions();
    const res = await createOAuthCallbackHandler(options)(callbackReq('__Host-oauth_state'));

    expect(res.status).toBe(302);
    const cookies = setCookies(res);
    expect([...cookies.keys()].filter((n) => TOKEN_COOKIE.test(n))).toEqual([]);
    expect(cookies.get('__Host-mfa_pending')).toBeDefined();
    expect(cookies.get('__Host-oauth_state')).toMatch(/Max-Age=0/);
    expect(updateLastLoginAt).not.toHaveBeenCalled();
  });

  it('MFA 기능만 켜고 사용자는 안 켬: 기존 리디렉션, 토큰 쿠키, access amr = [fed]', async () => {
    const { options, updateLastLoginAt, onAfterOAuth } = makeOptions({ mfaOn: false });
    const res = await createOAuthCallbackHandler(options)(callbackReq());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
    const cookies = setCookies(res);
    const access = cookies.get('access_token');
    expect(access).toBeDefined();
    expect(cookies.get('refresh_token')).toBeDefined();
    expect(cookies.has('mfa_pending')).toBe(false);
    expect(decodeJwt(access!.slice('access_token='.length, access!.indexOf(';'))).amr).toEqual(['fed']);
    expect(updateLastLoginAt).toHaveBeenCalledWith('u1');
    expect(onAfterOAuth).toHaveBeenCalledWith(existingUser, 'google', false);
  });

  it('신규 사용자는 MFA 를 건너뛰고 updateLastLoginAt 을 부르지 않는다', async () => {
    const { options, updateLastLoginAt, onAfterOAuth, onOAuthFirstLogin } = makeOptions({ account: 'new' });
    const res = await createOAuthCallbackHandler(options)(callbackReq());

    expect(res.status).toBe(307);
    const cookies = setCookies(res);
    expect(cookies.get('access_token')).toBeDefined();
    expect(cookies.has('mfa_pending')).toBe(false);
    expect(updateLastLoginAt).not.toHaveBeenCalled();
    expect(onAfterOAuth).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-new' }), 'google', true);
    expect(onOAuthFirstLogin).toHaveBeenCalledOnce();
  });

  it('mfa 미설정 회귀: access 에 amr 없음, mfa_pending 없음', async () => {
    const { options, updateLastLoginAt } = makeOptions({ withMfa: false });
    const res = await createOAuthCallbackHandler(options)(callbackReq());

    expect(res.status).toBe(307);
    const cookies = setCookies(res);
    const access = cookies.get('access_token')!;
    expect(decodeJwt(access.slice('access_token='.length, access.indexOf(';'))).amr).toBeUndefined();
    expect(cookies.has('mfa_pending')).toBe(false);
    expect(updateLastLoginAt).toHaveBeenCalledWith('u1');
  });

  it('미검증 이메일 연결 거부는 MFA 이전에 그대로 난다', async () => {
    mockGetUserInfo.mockResolvedValue({ id: 'g-1', email: 'u1@example.com', name: null, image: null, emailVerified: false });
    const { options } = makeOptions({ account: 'email' });
    const res = await createOAuthCallbackHandler(options)(callbackReq());

    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).toContain('OAUTH_EMAIL_NOT_VERIFIED');
    const cookies = setCookies(res);
    expect(cookies.has('mfa_pending')).toBe(false);
    expect([...cookies.keys()].filter((n) => TOKEN_COOKIE.test(n))).toEqual([]);
  });
});
