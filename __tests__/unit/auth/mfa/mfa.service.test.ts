import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MfaService, resetMfa, type MfaProof } from '@withwiz/toolkit/core/auth/mfa/mfa.service';
import { createCacheMfaAttemptStore, createInMemoryMfaAttemptStore } from '@withwiz/toolkit/core/auth/mfa/attempt-store';
import { createSecretBox } from '@withwiz/toolkit/core/auth/mfa/secret-box';
import { currentStep, totpCode } from '@withwiz/toolkit/core/auth/mfa/totp';
import { MFA_LIMITS, type MfaAttemptStore } from '@withwiz/toolkit/core/auth/mfa/types';
import { AuthError, MfaLockedError } from '@withwiz/toolkit/core/auth/errors';
import { fakeAtomicCache, InMemoryMfaRepository } from './fakes';

const U = 'user-1';

let clock: number;
let repo: InMemoryMfaRepository;
let store: MfaAttemptStore;
let onFailure: ReturnType<typeof vi.fn>;
let onLocked: ReturnType<typeof vi.fn>;
let svc: MfaService;

const now = () => clock;
const advance = (sec: number) => {
  clock += sec * 1000;
};
const codeNow = (secret: string) => totpCode(secret, currentStep(clock));
/** 현재 허용 창(앞뒤 1스텝) 어디에도 맞지 않는 6자리 코드. */
const wrongCode = (secret: string) => {
  const s = currentStep(clock);
  const valid = new Set([s - 1, s, s + 1].map((x) => totpCode(secret, x)));
  for (let i = 0; ; i++) {
    const c = String(i).padStart(6, '0');
    if (!valid.has(c)) return c;
  }
};

async function expectAuthError(p: Promise<unknown>, code: string, status?: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AuthError);
  expect((err as AuthError).code).toBe(code);
  if (status !== undefined) expect((err as AuthError).statusCode).toBe(status);
  return err as AuthError;
}

/** 등록을 마치고 다음 스텝으로 시계를 옮긴다(등록에 쓴 스텝과 겹치지 않게). */
async function enrolled() {
  const { secret } = await svc.beginSetup(U, 'user@example.com');
  const { recoveryCodes } = await svc.enable(U, codeNow(secret));
  advance(30);
  return { secret, recoveryCodes };
}

beforeEach(() => {
  clock = 1_800_000_000_000;
  repo = new InMemoryMfaRepository();
  store = createInMemoryMfaAttemptStore({ now });
  onFailure = vi.fn(async () => {});
  onLocked = vi.fn(async () => {});
  svc = new MfaService({
    repository: repo,
    attemptStore: store,
    secretBox: createSecretBox([randomBytes(32).toString('base64')]),
    issuer: 'Binder',
    now,
    onFailure,
    onLocked,
  });
});

describe('MfaService 등록', () => {
  it('beginSetup → enable 로 켜지고 복구 코드 10개를 준다', async () => {
    const { secret, otpauthUri } = await svc.beginSetup(U, 'user@example.com');
    expect(otpauthUri).toContain(`secret=${secret}`);
    expect(otpauthUri).toContain('issuer=Binder');
    expect(await svc.isEnabled(U)).toBe(false);
    // 비밀 키는 봉인돼 저장된다
    const rec = await repo.findByUserId(U);
    expect(rec?.secretEnc.startsWith('v1.')).toBe(true);
    expect(rec?.secretEnc).not.toContain(secret);

    const { recoveryCodes } = await svc.enable(U, codeNow(secret));
    expect(recoveryCodes).toHaveLength(10);
    expect(await svc.isEnabled(U)).toBe(true);
    expect(await svc.status(U)).toEqual({ enabled: true, recoveryCodesRemaining: 10 });
  });

  it('켜진 상태에서 beginSetup·enable 은 MFA_ALREADY_ENABLED', async () => {
    const { secret } = await enrolled();
    await expectAuthError(svc.beginSetup(U, 'user@example.com'), 'MFA_ALREADY_ENABLED', 409);
    await expectAuthError(svc.enable(U, codeNow(secret)), 'MFA_ALREADY_ENABLED', 409);
  });

  it('진행 중 레코드가 없으면 enable 은 MFA_NOT_ENABLED', async () => {
    await expectAuthError(svc.enable(U, '123456'), 'MFA_NOT_ENABLED', 409);
  });

  it('진행 중 beginSetup 을 다시 부르면 비밀 키를 교체한다', async () => {
    const first = await svc.beginSetup(U, 'user@example.com');
    const second = await svc.beginSetup(U, 'user@example.com');
    expect(second.secret).not.toBe(first.secret);
    await expectAuthError(svc.enable(U, wrongCode(second.secret)), 'MFA_INVALID_CODE', 401);
    await svc.enable(U, codeNow(second.secret));
    expect(await svc.isEnabled(U)).toBe(true);
  });

  it('enable 의 틀린 코드는 실패로 센다', async () => {
    const { secret } = await svc.beginSetup(U, 'user@example.com');
    await expectAuthError(svc.enable(U, wrongCode(secret)), 'MFA_INVALID_CODE', 401);
    expect(onFailure).toHaveBeenCalledWith(U, 'invalid_code');
    expect(await svc.isEnabled(U)).toBe(false);
  });

  it('미설정 사용자의 status', async () => {
    expect(await svc.status(U)).toEqual({ enabled: false, recoveryCodesRemaining: 0 });
  });
});

