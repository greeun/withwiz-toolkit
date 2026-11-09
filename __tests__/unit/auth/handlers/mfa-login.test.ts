/**
 * 비밀번호 로그인의 MFA 분기 + 세션 발급기 ctx 검증
 */
import { NextRequest } from 'next/server';
import { decodeJwt } from 'jose';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { initializeAuth, resetAuth } from '@withwiz/toolkit/core/auth/config';
import { createLoginHandler } from '@withwiz/toolkit/next/auth-handlers/login.handler';
import { createSessionIssuer } from '@withwiz/toolkit/next/auth-handlers/session';
import { AMR } from '@withwiz/toolkit/core/auth/mfa/amr';
import { InMemoryMfaRepository } from '../mfa/fakes';

const mockCompare = vi.fn();
vi.mock('bcryptjs', () => ({ compare: (...args: any[]) => mockCompare(...args) }));

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

function makeOptions(over: Partial<AuthHandlerOptions> = {}, withMfa = false, mfaOn = false) {
  const repo = new InMemoryMfaRepository();
  if (mfaOn) repo.records.set('u1', { userId: 'u1', secretEnc: 'x', enabledAt: new Date(), lastUsedStep: null });
  const updateLastLoginAt = vi.fn();
  const onAfterLogin = vi.fn();
  const options = {
    dependencies: {
      userRepository: {
        findById: vi.fn().mockResolvedValue(testUser),
        findByEmail: vi.fn().mockResolvedValue(testUser),
        updateLastLoginAt,
      } as any,
      oauthAccountRepository: {} as any,
      emailTokenRepository: {} as any,
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    },
    jwt: { secret: SECRET },
    urls: { baseUrl: 'http://localhost', mfaChallenge: '/mfa' },
    tokenDelivery: 'hybrid',
    hooks: { onAfterLogin },
    ...(withMfa ? { mfa: { enabled: true, issuer: 'T', encryptionKeys: [KEY], repository: repo } } : {}),
    ...over,
  } as unknown as AuthHandlerOptions;
  return { options, updateLastLoginAt, onAfterLogin };
}

function loginReq() {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'u1@example.com', password: 'pw' }),
  });
}

describe('login MFA 분기', () => {
  beforeEach(() => {
    resetAuth();
    initializeAuth({ jwtSecret: SECRET } as any);
    mockCompare.mockReset().mockResolvedValue(true);
  });

  it('MFA 켠 사용자: 401 MFA_REQUIRED, 대기 쿠키만, 로그인 기록·훅 미호출', async () => {
    const { options, updateLastLoginAt, onAfterLogin } = makeOptions({}, true, true);
    const res = await createLoginHandler(options)(loginReq());
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(JSON.stringify(body)).toContain('MFA_REQUIRED');
    expect(body.mfaToken).toBeTruthy();
    const cookies = res.headers.getSetCookie().join('\n');
    expect(cookies).toContain('mfa_pending=');
    expect(cookies).not.toMatch(/access_token=/);
    expect(cookies).not.toMatch(/refresh_token=/);
    expect(updateLastLoginAt).not.toHaveBeenCalled();
    expect(onAfterLogin).not.toHaveBeenCalled();
  });

  it('비밀번호가 틀리면 MFA 여부와 무관하게 INVALID_CREDENTIALS', async () => {
    mockCompare.mockResolvedValue(false);
    const { options } = makeOptions({}, true, true);
    const res = await createLoginHandler(options)(loginReq());
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(JSON.stringify(body)).toContain('INVALID_CREDENTIALS');
    expect(body.mfaToken).toBeUndefined();
    expect(res.headers.getSetCookie().join('\n')).not.toContain('mfa_pending');
  });

  it('미인증 이메일은 MFA 보다 먼저 EMAIL_NOT_VERIFIED', async () => {
    const { options } = makeOptions({ features: { emailVerificationRequired: true } as any }, true, true);
    (options.dependencies.userRepository.findByEmail as any).mockResolvedValue({ ...testUser, emailVerified: null });
    const res = await createLoginHandler(options)(loginReq());
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).toContain('EMAIL_NOT_VERIFIED');
  });

  it('MFA 기능만 켜고 사용자는 안 켬: 200, access amr = [pwd]', async () => {
    const { options, updateLastLoginAt, onAfterLogin } = makeOptions({}, true, false);
    const res = await createLoginHandler(options)(loginReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(decodeJwt(body.tokens.accessToken).amr).toEqual(['pwd']);
    expect(updateLastLoginAt).toHaveBeenCalledOnce();
    expect(onAfterLogin).toHaveBeenCalledOnce();
  });

  it('mfa 미설정 회귀: 본문 키 집합이 0.29 와 같고 amr 없음', async () => {
    const { options } = makeOptions();
    const res = await createLoginHandler(options)(loginReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['success', 'tokens', 'user']);
    expect(decodeJwt(body.tokens.accessToken).amr).toBeUndefined();
  });
});

describe('issueSession ctx', () => {
  beforeEach(() => {
    resetAuth();
    initializeAuth({ jwtSecret: SECRET } as any);
  });

  it('callAfterLogin=false 면 onAfterLogin 생략, updateLastLoginAt 은 호출, amr 전달', async () => {
    const { options, updateLastLoginAt, onAfterLogin } = makeOptions();
    const issue = createSessionIssuer(options);
    const res = await issue(testUser as any, loginReq(), {}, 200, { amr: [AMR.PASSWORD, AMR.OTP], callAfterLogin: false });
    const body = await res.json();
    expect(decodeJwt(body.tokens.accessToken).amr).toEqual(['pwd', 'otp']);
    expect(updateLastLoginAt).toHaveBeenCalledOnce();
    expect(onAfterLogin).not.toHaveBeenCalled();
  });
});
