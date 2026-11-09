/**
 * MfaService — TOTP 등록·검증·해제·복구 코드 재발급.
 *
 * 모든 증명 확인은 같은 순서를 따른다(checkProof):
 *   1. 잠금 확인 → MfaLockedError
 *   2. (verifyChallenge 만) 대기 토큰 소비 여부 → MFA_PENDING_EXPIRED
 *   3. TOTP(스텝 재사용 방지) 또는 복구 코드(1회용) 확인
 *   4. 실패 처리: 사용자 실패 → 잠금, 대기 토큰 실패 → 폐기, 그 밖은 MFA_INVALID_CODE
 * 로그인 검증과 관리 메서드(enable·disable·regenerate)의 실패는 사용자 한도에 합산된다.
 *
 * 동시성: 실패 횟수와 잠금은 최선 노력(best-effort)이다. 병렬 요청이 모두 잠금 확인을
 * 통과한 뒤 실패를 기록하면 한도를 넘는 시도가 일부 검증될 수 있다. 잠금 훅은 한도에
 * 정확히 닿은 요청에서만 부르고, 증명이 맞아도 성공 직전에 잠금을 다시 확인해 거부한다.
 * 소비자는 `/mfa/*` 경로에 요청 단위 rate limit 을 유지해야 한다.
 */
import { AuthError, MfaLockedError } from '@withwiz/toolkit/core/auth/errors';
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from './recovery-codes';
import type { SecretBox } from './secret-box';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from './totp';
import { MFA_LIMITS, type MfaAttemptStore, type MfaRepository, type UserMfaRecord } from './types';

export type MfaProof = { code: string } | { recoveryCode: string };

export type MfaFailureReason = 'invalid_code' | 'locked';

export interface MfaServiceConfig {
  repository: MfaRepository;
  attemptStore: MfaAttemptStore;
  secretBox: SecretBox;
  /** otpauth URI 의 발급자 이름 */
  issuer: string;
  /** 현재 시각(ms). 테스트용 주입. 기본 Date.now */
  now?: () => number;
  onFailure?: (userId: string, reason: MfaFailureReason) => Promise<void>;
  onLocked?: (userId: string) => Promise<void>;
}

type ProofKind = 'otp' | 'rec';

const notEnabled = () => new AuthError('MFA is not enabled', 'MFA_NOT_ENABLED', 409);
const alreadyEnabled = () => new AuthError('MFA is already enabled', 'MFA_ALREADY_ENABLED', 409);
const pendingExpired = () => new AuthError('MFA challenge expired', 'MFA_PENDING_EXPIRED', 401);
const invalidCode = () => new AuthError('Invalid MFA code', 'MFA_INVALID_CODE', 401);

const isEnabledRecord = (r: UserMfaRecord | null): r is UserMfaRecord => !!r && r.enabledAt !== null;

export class MfaService {
  private readonly repo: MfaRepository;
  private readonly store: MfaAttemptStore;
  private readonly box: SecretBox;
  private readonly issuer: string;
  private readonly now: () => number;
  private readonly onFailure?: MfaServiceConfig['onFailure'];
  private readonly onLocked?: MfaServiceConfig['onLocked'];

  constructor(cfg: MfaServiceConfig) {
    this.repo = cfg.repository;
    this.store = cfg.attemptStore;
    this.box = cfg.secretBox;
    this.issuer = cfg.issuer;
    this.now = cfg.now ?? Date.now;
    this.onFailure = cfg.onFailure;
    this.onLocked = cfg.onLocked;
  }

  async isEnabled(userId: string): Promise<boolean> {
    return isEnabledRecord(await this.repo.findByUserId(userId));
  }

  async status(userId: string): Promise<{ enabled: boolean; recoveryCodesRemaining: number }> {
    const enabled = await this.isEnabled(userId);
    return {
      enabled,
      recoveryCodesRemaining: enabled ? await this.repo.countUnusedRecoveryCodes(userId) : 0,
    };
  }

  /** 새 비밀 키를 봉인해 대기 상태로 저장한다. 진행 중 레코드가 있으면 교체한다. */
  async beginSetup(userId: string, account: string): Promise<{ secret: string; otpauthUri: string }> {
    if (await this.isEnabled(userId)) throw alreadyEnabled();
    const secret = generateTotpSecret();
    await this.repo.savePendingSecret(userId, this.box.seal(secret));
    return { secret, otpauthUri: buildOtpauthUri({ issuer: this.issuer, account, secret }) };
  }

  async enable(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const record = await this.repo.findByUserId(userId);
    if (!record) throw notEnabled();
    if (record.enabledAt !== null) throw alreadyEnabled();
    await this.checkProof(record, { code });
    const recoveryCodes = generateRecoveryCodes();
    await this.repo.enable(userId, recoveryCodes.map(hashRecoveryCode));
    return { recoveryCodes };
  }

  async disable(userId: string, proof: MfaProof): Promise<'code' | 'recoveryCode'> {
    const record = await this.repo.findByUserId(userId);
    if (!isEnabledRecord(record)) throw notEnabled();
    const kind = await this.checkProof(record, proof);
    await this.repo.disable(userId);
    return kind === 'otp' ? 'code' : 'recoveryCode';
  }

