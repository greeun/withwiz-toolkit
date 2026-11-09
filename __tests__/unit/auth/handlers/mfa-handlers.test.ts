/**
 * /mfa/* 처리기 · /me 의 mfaEnabled · 비밀번호 재설정 후 잠금 해제
 * 실제 JWTService·MfaService 와 가짜 저장소로 처리기를 직접 호출한다.
 */
import { NextRequest } from 'next/server';
import { decodeJwt } from 'jose';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { authCookieName, initializeAuth, resetAuth } from '@withwiz/toolkit/core/auth/config';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import { createInMemoryMfaAttemptStore, currentStep, totpCode } from '@withwiz/toolkit/core/auth/mfa';
import { createLoginHandler } from '@withwiz/toolkit/next/auth-handlers/login.handler';
import { createOAuthCallbackHandler } from '@withwiz/toolkit/next/auth-handlers/oauth-callback.handler';
import { createMeHandler } from '@withwiz/toolkit/next/auth-handlers/me.handler';
import { createResetPasswordHandler } from '@withwiz/toolkit/next/auth-handlers/reset-password.handler';
import { getMfaRuntime } from '@withwiz/toolkit/next/auth-handlers/mfa-runtime';
import {
  createMfaVerifyHandler,
  createMfaStatusHandler,
  createMfaSetupHandler,
  createMfaEnableHandler,
  createMfaDisableHandler,
  createMfaRecoveryCodesHandler,
} from '@withwiz/toolkit/next/auth-handlers/mfa.handlers';
import { createAuthHandlers } from '@withwiz/toolkit/next/auth-handlers';
import { InMemoryMfaRepository } from '../mfa/fakes';

const mockCompare = vi.fn();
vi.mock('bcryptjs', () => ({
  compare: (...args: any[]) => mockCompare(...args),
  hash: vi.fn().mockResolvedValue('new-hash'),
}));

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

const testUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'User One',
  role: 'USER',
  emailVerified: new Date(),
  isActive: true,
  password: 'hashed',
};

interface MakeOpts {
  withMfa?: boolean;
  tokenDelivery?: 'cookie' | 'header' | 'hybrid';
  attemptStore?: any;
  extendUserResponse?: (u: any) => Promise<Record<string, unknown>>;
}

