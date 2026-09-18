/**
 * Cache 기반 토큰 store 기본 구현 (배터리 포함).
 *
 * toolkit 은 revoke/rotation 의 인터페이스만 제공하고 저장소 구현은 소비자
 * 몫이다. core/cache(redis/inmemory/hybrid)를 재사용해 거의 0코드로 켤 수 있는
 * 기본 구현을 여기서 제공한다.
 *
 * - createCacheBlacklistChecker: access revoke (isAccessTokenRevoked/revokeAccessToken)
 * - createCacheRefreshTokenStore: refresh 회전/재사용탐지/family revoke
 *
 * 서버(node) 전용 — cache 백엔드가 node 런타임을 가정하므로 엣지에서 쓰지 말 것.
 * cache 는 주입받으며(DI), 이 모듈은 node:crypto + 타입 외에는 의존하지 않는다.
 * 원문 토큰을 키로 저장하지 않는다(sha256 식별자 사용).
 */
import { createHash } from 'node:crypto';
import type {
  IRefreshTokenStore,
  RefreshTokenRecord,
} from '@withwiz/toolkit/core/auth/services/refresh-token-store';

/**
 * store 가 요구하는 최소 cache 형태 — IUnifiedCacheManager 의 부분집합.
 * ttl 은 초 단위. (InMemoryCacheManager/HybridCacheManager 등이 그대로 만족)
 */
export interface TokenStoreCache {
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /**
   * (선택) 키가 없을 때만 저장하는 원자 연산. 저장했으면 true, 이미 있으면 false.
   * 제공하면 refresh store 의 markUsedIfUnused 가 이 연산을 사용하므로 여러 서버
   * 인스턴스 사이에서도 동시 회전을 막는다 (예: Redis `SET key value NX EX ttl`).
   * 없으면 store 인스턴스 안에서 같은 키의 확인·기록을 직렬화한다(단일 프로세스 한정).
   */
  setIfNotExists?<T>(key: string, value: T, ttl?: number): Promise<boolean>;
}

/**
 * next/middleware 의 IAccessTokenBlacklistChecker 와 구조적으로 호환한다
 * (isAccessTokenRevoked). setAccessTokenBlacklistChecker(store) 로 주입 가능.
 */
export interface CacheAccessTokenBlacklist {
  /** 이 access 토큰이 revoke 되었는지 여부. */
  isAccessTokenRevoked(token: string): Promise<boolean>;
  /** access 토큰 revoke — 남은 만료까지의 TTL(초). */
  revokeAccessToken(token: string, ttlSec: number): Promise<void>;
}

export interface CacheBlacklistOptions {
  /** 키 네임스페이스 프리픽스. 기본 'revoked:at:' */
  prefix?: string;
  /** 토큰 → 키 식별자 변형. 기본 sha256 hex (원문 키 저장 지양). */
  deriveId?: (token: string) => string;
}

const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** ttl(초) 을 최소 1초 정수로 정규화 — 0/음수 TTL 로 즉시 만료되는 것을 방지. */
const normalizeTtl = (ttlSec: number, fallback: number): number => {
  const s = Math.floor(ttlSec);
  return s > 0 ? s : fallback;
};

/**
 * access 토큰 blacklist(revoke) 를 cache 로 구현.
 * 키: `${prefix}${sha256(token)}` = 1, TTL = 토큰 잔여 만료.
 */
export function createCacheBlacklistChecker(
  cache: TokenStoreCache,
  opts: CacheBlacklistOptions = {},
): CacheAccessTokenBlacklist {
  const prefix = opts.prefix ?? 'revoked:at:';
  const deriveId = opts.deriveId ?? sha256Hex;
  const keyFor = (token: string): string => `${prefix}${deriveId(token)}`;

  return {
    async revokeAccessToken(token, ttlSec) {
      await cache.set(keyFor(token), 1, normalizeTtl(ttlSec, 1));
    },
    async isAccessTokenRevoked(token) {
      return cache.exists(keyFor(token));
    },
  };
}