describe('MfaService verifyChallenge', () => {
  it('같은 코드를 두 번 쓰면 두 번째는 MFA_INVALID_CODE(재사용)이고 실패로 센다', async () => {
    const { secret } = await enrolled();
    const code = codeNow(secret);
    expect(await svc.verifyChallenge(U, { code }, 'j1')).toBe('otp');
    await expectAuthError(svc.verifyChallenge(U, { code }, 'j2'), 'MFA_INVALID_CODE', 401);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(U, 'invalid_code');
  });

  it('성공하면 대기 토큰을 소비한다 — 같은 jti 재사용은 MFA_PENDING_EXPIRED', async () => {
    const { secret } = await enrolled();
    expect(await svc.verifyChallenge(U, { code: codeNow(secret) }, 'j1')).toBe('otp');
    advance(30);
    await expectAuthError(
      svc.verifyChallenge(U, { code: codeNow(secret) }, 'j1'),
      'MFA_PENDING_EXPIRED',
      401,
    );
  });

  it('복구 코드는 대소문자를 가리지 않고 1회만 쓴다', async () => {
    const { recoveryCodes } = await enrolled();
    const proof: MfaProof = { recoveryCode: recoveryCodes[0].toUpperCase() };
    expect(await svc.verifyChallenge(U, proof, 'j3')).toBe('rec');
    await expectAuthError(svc.verifyChallenge(U, proof, 'j4'), 'MFA_INVALID_CODE', 401);
    expect((await svc.status(U)).recoveryCodesRemaining).toBe(9);
  });

  it('정규화 결과가 빈 복구 코드는 틀린 코드로 센다', async () => {
    await enrolled();
    await expectAuthError(svc.verifyChallenge(U, { recoveryCode: '---' }, 'j1'), 'MFA_INVALID_CODE', 401);
    expect(onFailure).toHaveBeenCalledWith(U, 'invalid_code');
  });

  it('대기 토큰 5회 실패 → 다섯 번째가 MFA_PENDING_EXPIRED, 이후 올바른 코드도 거부', async () => {
    const { secret } = await enrolled();
    for (let i = 0; i < MFA_LIMITS.perPendingMaxFailures - 1; i++) {
      await expectAuthError(svc.verifyChallenge(U, { code: wrongCode(secret) }, 'jp'), 'MFA_INVALID_CODE');
    }
    await expectAuthError(svc.verifyChallenge(U, { code: wrongCode(secret) }, 'jp'), 'MFA_PENDING_EXPIRED', 401);
    await expectAuthError(svc.verifyChallenge(U, { code: codeNow(secret) }, 'jp'), 'MFA_PENDING_EXPIRED', 401);
  });

  it('사용자 10회 실패(jti 2개) → 열 번째가 MfaLockedError(900), 잠긴 동안 거부, 900초 뒤 통과', async () => {
    const { secret } = await enrolled();
    for (const jti of ['ja', 'jb']) {
      for (let i = 0; i < 4; i++) {
        await expectAuthError(svc.verifyChallenge(U, { code: wrongCode(secret) }, jti), 'MFA_INVALID_CODE');
      }
      if (jti === 'ja') {
        await expectAuthError(svc.verifyChallenge(U, { code: wrongCode(secret) }, jti), 'MFA_PENDING_EXPIRED');
      }
    }
    const err = await expectAuthError(
      svc.verifyChallenge(U, { code: wrongCode(secret) }, 'jb'),
      'MFA_LOCKED',
      429,
    );
    expect(err).toBeInstanceOf(MfaLockedError);
    expect((err as MfaLockedError).retryAfter).toBe(MFA_LIMITS.lockSec);
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(onLocked).toHaveBeenCalledWith(U);

    advance(60);
    const locked = await expectAuthError(
      svc.verifyChallenge(U, { code: codeNow(secret) }, 'jc'),
      'MFA_LOCKED',
      429,
    );
    expect((locked as MfaLockedError).retryAfter).toBe(MFA_LIMITS.lockSec - 60);
    expect(onFailure).toHaveBeenLastCalledWith(U, 'locked');
    expect(onLocked).toHaveBeenCalledTimes(1);

    advance(MFA_LIMITS.lockSec - 60);
    expect(await svc.verifyChallenge(U, { code: codeNow(secret) }, 'jc')).toBe('otp');
  });

  it('같은 유효 코드를 10번 재사용하면 잠긴다(재사용도 실패)', async () => {
    const { secret } = await enrolled();
    const code = codeNow(secret);
    expect(await svc.verifyChallenge(U, { code }, 'j0')).toBe('otp');
    const results: string[] = [];
    for (let i = 0; i < MFA_LIMITS.perUserMaxFailures; i++) {
      const err = await svc.verifyChallenge(U, { code }, `j${(i % 4) + 1}${Math.floor(i / 4)}`).catch((e: AuthError) => e);
      results.push((err as AuthError).code);
    }
    expect(results.slice(0, 9).every((c) => c === 'MFA_INVALID_CODE')).toBe(true);
    expect(results[9]).toBe('MFA_LOCKED');
    expect(onLocked).toHaveBeenCalledTimes(1);
  });

  it('순차 실패 12회 → 10~12번째 모두 MfaLockedError, onLocked 는 한 번', async () => {
    const { secret } = await enrolled();
    const codes: string[] = [];
    for (let i = 0; i < 12; i++) {
      const err = await svc
        .verifyChallenge(U, { code: wrongCode(secret) }, `js${Math.floor(i / 4)}`)
        .catch((e: AuthError) => e);
      codes.push((err as AuthError).code);
    }
    expect(codes.slice(9)).toEqual(['MFA_LOCKED', 'MFA_LOCKED', 'MFA_LOCKED']);
    expect(onLocked).toHaveBeenCalledTimes(1);
  });

  it('병렬 실패 묶음(12개)이 한도를 넘어도 onLocked 는 한 번', async () => {
    const { secret } = await enrolled();
    const bad = wrongCode(secret);
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => svc.verifyChallenge(U, { code: bad }, `jc${i}`)),
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    const locked = results.filter(
      (r) => r.status === 'rejected' && (r.reason as AuthError).code === 'MFA_LOCKED',
    );
    expect(locked.length).toBeGreaterThanOrEqual(3);
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(await store.lockedFor(U)).toBe(MFA_LIMITS.lockSec);
  });

  it('원자 캐시 저장소: 병렬 실패 30개가 모두 집계되고 잠금은 한 번, onLocked 도 한 번', async () => {
    const cache = fakeAtomicCache(now);
    store = createCacheMfaAttemptStore(cache, { now });
    svc = new MfaService({
      repository: repo,
      attemptStore: store,
      secretBox: createSecretBox([randomBytes(32).toString('base64')]),
      issuer: 'Binder',
      now,
      onFailure,
      onLocked,
    });
    const { secret } = await enrolled();
    const bad = wrongCode(secret);
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) => svc.verifyChallenge(U, { code: bad }, `ja${i}`)),
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(cache.peek('mfa:user:fail:user-1') as number).toBeGreaterThanOrEqual(MFA_LIMITS.perUserMaxFailures);
    expect(await store.lockedFor(U)).toBe(MFA_LIMITS.lockSec);
    expect(onLocked).toHaveBeenCalledTimes(1);
    const locked = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof MfaLockedError,
    );
    expect(locked.length).toBeGreaterThanOrEqual(30 - MFA_LIMITS.perUserMaxFailures + 1);
  });

  it('잠금 저장소가 이미 잠겨 있다고 답하면(lock=false) onLocked 를 부르지 않고 남은 초로 거부', async () => {
    const { secret } = await enrolled();
    for (let i = 0; i < MFA_LIMITS.perUserMaxFailures - 1; i++) {
      await svc.verifyChallenge(U, { code: wrongCode(secret) }, `jx${Math.floor(i / 4)}`).catch(() => {});
    }
    // 다른 요청이 먼저 잠근 상황: lockedFor 는 아직 0(확인 통과)이지만 lock 은 false
    vi.spyOn(store, 'lock').mockResolvedValue(false);
    vi.spyOn(store, 'lockedFor').mockResolvedValueOnce(0).mockResolvedValue(600);
    const err = await expectAuthError(svc.verifyChallenge(U, { code: wrongCode(secret) }, 'jy'), 'MFA_LOCKED', 429);
    expect((err as MfaLockedError).retryAfter).toBe(600);
    expect(onLocked).not.toHaveBeenCalled();
  });

  it('검증 도중 잠기면 맞는 코드라도 MfaLockedError(대기 토큰은 소비하지 않음)', async () => {
    const { secret } = await enrolled();
    const orig = repo.markStepUsed.bind(repo);
    vi.spyOn(repo, 'markStepUsed').mockImplementation(async (id, step) => {
      const ok = await orig(id, step);
      await store.lock(U, MFA_LIMITS.lockSec);
      return ok;
    });
    await expectAuthError(svc.verifyChallenge(U, { code: codeNow(secret) }, 'jl'), 'MFA_LOCKED', 429);
    expect(onFailure).toHaveBeenCalledWith(U, 'locked');
    expect(onFailure).not.toHaveBeenCalledWith(U, 'invalid_code');
    expect(await store.isPendingConsumed('jl')).toBe(false);
  });

  it('훅이 throw 해도 인증 흐름은 깨지지 않는다', async () => {
    onFailure.mockRejectedValue(new Error('hook down'));
    const { secret } = await enrolled();
    await expectAuthError(svc.verifyChallenge(U, { code: wrongCode(secret) }, 'j1'), 'MFA_INVALID_CODE');
    expect(await svc.verifyChallenge(U, { code: codeNow(secret) }, 'j2')).toBe('otp');
  });

  it('켜지지 않은 사용자는 MFA_NOT_ENABLED', async () => {
    await expectAuthError(svc.verifyChallenge(U, { code: '123456' }, 'j1'), 'MFA_NOT_ENABLED', 409);
  });
});

