/**
 * MFA 시도 저장소 구현 — 캐시 기반과 인메모리.
 *
 * 캐시 구현은 core/cache 를 재사용하도록 최소 형태(MfaAttemptCache)만 요구하며
 * cache 는 주입받는다(DI). ttl 은 초 단위(cache-token-stores 와 같은 규약).
 * 캐시 TTL 만으로는 남은 시간을 알 수 없어, 만료 시각을 값에 함께 저장하고
 * 주입된 now()(ms) 로 남은 초와 고정 창을 계산한다. 저장 값은 JSON 직렬화 가능하다.
 */
import type { MfaAttemptStore } from '@withwiz/toolkit/core/auth/mfa/types';

/** 저장소가 요구하는 최소 cache 형태 — IUnifiedCacheManager 의 부분집합. ttl 은 초. */
export interface MfaAttemptCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** (선택) 키가 없을 때만 저장하는 원자 연산. 저장했으면 true. */
  setIfNotExists?<T>(key: string, value: T, ttl?: number): Promise<boolean>;
}

export interface MfaAttemptStoreOptions {
  /** 키 프리픽스. 기본 'mfa:' */
  prefix?: string;
  /** 현재 시각(ms). 테스트용 주입. 기본 Date.now */
  now?: () => number;
}

interface CountRecord {
  count: number;
  /** 만료 시각(ms) — 첫 실패 시점에 고정 */
  expiresAt: number;
}

interface LockRecord {
  until: number;
}

/** ttl(초)을 최소 1초 정수로 올린다 — 0/음수 TTL 로 즉시 만료되는 것을 방지. */
const ceilTtl = (ms: number): number => Math.max(1, Math.ceil(ms / 1000));

/**
 * 캐시 기반 구현.
 *
 * 주의: 실패 횟수는 get→set 이라 원자적이지 않다. 동시 요청이 겹치면 일부 실패가
 * 덜 집계될 수 있다(여러 인스턴스 사이에서 특히). 대기 토큰 소비(consumePending)는
 * cache.setIfNotExists 가 있으면 그 원자 연산을 쓰고, 없으면 get→set 으로 대체한다.
 */
export function createCacheMfaAttemptStore(
  cache: MfaAttemptCache,
  opts: MfaAttemptStoreOptions = {},
): MfaAttemptStore {
  const prefix = opts.prefix ?? 'mfa:';
  const now = opts.now ?? Date.now;
  const consumedKey = (jti: string) => `${prefix}pending:used:${jti}`;
  const pendingFailKey = (jti: string) => `${prefix}pending:fail:${jti}`;
  const userFailKey = (id: string) => `${prefix}user:fail:${id}`;
  const lockKey = (id: string) => `${prefix}user:lock:${id}`;

  /** 만료 시각이 고정된 카운터를 1 올린다. */
  const bump = async (key: string, windowSec: number): Promise<number> => {
    const t = now();
    const cur = await cache.get<CountRecord>(key);
    if (cur && cur.expiresAt > t) {
      const next: CountRecord = { count: cur.count + 1, expiresAt: cur.expiresAt };
      await cache.set(key, next, ceilTtl(cur.expiresAt - t));
      return next.count;
    }
    const fresh: CountRecord = { count: 1, expiresAt: t + windowSec * 1000 };
    await cache.set(key, fresh, Math.max(1, Math.ceil(windowSec)));
    return 1;
  };

  return {
    async consumePending(jti, ttlSec) {
      const key = consumedKey(jti);
      const ttl = Math.max(1, Math.ceil(ttlSec));
      if (typeof cache.setIfNotExists === 'function') {
        return cache.setIfNotExists(key, 1, ttl);
      }
      if ((await cache.get(key)) !== null) return false;
      await cache.set(key, 1, ttl);
      return true;
    },
    async isPendingConsumed(jti) {
      return (await cache.get(consumedKey(jti))) !== null;
    },
    recordPendingFailure: (jti, ttlSec) => bump(pendingFailKey(jti), ttlSec),
    recordUserFailure: (userId, windowSec) => bump(userFailKey(userId), windowSec),
    async lock(userId, ttlSec) {
      const rec: LockRecord = { until: now() + ttlSec * 1000 };
      await cache.set(lockKey(userId), rec, Math.max(1, Math.ceil(ttlSec)));
    },
    async lockedFor(userId) {
      const rec = await cache.get<LockRecord>(lockKey(userId));
      if (!rec) return 0;
      const remaining = rec.until - now();
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    },
    async clearUser(userId) {
      await cache.delete(userFailKey(userId));
      await cache.delete(lockKey(userId));
    },
  };
}

/** 인메모리 구현 — Map + 만료 시각, 외부 의존 없음. 단일 프로세스 한정. */
export function createInMemoryMfaAttemptStore(
  opts: Pick<MfaAttemptStoreOptions, 'now'> = {},
): MfaAttemptStore {
  const now = opts.now ?? Date.now;
  const consumed = new Map<string, number>();
  const pendingFails = new Map<string, CountRecord>();
  const userFails = new Map<string, CountRecord>();
  const locks = new Map<string, number>();

  const bump = (m: Map<string, CountRecord>, key: string, windowSec: number): number => {
    const t = now();
    const cur = m.get(key);
    if (cur && cur.expiresAt > t) {
      cur.count += 1;
      return cur.count;
    }
    m.set(key, { count: 1, expiresAt: t + windowSec * 1000 });
    return 1;
  };

  const isConsumed = (jti: string): boolean => {
    const exp = consumed.get(jti);
    if (exp === undefined) return false;
    if (exp <= now()) {
      consumed.delete(jti);
      return false;
    }
    return true;
  };

  return {
    async consumePending(jti, ttlSec) {
      if (isConsumed(jti)) return false;
      consumed.set(jti, now() + ttlSec * 1000);
      return true;
    },
    async isPendingConsumed(jti) {
      return isConsumed(jti);
    },
    async recordPendingFailure(jti, ttlSec) {
      return bump(pendingFails, jti, ttlSec);
    },
    async recordUserFailure(userId, windowSec) {
      return bump(userFails, userId, windowSec);
    },
    async lock(userId, ttlSec) {
      locks.set(userId, now() + ttlSec * 1000);
    },
    async lockedFor(userId) {
      const until = locks.get(userId);
      if (until === undefined) return 0;
      const remaining = until - now();
      if (remaining <= 0) {
        locks.delete(userId);
        return 0;
      }
      return Math.ceil(remaining / 1000);
    },
    async clearUser(userId) {
      userFails.delete(userId);
      locks.delete(userId);
    },
  };
}