export interface CacheRefreshStoreOptions {
  /** used jti 키 프리픽스. 기본 'rt:used:' */
  usedPrefix?: string;
  /** family revoke 키 프리픽스. 기본 'rt:famrevoked:' */
  familyPrefix?: string;
  /** meta.expiresAt 이 없을 때 사용할 기본 TTL(초). 기본 30d. */
  defaultTtlSec?: number;
}

const THIRTY_DAYS_SEC = 30 * 86400;

const noop = (): void => {};

/**
 * refresh 토큰 store(회전/재사용탐지/family revoke)를 cache 로 구현.
 * 키: used=`${usedPrefix}${jti}`, family=`${familyPrefix}${familyId}`.
 * TTL 은 meta.expiresAt 잔여시간에 정렬(없으면 defaultTtlSec).
 *
 * markUsedIfUnused(동시 회전 차단):
 * - cache.setIfNotExists 가 있으면 그 원자 연산을 사용한다 (프로세스 간 보장).
 * - 없으면 이 store 인스턴스 안에서 같은 jti 의 exists→set 을 직렬화한다.
 *   단일 프로세스 안의 동시 요청은 막지만, 여러 서버 인스턴스가 캐시를 공유하는
 *   배포에서는 setIfNotExists 를 제공하는 cache 를 주입해야 한다.
 */
export function createCacheRefreshTokenStore(
  cache: TokenStoreCache,
  opts: CacheRefreshStoreOptions = {},
): IRefreshTokenStore {
  const usedPrefix = opts.usedPrefix ?? 'rt:used:';
  const familyPrefix = opts.familyPrefix ?? 'rt:famrevoked:';
  const defaultTtl = opts.defaultTtlSec ?? THIRTY_DAYS_SEC;

  const ttlFrom = (expiresAt?: Date): number => {
    if (!expiresAt) return defaultTtl;
    return normalizeTtl((expiresAt.getTime() - Date.now()) / 1000, defaultTtl);
  };

  // 원자 연산이 없는 cache 용: 키별로 직전 확인·기록이 끝난 뒤 다음 확인을 시작한다.
  const pendingClaims = new Map<string, Promise<void>>();
  const claimSerially = (key: string, ttl: number): Promise<boolean> => {
    const previous = pendingClaims.get(key) ?? Promise.resolve();
    const claim = previous.then(async () => {
      if (await cache.exists(key)) return false;
      await cache.set(key, 1, ttl);
      return true;
    });
    const settled = claim.then(noop, noop);
    pendingClaims.set(key, settled);
    void settled.then(() => {
      if (pendingClaims.get(key) === settled) pendingClaims.delete(key);
    });
    return claim;
  };

  return {
    async isUsed(jti) {
      return cache.exists(`${usedPrefix}${jti}`);
    },
    async markUsed(jti, meta) {
      await cache.set(`${usedPrefix}${jti}`, 1, ttlFrom(meta?.expiresAt));
    },
    async markUsedIfUnused(jti, meta) {
      const key = `${usedPrefix}${jti}`;
      const ttl = ttlFrom(meta?.expiresAt);
      if (typeof cache.setIfNotExists === 'function') {
        return cache.setIfNotExists(key, 1, ttl);
      }
      return claimSerially(key, ttl);
    },
    async isFamilyRevoked(familyId) {
      return cache.exists(`${familyPrefix}${familyId}`);
    },
    async revokeFamily(familyId) {
      await cache.set(`${familyPrefix}${familyId}`, 1, defaultTtl);
    },
    async register(record: RefreshTokenRecord) {
      // 감사/TTL 목적의 선택 훅 — 발급 기록. used 표시와 키공간 분리.
      await cache.set(
        `${usedPrefix}issued:${record.jti}`,
        { familyId: record.familyId, userId: record.userId },
        ttlFrom(record.expiresAt),
      );
    },
  };
}
