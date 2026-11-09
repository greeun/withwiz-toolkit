import {
  createCacheMfaAttemptStore,
  createInMemoryMfaAttemptStore,
  type MfaAttemptCache,
} from '@withwiz/toolkit/core/auth/mfa/attempt-store';
import type { MfaAttemptStore } from '@withwiz/toolkit/core/auth/mfa/types';
import { MFA_LIMITS } from '@withwiz/toolkit/core/auth/mfa/types';
import { fakeAtomicCache } from './fakes';

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
  ['캐시(원자 increment)', () => createCacheMfaAttemptStore(fakeAtomicCache(now), { now })],
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

  it('lock 은 새로 잠갔을 때만 true, 만료 뒤에는 다시 true', async () => {
    expect(await s.lock('u', 900)).toBe(true);
    expect(await s.lock('u', 900)).toBe(false);
    // 다시 잠가도 남은 시간은 처음 잠금 기준이다
    clock += 100_000;
    expect(await s.lockedFor('u')).toBe(800);
    clock += 800_000;
    expect(await s.lock('u', 900)).toBe(true);
    expect(await s.lockedFor('u')).toBe(900);
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

describe('캐시 저장소 — 원자 increment 경로', () => {
  beforeEach(() => {
    clock = 1_000_000;
  });

  it('병렬 실패도 모두 센다', async () => {
    const s = createCacheMfaAttemptStore(fakeAtomicCache(now), { now });
    const counts = await Promise.all(Array.from({ length: 30 }, () => s.recordUserFailure('u', 900)));
    expect([...counts].sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('첫 실패에서만 창 길이로 expire 한다', async () => {
    const cache = fakeAtomicCache(now);
    const s = createCacheMfaAttemptStore(cache, { now });
    await s.recordUserFailure('u', 900);
    await s.recordUserFailure('u', 900);
    await s.recordPendingFailure('j', 300);
    expect(cache.expireCalls).toEqual([
      ['mfa:user:fail:u', 900],
      ['mfa:pending:fail:j', 300],
    ]);
  });

  it('병렬 lock 은 한 번만 true', async () => {
    const s = createCacheMfaAttemptStore(fakeAtomicCache(now), { now });
    const created = await Promise.all(Array.from({ length: 10 }, () => s.lock('u', 900)));
    expect(created.filter(Boolean)).toHaveLength(1);
  });

  it.each([0, -1])('increment 가 %s(오류 센티널)를 돌려주면 실패로 막는다', async (r) => {
    const s = createCacheMfaAttemptStore(fakeAtomicCache(now, { incrementResult: r }), { now });
    await expect(s.recordUserFailure('u', 900)).rejects.toThrow();
    await expect(s.recordPendingFailure('j', 300)).rejects.toThrow();
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

describe('인메모리 저장소 만료 정리', () => {
  it('쓰기가 쌓이면 만료된 항목을 모든 맵에서 제거한다', async () => {
    clock = 1_000_000;
    const s = createInMemoryMfaAttemptStore({ now });
    for (let i = 0; i < 40; i++) {
      await s.consumePending(`j${i}`, 300);
      await s.recordPendingFailure(`f${i}`, 300);
      await s.recordUserFailure(`u${i}`, 900);
    }
    await s.lock('locked', 300);
    expect(s.size()).toBe(121);
    clock += 1_000_000; // 모두 만료
    for (let i = 0; i < 100; i++) await s.consumePending(`new${i}`, 300);
    // 정리 뒤에는 만료 항목이 사라지고 새 항목만 남는다
    expect(s.size()).toBeLessThanOrEqual(100);
  });
});
