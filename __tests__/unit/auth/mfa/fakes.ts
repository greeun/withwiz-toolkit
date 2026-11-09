import type { MfaRepository, UserMfaRecord } from '@withwiz/toolkit/core/auth/mfa/types';

interface StoredCode {
  hash: string;
  used: boolean;
}

/** 테스트용 MfaRepository — PrismaMfaRepository 와 같은 의미를 Map 으로 구현한다. */
export class InMemoryMfaRepository implements MfaRepository {
  readonly records = new Map<string, UserMfaRecord>();
  readonly codes = new Map<string, StoredCode[]>();

  async findByUserId(userId: string): Promise<UserMfaRecord | null> {
    const r = this.records.get(userId);
    return r ? { ...r } : null;
  }

  async savePendingSecret(userId: string, secretEnc: string): Promise<void> {
    this.records.set(userId, { userId, secretEnc, enabledAt: null, lastUsedStep: null });
    this.codes.delete(userId);
  }

  async enable(userId: string, recoveryCodeHashes: string[]): Promise<void> {
    const r = this.records.get(userId);
    if (!r) throw new Error('No pending MFA record');
    r.enabledAt = new Date();
    this.codes.set(userId, recoveryCodeHashes.map((hash) => ({ hash, used: false })));
  }

  async disable(userId: string): Promise<void> {
    this.records.delete(userId);
    this.codes.delete(userId);
  }

  async markStepUsed(userId: string, step: number): Promise<boolean> {
    const r = this.records.get(userId);
    if (!r) return false;
    if (r.lastUsedStep !== null && r.lastUsedStep >= step) return false;
    r.lastUsedStep = step;
    return true;
  }

  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const c = (this.codes.get(userId) ?? []).find((x) => x.hash === codeHash && !x.used);
    if (!c) return false;
    c.used = true;
    return true;
  }

  async replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void> {
    this.codes.set(userId, codeHashes.map((hash) => ({ hash, used: false })));
  }

  async countUnusedRecoveryCodes(userId: string): Promise<number> {
    return (this.codes.get(userId) ?? []).filter((c) => !c.used).length;
  }
}
