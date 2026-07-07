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

/**
 * refresh 토큰 store(회전/재사용탐지/family revoke)를 cache 로 구현.
 * 키: used=`${usedPrefix}${jti}`, family=`${familyPrefix}${familyId}`.
 * TTL 은 meta.expiresAt 잔여시간에 정렬(없으면 defaultTtlSec).
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

  return {
    async isUsed(jti) {
      return cache.exists(`${usedPrefix}${jti}`);
    },
    async markUsed(jti, meta) {
      await cache.set(`${usedPrefix}${jti}`, 1, ttlFrom(meta?.expiresAt));
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
