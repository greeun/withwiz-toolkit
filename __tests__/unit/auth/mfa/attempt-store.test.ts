import {
  createCacheMfaAttemptStore,
  createInMemoryMfaAttemptStore,
  type MfaAttemptCache,
} from '@withwiz/toolkit/core/auth/mfa/attempt-store';
import type { MfaAttemptStore } from '@withwiz/toolkit/core/auth/mfa/types';
import { MFA_LIMITS } from '@withwiz/toolkit/core/auth/mfa/types';

/** Map 기반 가짜 캐시 — TTL(초)을 가짜 시계 기준으로 적용한다. */
function fakeCache(now: () => number, withSetIfNotExists = true): MfaAttemptCache {
  const m = new Map<string, { v: string; exp: number | null }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (!e) return undefined;
    if (e.exp !== null && e.exp <= now()) {
      m.delete(k);
      return undefined;
    }
    return e;
  };
  const cache: MfaAttemptCache = {
    async get<T>(k: string) {
      const e = live(k);
      return e ? (JSON.parse(e.v) as T) : null;
    },
    async set<T>(k: string, v: T, ttl?: number) {
      m.set(k, { v: JSON.stringify(v), exp: ttl ? now() + ttl * 1000 : null });
    },
    async delete(k: string) {
      m.delete(k);
    },
  };
  if (withSetIfNotExists) {
    cache.setIfNotExists = async <T>(k: string, v: T, ttl?: number) => {
      if (live(k)) return false;
      await cache.set(k, v, ttl);
      return true;
    };
  }
  return cache;
}

let clock = 0;
const now = () => clock;

describe.each([
  ['인메모리', () => createInMemoryMfaAttemptStore({ now })],
  ['캐시', () => createCacheMfaAttemptStore(fakeCache(now), { now })],
  ['캐시(setIfNotExists 없음)', () => createCacheMfaAttemptStore(fakeCache(now, false), { now })],
])('MfaAttemptStore - %s', (_name, make) => {
  let s: MfaAttemptStore;
  beforeEach(() => {
    clock = 1_000_000;
    s = make();
  });

  it('consumePending 은 한 번만 true', async () => {
    expect(await s.isPendingConsumed('j')).toBe(false);
    expect(await s.consumePending('j', 300)).toBe(true);
    expect(await s.consumePending('j', 300)).toBe(false);
    expect(await s.isPendingConsumed('j')).toBe(true);
  });

  it('consumePending 기록은 TTL 이 지나면 사라진다', async () => {
    await s.consumePending('j', 300);
    clock += 301_000;
    expect(await s.isPendingConsumed('j')).toBe(false);
  });

  it('사용자 실패 창은 첫 실패부터 900초', async () => {
    expect(await s.recordUserFailure('u', 900)).toBe(1);
    clock += 899_000;
    expect(await s.recordUserFailure('u', 900)).toBe(2);
    clock += 2_000;
    expect(await s.recordUserFailure('u', 900)).toBe(1);
  });

  it('lock 과 남은 초, clearUser', async () => {
    expect(await s.lockedFor('u')).toBe(0);
    await s.lock('u', 900);
    clock += 100_000;
    expect(await s.lockedFor('u')).toBe(800);
    await s.clearUser('u');
    expect(await s.lockedFor('u')).toBe(0);
  });

  it('잠금은 만료되면 0', async () => {
    await s.lock('u', 900);
    clock += 900_000;
    expect(await s.lockedFor('u')).toBe(0);
  });

  it('clearUser 는 실패 횟수도 지운다', async () => {
    await s.recordUserFailure('u', 900);
    await s.clearUser('u');
    expect(await s.recordUserFailure('u', 900)).toBe(1);
  });

  it('대기 토큰별 실패 횟수', async () => {
    expect(await s.recordPendingFailure('j', 300)).toBe(1);
    expect(await s.recordPendingFailure('j', 300)).toBe(2);
    expect(await s.recordPendingFailure('k', 300)).toBe(1);
  });
});

describe('MFA_LIMITS', () => {
  it('값', () => {
    expect(MFA_LIMITS).toEqual({
      pendingTtlSec: 300,
      perPendingMaxFailures: 5,
      perUserMaxFailures: 10,
      userWindowSec: 900,
      lockSec: 900,
    });
  });
});
