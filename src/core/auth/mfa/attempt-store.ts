/**
 * MFA 시도 저장소 구현 — 캐시 기반과 인메모리.
 *
 * 캐시 구현은 core/cache 를 재사용하도록 최소 형태(MfaAttemptCache)만 요구하며
 * cache 는 주입받는다(DI). ttl 은 초 단위(cache-token-stores 와 같은 규약).
 * 잠금은 캐시 TTL 만으로는 남은 시간을 알 수 없어, 만료 시각을 값에 함께 저장하고
 * 주입된 now()(ms) 로 남은 초를 계산한다. 저장 값은 JSON 직렬화 가능하다.
 */
import type { MfaAttemptStore } from '@withwiz/toolkit/core/auth/mfa/types';

/** 저장소가 요구하는 최소 cache 형태 — IUnifiedCacheManager 의 부분집합. ttl 은 초. */
export interface MfaAttemptCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** (선택) 키가 없을 때만 저장하는 원자 연산. 저장했으면 true. */
  setIfNotExists?<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  /**
   * (선택) 숫자 값을 원자적으로 더하고 결과를 돌려준다(Redis INCRBY). 키가 없으면 0 에서 시작한다.
   * toolkit 캐시 매니저는 오류 때 0 을 돌려주므로, 1 미만의 결과는 오류로 본다.
   * expire 와 함께 있어야 쓰인다.
   */
  increment?(key: string, value?: number): Promise<number>;
  /** (선택) 키의 TTL(초)을 지정한다. increment 와 함께 있어야 쓰인다. */
  expire?(key: string, ttl: number): Promise<void>;
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
 * - 실패 횟수: cache.increment·expire 가 있으면 원자 증가를 쓰고, 첫 실패(결과 1)에서
 *   창 길이로 expire 해 창을 첫 실패부터 고정한다. 결과가 1 미만이면 캐시 오류로 보고
 *   예외를 던진다(실패를 세지 못한 채 통과시키지 않는다). 둘 중 하나라도 없으면
 *   get→set 으로 대체하는데, 이 경로는 원자적이지 않아 동시 요청이 겹치면 실패가
 *   덜 집계되고 한도·잠금이 사실상 무력해질 수 있다. 여러 인스턴스 배포에서는
 *   increment·expire·setIfNotExists 를 갖춘 캐시(toolkit Redis·Hybrid 매니저)를 주입한다.
 * - 대기 토큰 소비(consumePending)와 잠금(lock)은 cache.setIfNotExists 가 있으면 그 원자
 *   연산을 쓰고, 없으면 get→set 으로 대체한다(원자적이지 않음).
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

  const increment = cache.increment?.bind(cache);
  const expire = cache.expire?.bind(cache);

  /** 만료 시각이 고정된 카운터를 1 올린다. */
  const bump = async (key: string, windowSec: number): Promise<number> => {
    if (increment && expire) {
      const n = await increment(key, 1);
      if (!(n >= 1)) {
        throw new Error(`MFA attempt counter unavailable (increment returned ${n})`);
      }
      // 첫 실패에서만 창을 연다 — 이후 증가는 TTL 을 유지하므로 창이 첫 실패부터 고정된다.
      if (n === 1) await expire(key, Math.max(1, Math.ceil(windowSec)));
      return n;
    }
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
      const key = lockKey(userId);
      const rec: LockRecord = { until: now() + ttlSec * 1000 };
      const ttl = Math.max(1, Math.ceil(ttlSec));
      if (typeof cache.setIfNotExists === 'function') {
        return cache.setIfNotExists(key, rec, ttl);
      }
      const cur = await cache.get<LockRecord>(key);
      if (cur && cur.until > now()) return false;
      await cache.set(key, rec, ttl);
      return true;
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

/** 인메모리 구현 + 현재 보관 중인 항목 수(만료 정리 확인용). */
export type InMemoryMfaAttemptStore = MfaAttemptStore & { size(): number };

/** 쓰기 N 회마다 만료 항목을 정리한다. */
const SWEEP_EVERY_WRITES = 100;

/**
 * 인메모리 구현 — Map + 만료 시각, 외부 의존 없음.
 *
 * 단일 프로세스 전용이다: 서버 인스턴스가 여러 개인 운영 배포에서는 인스턴스끼리
 * 상태가 공유되지 않으므로 공유 캐시 기반 구현(createCacheMfaAttemptStore)을 써야 한다.
 * 쓰기 100회마다 모든 맵에서 만료 항목을 정리해 장기 실행 프로세스에서도 메모리가 늘지 않는다.
 */
export function createInMemoryMfaAttemptStore(
  opts: Pick<MfaAttemptStoreOptions, 'now'> = {},
): InMemoryMfaAttemptStore {
  const now = opts.now ?? Date.now;
  const consumed = new Map<string, number>();
  const pendingFails = new Map<string, CountRecord>();
  const userFails = new Map<string, CountRecord>();
  const locks = new Map<string, number>();

  let writes = 0;
  const sweepIfDue = (): void => {
    if (++writes % SWEEP_EVERY_WRITES !== 0) return;
    const t = now();
    for (const m of [pendingFails, userFails]) {
      for (const [k, v] of m) if (v.expiresAt <= t) m.delete(k);
    }
    for (const m of [consumed, locks]) {
      for (const [k, exp] of m) if (exp <= t) m.delete(k);
    }
  };

  const bump = (m: Map<string, CountRecord>, key: string, windowSec: number): number => {
    sweepIfDue();
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
    size: () => consumed.size + pendingFails.size + userFails.size + locks.size,
    async consumePending(jti, ttlSec) {
      sweepIfDue();
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
      sweepIfDue();
      const t = now();
      const cur = locks.get(userId);
      if (cur !== undefined && cur > t) return false;
      locks.set(userId, t + ttlSec * 1000);
      return true;
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