describe('MfaService 관리', () => {
  it('disable 실패도 사용자 실패 횟수에 합산된다', async () => {
    const { secret } = await enrolled();
    for (let i = 0; i < MFA_LIMITS.perUserMaxFailures - 1; i++) {
      await expectAuthError(svc.disable(U, { code: wrongCode(secret) }), 'MFA_INVALID_CODE');
    }
    await expectAuthError(svc.verifyChallenge(U, { code: wrongCode(secret) }, 'j1'), 'MFA_LOCKED', 429);
    await expectAuthError(svc.disable(U, { code: codeNow(secret) }), 'MFA_LOCKED', 429);
    expect(await svc.isEnabled(U)).toBe(true);
  });

  it('disable 은 TOTP 또는 복구 코드로 끈다', async () => {
    const { secret } = await enrolled();
    expect(await svc.disable(U, { code: codeNow(secret) })).toBe('code');
    expect(await svc.isEnabled(U)).toBe(false);
    await expectAuthError(svc.disable(U, { code: codeNow(secret) }), 'MFA_NOT_ENABLED', 409);

    const second = await enrolled();
    expect(await svc.disable(U, { recoveryCode: second.recoveryCodes[1] })).toBe('recoveryCode');
    expect(await svc.isEnabled(U)).toBe(false);
  });

  it('regenerateRecoveryCodes 후 옛 복구 코드는 실패, 새 코드는 성공', async () => {
    const { secret, recoveryCodes: old } = await enrolled();
    const { recoveryCodes: fresh } = await svc.regenerateRecoveryCodes(U, codeNow(secret));
    expect(fresh).toHaveLength(10);
    expect(await svc.status(U)).toEqual({ enabled: true, recoveryCodesRemaining: 10 });
    await expectAuthError(svc.verifyChallenge(U, { recoveryCode: old[0] }, 'j1'), 'MFA_INVALID_CODE');
    expect(await svc.verifyChallenge(U, { recoveryCode: fresh[0] }, 'j2')).toBe('rec');
  });

  it('regenerateRecoveryCodes 의 틀린 코드는 실패로 세고 코드를 바꾸지 않는다', async () => {
    const { secret, recoveryCodes } = await enrolled();
    await expectAuthError(svc.regenerateRecoveryCodes(U, wrongCode(secret)), 'MFA_INVALID_CODE');
    expect(onFailure).toHaveBeenCalledWith(U, 'invalid_code');
    expect(await svc.verifyChallenge(U, { recoveryCode: recoveryCodes[0] }, 'j1')).toBe('rec');
  });

  it('resetMfa 는 설정과 잠금을 모두 지운다', async () => {
    await enrolled();
    await store.lock(U, MFA_LIMITS.lockSec);
    await resetMfa({ repository: repo, attemptStore: store }, U);
    expect(await svc.isEnabled(U)).toBe(false);
    expect(await store.lockedFor(U)).toBe(0);
  });
});
