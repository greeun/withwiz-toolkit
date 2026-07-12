/**
 * Pluggable Password Hashing
 *
 * `IPasswordHasher` 추상화로 해시 백엔드를 교체 가능하게 한다.
 * - `BcryptPasswordHasher`: 기본(bcryptjs). 하드 의존성.
 * - `Argon2idPasswordHasher`: argon2id. `argon2` 패키지를 지연 import 하는
 *   optional 의존성 — 설치되지 않으면 verify/hash 호출 시 명확한 에러를 던진다.
 * - `MigratingPasswordHasher`: preferred + legacy 해셔를 조합해 레거시 해시를
 *   검증하고(scrypt→bcrypt 등) rehash 대상 여부를 판정한다 (rehash-on-login).
 *
 * rehash-on-login 흐름: 로그인 시 verify() 성공 후 needsRehash(storedHash) 가
 * true 면 preferred 스킴으로 다시 해싱해 저장한다. 평문은 로그인 시점에만
 * 존재하므로 이 시점이 무중단 마이그레이션의 유일한 기회다.
 */

import bcrypt from 'bcryptjs';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';

// ============================================================================
// Interface
// ============================================================================

export interface IPasswordHasher {
  /** 스킴 식별자 (예: 'bcrypt', 'argon2id'). 로깅/디버깅용. */
  readonly id: string;

  /** 이 해셔가 인식하는 해시 포맷인지 판정 (verify 위임 라우팅에 사용). */
  identifies(hash: string): boolean;

  /** 평문을 이 해셔의 스킴으로 해싱. */
  hash(password: string): Promise<string>;

  /** 평문과 해시 비교. */
  verify(password: string, hash: string): Promise<boolean>;

  /**
   * 이 해시를 다시 해싱해야 하는지 판정한다.
   * - 다른 스킴이거나(스킴 마이그레이션)
   * - 같은 스킴이지만 파라미터가 현재 설정보다 약하면 true.
   */
  needsRehash(hash: string): boolean;
}

// ============================================================================
// Bcrypt
// ============================================================================

const BCRYPT_PREFIX = /^\$2[aby]\$/;

export interface BcryptHasherOptions {
  /** bcrypt cost factor. 기본 12. */
  rounds?: number;
}

export class BcryptPasswordHasher implements IPasswordHasher {
  readonly id = 'bcrypt';
  private rounds: number;

  constructor(options: BcryptHasherOptions = {}) {
    this.rounds = options.rounds ?? 12;
  }

  identifies(hash: string): boolean {
    return BCRYPT_PREFIX.test(hash);
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  needsRehash(hash: string): boolean {
    if (!this.identifies(hash)) return true;
    // 포맷: $2b$<cost>$<22 salt><31 hash>
    const cost = Number.parseInt(hash.split('$')[2] ?? '', 10);
    if (Number.isNaN(cost)) return true;
    return cost < this.rounds;
  }
}

// ============================================================================
// Argon2id (optional dependency)
// ============================================================================

const ARGON2_PREFIX = /^\$argon2(id|i|d)\$/;

export interface Argon2idHasherOptions {
  /** 메모리 비용 (KiB). 기본 19456 (= 19 MiB, OWASP 권장 하한). */
  memoryCost?: number;
  /** 반복 횟수. 기본 2. */
  timeCost?: number;
  /** 병렬성. 기본 1. */
  parallelism?: number;
}

type Argon2Module = {
  hash(password: string, options?: Record<string, unknown>): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  argon2id: number;
};

let argon2Cache: Argon2Module | undefined;

async function loadArgon2(): Promise<Argon2Module> {
  if (argon2Cache) return argon2Cache;
  try {
    // optional peer dependency — 설치된 경우에만 로드된다.
    // @ts-ignore 'argon2' 는 optional 의존성이라 타입/모듈이 없을 수 있다 (설치 환경에서는 지시어가 불필요해도 유효해야 함).
    const mod = (await import('argon2')) as unknown as { default?: Argon2Module } & Argon2Module;
    argon2Cache = (mod.default ?? mod) as Argon2Module;
    return argon2Cache;
  } catch {
    throw new AuthError(
      'argon2 package is not installed. Run `npm install argon2` to use Argon2idPasswordHasher.',
      'ARGON2_NOT_INSTALLED',
      500,
    );
  }
}

/** 테스트 전용: 지연 로드된 argon2 모듈 캐시를 초기화한다. */
export function __resetArgon2Cache(): void {
  argon2Cache = undefined;
}

/** argon2 인코딩 문자열에서 m/t/p 파라미터를 파싱한다 (모듈 없이 동작). */
function parseArgon2Params(hash: string): { m: number; t: number; p: number } | null {
  // 포맷: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
  const paramSegment = hash.split('$').find((s) => s.startsWith('m='));
  if (!paramSegment) return null;
  const params: Record<string, number> = {};
  for (const kv of paramSegment.split(',')) {
    const [k, v] = kv.split('=');
    const n = Number.parseInt(v ?? '', 10);
    if (!Number.isNaN(n)) params[k] = n;
  }
  if (params.m === undefined || params.t === undefined || params.p === undefined) return null;
  return { m: params.m, t: params.t, p: params.p };
}

export class Argon2idPasswordHasher implements IPasswordHasher {
  readonly id = 'argon2id';
  private memoryCost: number;
  private timeCost: number;
  private parallelism: number;

  constructor(options: Argon2idHasherOptions = {}) {
    this.memoryCost = options.memoryCost ?? 19456;
    this.timeCost = options.timeCost ?? 2;
    this.parallelism = options.parallelism ?? 1;
  }

  identifies(hash: string): boolean {
    return ARGON2_PREFIX.test(hash);
  }

  async hash(password: string): Promise<string> {
    const argon2 = await loadArgon2();
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
      parallelism: this.parallelism,
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const argon2 = await loadArgon2();
    return argon2.verify(hash, password);
  }

  needsRehash(hash: string): boolean {
    if (!this.identifies(hash)) return true;
    const params = parseArgon2Params(hash);
    if (!params) return true;
    // 현재 설정보다 약한 파라미터면 재해시.
    return params.m < this.memoryCost || params.t < this.timeCost || params.p < this.parallelism;
  }
}

// ============================================================================
// Migrating (composite for rehash-on-login)
// ============================================================================

export interface MigratingHasherOptions {
  /** 신규 해시 및 rehash 대상 스킴. */
  preferred: IPasswordHasher;
  /**
   * 검증만 지원하는 레거시 해셔들 (예: 소비자가 구현한 scrypt 어댑터).
   * verify 시 preferred 다음 순서로 매칭을 시도한다.
   */
  legacy?: IPasswordHasher[];
}

export class MigratingPasswordHasher implements IPasswordHasher {
  private preferred: IPasswordHasher;
  private legacy: IPasswordHasher[];

  constructor(options: MigratingHasherOptions) {
    this.preferred = options.preferred;
    this.legacy = options.legacy ?? [];
  }

  get id(): string {
    return this.preferred.id;
  }

  identifies(hash: string): boolean {
    return [this.preferred, ...this.legacy].some((h) => h.identifies(hash));
  }

  async hash(password: string): Promise<string> {
    return this.preferred.hash(password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const hasher = [this.preferred, ...this.legacy].find((h) => h.identifies(hash));
    if (!hasher) return false;
    return hasher.verify(password, hash);
  }

  needsRehash(hash: string): boolean {
    // 다른(레거시) 스킴이면 preferred 가 인식하지 못하므로 true.
    if (!this.preferred.identifies(hash)) return true;
    return this.preferred.needsRehash(hash);
  }
}