  /** TOTP 코드만 받는다(복구 코드로 복구 코드를 재발급하지 않는다). */
  async regenerateRecoveryCodes(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const record = await this.repo.findByUserId(userId);
    if (!isEnabledRecord(record)) throw notEnabled();
    await this.checkProof(record, { code });
    const recoveryCodes = generateRecoveryCodes();
    await this.repo.replaceRecoveryCodes(userId, recoveryCodes.map(hashRecoveryCode));
    return { recoveryCodes };
  }

  /** 로그인 2단계 검증. 성공하면 대기 토큰을 소비한다. */
  async verifyChallenge(userId: string, proof: MfaProof, pendingJti: string): Promise<ProofKind> {
    const record = await this.repo.findByUserId(userId);
    if (!isEnabledRecord(record)) throw notEnabled();
    const kind = await this.checkProof(record, proof, pendingJti);
    // 동시에 같은 대기 토큰으로 성공한 요청이 있으면 하나만 통과시킨다.
    if (!(await this.store.consumePending(pendingJti, MFA_LIMITS.pendingTtlSec))) throw pendingExpired();
    // 성공해도 사용자 실패 창은 지우지 않는다(시간으로 만료된다).
    return kind;
  }

  private async checkProof(record: UserMfaRecord, proof: MfaProof, pendingJti?: string): Promise<ProofKind> {
    const { userId } = record;

    await this.assertNotLocked(userId);

    if (pendingJti !== undefined && (await this.store.isPendingConsumed(pendingJti))) {
      throw pendingExpired();
    }

    const kind = await this.verifyProof(record, proof);
    if (kind) {
      // 병렬 실패 묶음이 검증 도중 한도를 넘겼다면 맞는 증명도 거부한다(실패로 새로 세지 않음).
      await this.assertNotLocked(userId);
      return kind;
    }

    await this.safeHook(() => this.onFailure?.(userId, 'invalid_code'));

    const userFailures = await this.store.recordUserFailure(userId, MFA_LIMITS.userWindowSec);
    if (userFailures === MFA_LIMITS.perUserMaxFailures) {
      // 한도에 정확히 닿은 요청만 잠그고 훅을 부른다(잠기는 순간 한 번).
      await this.store.lock(userId, MFA_LIMITS.lockSec);
      await this.safeHook(() => this.onLocked?.(userId));
      throw new MfaLockedError(MFA_LIMITS.lockSec);
    }
    if (userFailures > MFA_LIMITS.perUserMaxFailures) {
      // 이미 다른 요청이 잠갔다(또는 잠그는 중). 다시 잠그거나 훅을 부르지 않는다.
      const remaining = await this.store.lockedFor(userId);
      throw new MfaLockedError(remaining > 0 ? remaining : MFA_LIMITS.lockSec);
    }

    if (pendingJti !== undefined) {
      const pendingFailures = await this.store.recordPendingFailure(pendingJti, MFA_LIMITS.pendingTtlSec);
      if (pendingFailures >= MFA_LIMITS.perPendingMaxFailures) {
        await this.store.consumePending(pendingJti, MFA_LIMITS.pendingTtlSec);
        throw pendingExpired();
      }
    }

    throw invalidCode();
  }

  /** 잠겨 있으면 onFailure('locked') 후 MfaLockedError(남은 초). */
  private async assertNotLocked(userId: string): Promise<void> {
    const lockedFor = await this.store.lockedFor(userId);
    if (lockedFor > 0) {
      await this.safeHook(() => this.onFailure?.(userId, 'locked'));
      throw new MfaLockedError(lockedFor);
    }
  }

  /** 맞으면 증명 종류, 틀리거나 재사용이면 null. */
  private async verifyProof(record: UserMfaRecord, proof: MfaProof): Promise<ProofKind | null> {
    const p = proof as { code?: unknown; recoveryCode?: unknown };
    if (typeof p.code === 'string') {
      const secret = this.box.open(record.secretEnc);
      const step = verifyTotp(secret, p.code, { nowMs: this.now() });
      if (step === null) return null;
      return (await this.repo.markStepUsed(record.userId, step)) ? 'otp' : null;
    }
    if (typeof p.recoveryCode === 'string') {
      // 정규화하면 빈 문자열이 되는 입력은 빈 문자열의 해시와 비교되지 않도록 바로 거부한다.
      if (normalizeRecoveryCode(p.recoveryCode) === '') return null;
      const ok = await this.repo.consumeRecoveryCode(record.userId, hashRecoveryCode(p.recoveryCode));
      return ok ? 'rec' : null;
    }
    return null;
  }

  /** 훅 오류가 인증 흐름을 깨지 않도록 삼킨다. core 에는 로거가 없어 기록하지 않는다. */
  private async safeHook(fn: () => Promise<void> | undefined): Promise<void> {
    try {
      await fn();
    } catch {
      // 의도적으로 무시
    }
  }
}

/** 운영자 초기화 — MFA 설정과 사용자 실패·잠금을 지운다. */
export async function resetMfa(
  deps: { repository: MfaRepository; attemptStore: MfaAttemptStore },
  userId: string,
): Promise<void> {
  await deps.repository.disable(userId);
  await deps.attemptStore.clearUser(userId);
}
