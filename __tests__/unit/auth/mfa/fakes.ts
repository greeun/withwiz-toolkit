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

/**
 * 원자 연산(increment·expire·setIfNotExists)을 갖춘 가짜 캐시 — Redis 처럼 동작한다.
 * TTL(초)은 주입한 시계 기준이고, increment 는 기존 TTL 을 유지한다(INCRBY 와 같음).
 * `incrementResult` 를 지정하면 increment 가 그 값을 돌려준다(오류 센티널 재현용).
 */
export function fakeAtomicCache(now: () => number, opts: { incrementResult?: number } = {}) {
  const m = new Map<string, { v: unknown; exp: number | null }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (!e) return undefined;
    if (e.exp !== null && e.exp <= now()) {
      m.delete(k);
      return undefined;
    }
    return e;
  };
  const expireCalls: Array<[string, number]> = [];
  return {
    store: m,
    expireCalls,
    peek: (k: string) => live(k)?.v,
    async get<T>(k: string): Promise<T | null> {
      const e = live(k);
      return e ? (structuredClone(e.v) as T) : null;
    },
    async set<T>(k: string, v: T, ttl?: number): Promise<void> {
      m.set(k, { v: structuredClone(v), exp: ttl ? now() + ttl * 1000 : null });
    },
    async delete(k: string): Promise<void> {
      m.delete(k);
    },
    async setIfNotExists<T>(k: string, v: T, ttl?: number): Promise<boolean> {
      if (live(k)) return false;
      m.set(k, { v: structuredClone(v), exp: ttl ? now() + ttl * 1000 : null });
      return true;
    },
    async increment(k: string, by = 1): Promise<number> {
      if (opts.incrementResult !== undefined) return opts.incrementResult;
      const e = live(k);
      const next = (typeof e?.v === 'number' ? e.v : 0) + by;
      m.set(k, { v: next, exp: e ? e.exp : null });
      return next;
    },
    async expire(k: string, ttlSec: number): Promise<void> {
      expireCalls.push([k, ttlSec]);
      const e = live(k);
      if (e) e.exp = now() + ttlSec * 1000;
    },
  };
}