function makeOptions({ withMfa = true, tokenDelivery = 'hybrid', attemptStore, extendUserResponse }: MakeOpts = {}) {
  const repo = new InMemoryMfaRepository();
  const hooks = {
    onAfterLogin: vi.fn(),
    onAfterOAuth: vi.fn(),
    onOAuthFirstLogin: vi.fn().mockResolvedValue(undefined),
    onMfaEnabled: vi.fn(),
    onMfaDisabled: vi.fn(),
    ...(extendUserResponse ? { extendUserResponse } : {}),
  };
  const options = {
    dependencies: {
      userRepository: {
        findById: vi.fn().mockResolvedValue(testUser),
        findByEmail: vi.fn().mockResolvedValue(testUser),
        updateLastLoginAt: vi.fn(),
        update: vi.fn().mockResolvedValue(testUser),
      } as any,
      oauthAccountRepository: {
        findByProvider: vi.fn().mockResolvedValue({ id: 'acc-1', userId: 'u1' }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
      } as any,
      emailTokenRepository: {
        findByEmailAndToken: vi.fn().mockResolvedValue({ expires: new Date(Date.now() + 60_000) }),
        delete: vi.fn().mockResolvedValue(undefined),
      } as any,
      emailSender: {} as any,
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    },
    jwt: { secret: SECRET },
    oauth: { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/cb' } },
    urls: { baseUrl: 'http://localhost', mfaChallenge: '/mfa', afterOAuth: '/dashboard' },
    tokenDelivery,
    hooks,
    ...(withMfa
      ? { mfa: { enabled: true, issuer: 'T', encryptionKeys: [KEY], repository: repo, ...(attemptStore ? { attemptStore } : {}) } }
      : {}),
  } as unknown as AuthHandlerOptions;
  return { options, repo, hooks };
}

/** 서비스로 직접 MFA 를 켠다. 등록에 쓴 스텝은 now-1 이라 now·now+1 코드가 남는다 */
async function enableMfa(options: AuthHandlerOptions) {
  const rt = getMfaRuntime(options)!;
  const { secret } = await rt.service.beginSetup('u1', testUser.email);
  const { recoveryCodes } = await rt.service.enable('u1', totpCode(secret, currentStep() - 1));
  return { secret, recoveryCodes };
}

function wrongCode(secret: string): string {
  const s = currentStep();
  const valid = new Set([-1, 0, 1].map((d) => totpCode(secret, s + d)));
  return valid.has('000000') ? '111111' : '000000';
}

async function accessToken(): Promise<string> {
  const jwt = new JWTService({ secret: SECRET, accessTokenExpiry: '15m', refreshTokenExpiry: '7d', algorithm: 'HS256' } as any);
  const { accessToken } = await jwt.createTokenPair({ id: 'u1', email: testUser.email, role: 'USER' });
  return accessToken;
}

function jsonReq(path: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') {
  return new NextRequest(`http://localhost/api/auth${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
}

async function authed(path: string, body?: unknown, method = 'POST') {
  return jsonReq(path, body ?? {}, { authorization: `Bearer ${await accessToken()}` }, method);
}

function loginReq() {
  return jsonReq('/login', { email: testUser.email, password: 'pw' });
}

/** Set-Cookie 들을 이름 → 원문으로 */
function setCookies(res: Response): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of res.headers.getSetCookie()) map.set(c.slice(0, c.indexOf('=')), c);
  return map;
}

function pendingCookie(res: Response): { name: string; value: string } {
  for (const [name, raw] of setCookies(res)) {
    if (name.endsWith('mfa_pending')) return { name, value: raw.slice(name.length + 1, raw.indexOf(';')) };
  }
  throw new Error('no pending cookie');
}

function bodyText(body: unknown): string {
  return JSON.stringify(body);
}

describe('/mfa/* 처리기', () => {
  beforeEach(() => {
    resetAuth();
    initializeAuth({ jwtSecret: SECRET } as any);
    mockCompare.mockReset().mockResolvedValue(true);
    mockExchangeCodeForToken.mockReset().mockResolvedValue({ access_token: 'at' });
    mockGetUserInfo.mockReset().mockResolvedValue({
      id: 'g-1', email: testUser.email, name: testUser.name, provider: 'google',
    });
  });

  describe('verify', () => {
    it('로그인 대기 쿠키로 verify 성공: 세션 쿠키, amr=[pwd,otp,mfa], 대기 쿠키 삭제, onAfterLogin 1회', async () => {
      const { options, hooks } = makeOptions({ tokenDelivery: 'cookie' });
      const { secret } = await enableMfa(options);

      const login = await createLoginHandler(options)(loginReq());
      expect(login.status).toBe(401);
      expect(hooks.onAfterLogin).not.toHaveBeenCalled();
      const pc = pendingCookie(login);

      const res = await createMfaVerifyHandler(options)(
        jsonReq('/mfa/verify', { code: totpCode(secret, currentStep()) }, { cookie: `${pc.name}=${pc.value}` }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.user.id).toBe('u1');

      const cookies = setCookies(res);
      const access = [...cookies.entries()].find(([n]) => n.endsWith('access_token'));
      expect(access).toBeTruthy();
      expect([...cookies.keys()].some((n) => n.endsWith('refresh_token'))).toBe(true);
      const accessValue = access![1].slice(access![0].length + 1, access![1].indexOf(';'));
      expect(decodeJwt(accessValue).amr).toEqual(['pwd', 'otp', 'mfa']);

      const cleared = cookies.get(pc.name)!;
      expect(cleared).toMatch(/Max-Age=0/i);
      expect(cleared).toContain('Path=/api/auth');
      expect(hooks.onAfterLogin).toHaveBeenCalledOnce();
      expect(options.dependencies.userRepository.updateLastLoginAt).toHaveBeenCalledOnce();
    });

    it('header 모드: 본문 mfaToken 으로 verify 성공', async () => {
      const { options } = makeOptions({ tokenDelivery: 'header' });
      const { secret } = await enableMfa(options);
      const login = await createLoginHandler(options)(loginReq());
      const { mfaToken } = await login.json();
      expect(mfaToken).toBeTruthy();

      const res = await createMfaVerifyHandler(options)(
        jsonReq('/mfa/verify', { mfaToken, code: totpCode(secret, currentStep()) }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(decodeJwt(body.tokens.accessToken).amr).toEqual(['pwd', 'otp', 'mfa']);
    });

    it('복구 코드로 verify: amr=[pwd,rec,mfa]', async () => {
      const { options } = makeOptions({ tokenDelivery: 'header' });
      const { recoveryCodes } = await enableMfa(options);
      const { mfaToken } = await (await createLoginHandler(options)(loginReq())).json();
      const res = await createMfaVerifyHandler(options)(
        jsonReq('/mfa/verify', { mfaToken, recoveryCode: recoveryCodes[0] }),
      );
      expect(res.status).toBe(200);
      expect(decodeJwt((await res.json()).tokens.accessToken).amr).toEqual(['pwd', 'rec', 'mfa']);
    });

    it('OAuth 출신 대기 토큰: redirectTo, onAfterOAuth(user, google, false), onAfterLogin·onOAuthFirstLogin 미호출, amr=[fed,otp,mfa]', async () => {
      const { options, hooks } = makeOptions({ tokenDelivery: 'hybrid' });
      const { secret } = await enableMfa(options);

      const cb = await createOAuthCallbackHandler(options)(
        new NextRequest('http://localhost/api/auth/oauth/callback/google?code=abc&state=st', {
          method: 'GET',
          headers: { cookie: 'oauth_state=st' },
        }),
      );
      expect(cb.status).toBe(302);
      expect(hooks.onAfterOAuth).not.toHaveBeenCalled();
      const pc = pendingCookie(cb);

      const res = await createMfaVerifyHandler(options)(
        jsonReq('/mfa/verify', { code: totpCode(secret, currentStep()) }, { cookie: `${pc.name}=${pc.value}` }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.redirectTo).toBe('/dashboard');
      expect(decodeJwt(body.tokens.accessToken).amr).toEqual(['fed', 'otp', 'mfa']);
      expect(hooks.onAfterOAuth).toHaveBeenCalledOnce();
      expect(hooks.onAfterOAuth).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'google', false);
      expect(hooks.onAfterLogin).not.toHaveBeenCalled();
      expect(hooks.onOAuthFirstLogin).not.toHaveBeenCalled();
    });

    it('같은 대기 토큰으로 두 번째 verify 는 MFA_PENDING_EXPIRED + 대기 쿠키 삭제', async () => {
      const { options } = makeOptions({ tokenDelivery: 'header' });
      const { secret } = await enableMfa(options);
      const { mfaToken } = await (await createLoginHandler(options)(loginReq())).json();
      const verify = createMfaVerifyHandler(options);

      const first = await verify(jsonReq('/mfa/verify', { mfaToken, code: totpCode(secret, currentStep()) }));
      expect(first.status).toBe(200);
      const second = await verify(jsonReq('/mfa/verify', { mfaToken, code: totpCode(secret, currentStep() + 1) }));
      expect(second.status).toBe(401);
      expect(bodyText(await second.json())).toContain('MFA_PENDING_EXPIRED');
      expect(second.headers.getSetCookie().join('\n')).toMatch(/mfa_pending=;.*Max-Age=0/i);
    });

    it('대기 토큰 없음·위조 → 401 MFA_PENDING_EXPIRED', async () => {
      const { options } = makeOptions();
      await enableMfa(options);
      const verify = createMfaVerifyHandler(options);
      const none = await verify(jsonReq('/mfa/verify', { code: '123456' }));
      expect(none.status).toBe(401);
      expect(bodyText(await none.json())).toContain('MFA_PENDING_EXPIRED');
      const forged = await verify(jsonReq('/mfa/verify', { mfaToken: 'not-a-jwt', code: '123456' }));
      expect(forged.status).toBe(401);
      expect(bodyText(await forged.json())).toContain('MFA_PENDING_EXPIRED');
    });

    it('access 토큰을 대기 토큰 자리에 넣으면 MFA_PENDING_EXPIRED', async () => {
      const { options } = makeOptions();
      await enableMfa(options);
      const res = await createMfaVerifyHandler(options)(
        jsonReq('/mfa/verify', { mfaToken: await accessToken(), code: '123456' }),
      );
      expect(res.status).toBe(401);
      expect(bodyText(await res.json())).toContain('MFA_PENDING_EXPIRED');
    });

    it('틀린 코드는 401 MFA_INVALID_CODE 이고 대기 쿠키를 지우지 않는다', async () => {
      const { options } = makeOptions({ tokenDelivery: 'cookie' });
      const { secret } = await enableMfa(options);
      const pc = pendingCookie(await createLoginHandler(options)(loginReq()));
      const res = await createMfaVerifyHandler(options)(
        jsonReq('/mfa/verify', { code: wrongCode(secret) }, { cookie: `${pc.name}=${pc.value}` }),
      );
      expect(res.status).toBe(401);
      expect(bodyText(await res.json())).toContain('MFA_INVALID_CODE');
      expect(res.headers.getSetCookie().join('\n')).not.toContain('mfa_pending');
    });

    it('본문 검증 실패는 400 이고 실패 횟수에 들어가지 않는다', async () => {
      const { options } = makeOptions({ tokenDelivery: 'header' });
      const { secret } = await enableMfa(options);
      const { mfaToken } = await (await createLoginHandler(options)(loginReq())).json();
      const verify = createMfaVerifyHandler(options);
      // 대기 토큰당 한도(5회)만큼 잘못된 본문을 보내도 토큰이 살아 있어야 한다
      for (const body of [
        { mfaToken },
        { mfaToken, code: '12345' },
        { mfaToken, code: 'abcdef' },
        { mfaToken, code: '123456', recoveryCode: 'abcd-efgh' },
        { mfaToken, recoveryCode: 'x'.repeat(33) },
      ]) {
        const res = await verify(jsonReq('/mfa/verify', body));
        expect(res.status).toBe(400);
        expect(bodyText(await res.json())).toContain('VALIDATION_ERROR');
      }
      const raw = await verify(new NextRequest('http://localhost/api/auth/mfa/verify', {
        method: 'POST',
        headers: { cookie: `${authCookieName('mfa_pending')}=${mfaToken}` },
        body: 'not json',
      }));
      expect(raw.status).toBe(400);
      const ok = await verify(jsonReq('/mfa/verify', { mfaToken, code: totpCode(secret, currentStep()) }));
      expect(ok.status).toBe(200);
    });

    it('대기 토큰 검증 뒤 사용자가 비활성이면 401 MFA_PENDING_EXPIRED', async () => {
      const { options } = makeOptions({ tokenDelivery: 'header' });
      const { secret } = await enableMfa(options);
      const { mfaToken } = await (await createLoginHandler(options)(loginReq())).json();
      (options.dependencies.userRepository.findById as any).mockResolvedValue({ ...testUser, isActive: false });
      const res = await createMfaVerifyHandler(options)(
        jsonReq('/mfa/verify', { mfaToken, code: totpCode(secret, currentStep()) }),
      );
      expect(res.status).toBe(401);
      expect(bodyText(await res.json())).toContain('MFA_PENDING_EXPIRED');
    });

    it('잠김: 429, Retry-After: 900, 본문 retryAfter: 900', async () => {
      const { options } = makeOptions();
      const { secret } = await enableMfa(options);
      const disable = createMfaDisableHandler(options);
      for (let i = 0; i < 9; i++) {
        const res = await disable(await authed('/mfa/disable', { code: wrongCode(secret) }));
        expect(res.status).toBe(401);
      }
      const locked = await disable(await authed('/mfa/disable', { code: wrongCode(secret) }));
      expect(locked.status).toBe(429);
      expect(locked.headers.get('Retry-After')).toBe('900');
      const body = await locked.json();
      expect(body.retryAfter).toBe(900);
      expect(bodyText(body)).toContain('MFA_LOCKED');

      // 로그인 검증도 같은 잠금을 받는다(대기 쿠키는 남긴다)
      const { mfaToken } = await (await createLoginHandler(options)(loginReq())).json();
      const v = await createMfaVerifyHandler(options)(jsonReq('/mfa/verify', { mfaToken, code: totpCode(secret, currentStep()) }));
      expect(v.status).toBe(429);
      expect(Number(v.headers.get('Retry-After'))).toBeGreaterThan(0);
      expect(v.headers.getSetCookie().join('\n')).not.toContain('mfa_pending');
    });
  });

  describe('관리 처리기', () => {
    it('setup → enable → status(true, 10) → disable(복구 코드) → status(false)', async () => {
      const { options, hooks } = makeOptions();

      const setup = await createMfaSetupHandler(options)(await authed('/mfa/setup'));
      expect(setup.status).toBe(200);
      const s = await setup.json();
      expect(s.success).toBe(true);
      expect(s.secret).toMatch(/^[A-Z2-7]+$/);
      expect(s.otpauthUri).toContain(encodeURIComponent(testUser.email));

      const enable = await createMfaEnableHandler(options)(await authed('/mfa/enable', { code: totpCode(s.secret, currentStep()) }));
      expect(enable.status).toBe(200);
      const e = await enable.json();
      expect(e.success).toBe(true);
      expect(e.recoveryCodes).toHaveLength(10);
      expect(hooks.onMfaEnabled).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));

      const status = createMfaStatusHandler(options);
      const st1 = await (await status(await authed('/mfa/status', undefined, 'GET'))).json();
      expect(st1).toEqual({ success: true, enabled: true, recoveryCodesRemaining: 10 });

      const disable = await createMfaDisableHandler(options)(await authed('/mfa/disable', { recoveryCode: e.recoveryCodes[0] }));
      expect(disable.status).toBe(200);
      expect(await disable.json()).toEqual({ success: true });
      expect(hooks.onMfaDisabled).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'recoveryCode');

      const st2 = await (await status(await authed('/mfa/status', undefined, 'GET'))).json();
      expect(st2).toEqual({ success: true, enabled: false, recoveryCodesRemaining: 0 });
    });

    it('recovery-codes 재발급(TOTP 코드만), 복구 코드 본문은 400', async () => {
      const { options } = makeOptions();
      const { secret, recoveryCodes } = await enableMfa(options);
      const handler = createMfaRecoveryCodesHandler(options);
      const bad = await handler(await authed('/mfa/recovery-codes', { recoveryCode: recoveryCodes[0] }));
      expect(bad.status).toBe(400);
      const res = await handler(await authed('/mfa/recovery-codes', { code: totpCode(secret, currentStep()) }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.recoveryCodes).toHaveLength(10);
      expect(body.recoveryCodes).not.toContain(recoveryCodes[0]);
    });

    it('서비스 오류 코드가 상태와 함께 전달된다(이미 켬 → 409, 안 켬 → 409)', async () => {
      const { options } = makeOptions();
      const off = await createMfaDisableHandler(options)(await authed('/mfa/disable', { code: '123456' }));
      expect(off.status).toBe(409);
      expect(bodyText(await off.json())).toContain('MFA_NOT_ENABLED');
      await enableMfa(options);
      const again = await createMfaSetupHandler(options)(await authed('/mfa/setup'));
      expect(again.status).toBe(409);
      expect(bodyText(await again.json())).toContain('MFA_ALREADY_ENABLED');
    });

    it('enable 후 훅이 실패해도 복구 코드를 돌려준다', async () => {
      const { options, hooks } = makeOptions();
      hooks.onMfaEnabled.mockRejectedValue(new Error('hook down'));
      const s = await (await createMfaSetupHandler(options)(await authed('/mfa/setup'))).json();
      const res = await createMfaEnableHandler(options)(await authed('/mfa/enable', { code: totpCode(s.secret, currentStep()) }));
      expect(res.status).toBe(200);
      expect((await res.json()).recoveryCodes).toHaveLength(10);
      expect(options.dependencies.logger!.warn).toHaveBeenCalled();
    });

    it('로그인 없이 관리 처리기 → 401 UNAUTHORIZED', async () => {
      const { options } = makeOptions();
      const cases: Array<[(r: NextRequest) => Promise<Response>, string, string]> = [
        [createMfaStatusHandler(options), '/mfa/status', 'GET'],
        [createMfaSetupHandler(options), '/mfa/setup', 'POST'],
        [createMfaEnableHandler(options), '/mfa/enable', 'POST'],
        [createMfaDisableHandler(options), '/mfa/disable', 'POST'],
        [createMfaRecoveryCodesHandler(options), '/mfa/recovery-codes', 'POST'],
      ];
      for (const [handler, path, method] of cases) {
        const res = await handler(jsonReq(path, { code: '123456' }, {}, method));
        expect(res.status).toBe(401);
        expect(bodyText(await res.json())).toContain('UNAUTHORIZED');
        const forged = await handler(jsonReq(path, { code: '123456' }, { authorization: 'Bearer nope' }, method));
        expect(forged.status).toBe(401);
      }
    });

    it('비활성 사용자의 access 토큰 → 401', async () => {
      const { options } = makeOptions();
      (options.dependencies.userRepository.findById as any).mockResolvedValue({ ...testUser, isActive: false });
      const res = await createMfaStatusHandler(options)(await authed('/mfa/status', undefined, 'GET'));
      expect(res.status).toBe(401);
    });
  });

  describe('mfa 미설정', () => {
    it('6개 처리기 모두 404 MFA_NOT_CONFIGURED', async () => {
      const { options } = makeOptions({ withMfa: false });
      const handlers = [
        createMfaVerifyHandler, createMfaStatusHandler, createMfaSetupHandler,
        createMfaEnableHandler, createMfaDisableHandler, createMfaRecoveryCodesHandler,
      ];
      for (const create of handlers) {
        const res = await create(options)(await authed('/mfa/x', { code: '123456' }));
        expect(res.status).toBe(404);
        expect(bodyText(await res.json())).toContain('MFA_NOT_CONFIGURED');
      }
    });

    it('createAuthHandlers 에 6개 키가 있다', () => {
      const { options } = makeOptions({ withMfa: false });
      const h = createAuthHandlers(options);
      for (const k of ['mfaVerify', 'mfaStatus', 'mfaSetup', 'mfaEnable', 'mfaDisable', 'mfaRecoveryCodes'] as const) {
        expect(typeof h[k]).toBe('function');
      }
    });

    it('/me 에 mfaEnabled 가 없다', async () => {
      const { options } = makeOptions({ withMfa: false });
      const body = await (await createMeHandler(options)(await authed('/me', undefined, 'GET'))).json();
      expect(body.success).toBe(true);
      expect(Object.keys(body.user).sort()).toEqual(['email', 'emailVerified', 'id', 'name', 'role']);
    });
  });

  describe('/me', () => {
    it('런타임이 있으면 mfaEnabled 를 싣는다', async () => {
      const { options } = makeOptions();
      const me = createMeHandler(options);
      expect((await (await me(await authed('/me', undefined, 'GET'))).json()).user.mfaEnabled).toBe(false);
      await enableMfa(options);
      expect((await (await me(await authed('/me', undefined, 'GET'))).json()).user.mfaEnabled).toBe(true);
    });

    it('extendUserResponse 가 mfaEnabled 를 덮어쓸 수 있다', async () => {
      const { options } = makeOptions({ extendUserResponse: async () => ({ mfaEnabled: 'custom' }) });
      const body = await (await createMeHandler(options)(await authed('/me', undefined, 'GET'))).json();
      expect(body.user.mfaEnabled).toBe('custom');
    });
  });

  describe('비밀번호 재설정', () => {
    const resetReq = () => jsonReq('/reset-password', { email: testUser.email, token: 'tok', password: 'NewPassw0rd!' });

    it('재설정 후 잠금 해제', async () => {
      const { options } = makeOptions();
      const rt = getMfaRuntime(options)!;
      await rt.attemptStore.lock('u1', 900);
      expect(await rt.attemptStore.lockedFor('u1')).toBeGreaterThan(0);
      const res = await createResetPasswordHandler(options)(resetReq());
      expect(res.status).toBe(200);
      expect(await rt.attemptStore.lockedFor('u1')).toBe(0);
    });

    it('잠금 해제가 실패해도 재설정은 성공한다', async () => {
      const store = { ...createInMemoryMfaAttemptStore(), clearUser: vi.fn().mockRejectedValue(new Error('cache down')) };
      const { options } = makeOptions({ attemptStore: store });
      const res = await createResetPasswordHandler(options)(resetReq());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(store.clearUser).toHaveBeenCalledWith('u1');
      expect(options.dependencies.logger!.warn).toHaveBeenCalled();
    });
  });
});
