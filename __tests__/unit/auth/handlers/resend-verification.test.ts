import { describe, it, expect, vi } from 'vitest';
import { createResendVerificationHandler } from '@withwiz/toolkit/next/auth-handlers/resend-verification.handler';
import { createAuthHandlers } from '@withwiz/toolkit/next/auth-handlers';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

// 인증 메일 재발송 처리기 — 실제 EmailVerificationService 를 메모리 저장소로 돌린다.
// 응답은 계정 상태와 무관하게 같아야 한다(가입 여부 노출 방지).

type User = { id: string; email: string; emailVerified: Date | null };

function setup(users: User[], opts: { tokenCreate?: () => Promise<never>; noSender?: boolean; resolveSessionEmail?: NonNullable<AuthHandlerOptions['hooks']>['resolveSessionEmail'] } = {}) {
  const tokens: { email: string; token: string; type: string }[] = [];
  const sent: string[] = [];
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const options: AuthHandlerOptions = {
    dependencies: {
      userRepository: {
        findById: vi.fn(),
        findByEmail: vi.fn(async (email: string) => users.find((u) => u.email === email) ?? null),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateLastLoginAt: vi.fn(),
        verifyEmail: vi.fn(),
      } as any,
      oauthAccountRepository: {} as any,
      emailTokenRepository: {
        create: vi.fn(opts.tokenCreate ?? (async (email: string, token: string, type: string) => {
          tokens.push({ email, token, type });
          return { id: 't', email, token, type, expires: new Date(), used: false, createdAt: new Date() } as any;
        })),
        findByEmailAndToken: vi.fn(),
        delete: vi.fn(),
        deleteExpired: vi.fn(),
        markAsUsed: vi.fn(),
      },
      emailSender: opts.noSender ? undefined : ({
        sendVerificationEmail: vi.fn(async (email: string) => { sent.push(email); }),
        sendPasswordResetEmail: vi.fn(),
      } as any),
      logger,
    },
    jwt: { secret: 'a'.repeat(32) },
    urls: { baseUrl: 'http://localhost:3000' },
    ...(opts.resolveSessionEmail ? { hooks: { resolveSessionEmail: opts.resolveSessionEmail } } : {}),
  };
  return { handler: createResendVerificationHandler(options), tokens, sent, logger };
}

const post = (body: unknown) =>
  new Request('http://localhost/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;

const unverified: User = { id: 'u1', email: 'new@example.com', emailVerified: null };
const verified: User = { id: 'u2', email: 'done@example.com', emailVerified: new Date() };

describe('createResendVerificationHandler', () => {
  it('미인증 계정이면 토큰을 새로 만들고 인증 메일을 보낸다', async () => {
    const { handler, tokens, sent } = setup([unverified]);
    const res = await handler(post({ email: 'new@example.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ email: 'new@example.com', type: 'EMAIL_VERIFICATION' });
    expect(sent).toEqual(['new@example.com']);
  });

  it('없는 계정·이미 인증된 계정도 같은 200 을 주고 메일은 보내지 않는다', async () => {
    const { handler, sent, logger } = setup([verified]);
    for (const email of ['nobody@example.com', 'done@example.com']) {
      const res = await handler(post({ email }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    }
    expect(sent).toEqual([]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('예상 밖 오류도 응답은 같게 주되 로그로 남긴다(장애가 숨지 않게)', async () => {
    const { handler, logger } = setup([unverified], {
      tokenCreate: async () => { throw new Error('Argument `type` is missing.'); },
    });
    const res = await handler(post({ email: 'new@example.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(logger.error).toHaveBeenCalledWith(
      'Verification email resend failed',
      expect.objectContaining({ error: 'Argument `type` is missing.' }),
    );
  });

  it('이메일 형식이 아니면 400', async () => {
    const { handler } = setup([unverified]);
    const res = await handler(post({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('메일 발송기가 없으면 500', async () => {
    const { handler } = setup([unverified], { noSender: true });
    const res = await handler(post({ email: 'new@example.com' }));
    expect(res.status).toBe(500);
  });

  describe('hooks.resolveSessionEmail (0.32)', () => {
    it('세션 이메일이 있으면 본문 없이도 그 이메일로 보내고, 본문 email 은 무시한다', async () => {
      const { handler, sent } = setup([unverified], { resolveSessionEmail: async () => 'new@example.com' });
      const res = await handler(post({ email: 'someone-else@example.com' }));
      expect(res.status).toBe(200);
      expect(sent).toEqual(['new@example.com']);
      const res2 = await handler(post({}));
      expect(res2.status).toBe(200);
      expect(sent).toEqual(['new@example.com', 'new@example.com']);
    });

    it('세션이 없으면(null) 본문 email 을 쓰고, 본문도 없으면 400', async () => {
      const { handler, sent } = setup([unverified], { resolveSessionEmail: async () => null });
      expect((await handler(post({ email: 'new@example.com' }))).status).toBe(200);
      expect(sent).toEqual(['new@example.com']);
      expect((await handler(post({}))).status).toBe(400);
    });

    it('훅이 던지면 세션 없음으로 보고 warn 을 남긴다', async () => {
      const { handler, sent, logger } = setup([unverified], {
        resolveSessionEmail: async () => { throw new Error('bad token'); },
      });
      expect((await handler(post({ email: 'new@example.com' }))).status).toBe(200);
      expect(sent).toEqual(['new@example.com']);
      expect(logger.warn).toHaveBeenCalledWith('Session email lookup failed for verification resend', { error: 'bad token' });
    });
  });

  it('createAuthHandlers 가 resendVerification 을 돌려준다', () => {
    const handlers = createAuthHandlers({
      dependencies: { userRepository: {} as any, oauthAccountRepository: {} as any, emailTokenRepository: {} as any },
      jwt: { secret: 'a'.repeat(32) },
      urls: { baseUrl: 'http://localhost:3000' },
    });
    expect(typeof handlers.resendVerification).toBe('function');
  });
});
