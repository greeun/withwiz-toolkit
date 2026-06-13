/**
 * Pluggable Password Hasher tests
 *
 * Test Scope:
 * - BcryptPasswordHasher: hash/verify roundtrip, identifies, needsRehash (cost)
 * - Argon2idPasswordHasher: identifies, needsRehash (param parsing, no module),
 *   ARGON2_NOT_INSTALLED error when optional dep absent
 * - MigratingPasswordHasher: verify routing, cross-scheme needsRehash (rehash-on-login)
 */

import {
  BcryptPasswordHasher,
  Argon2idPasswordHasher,
  MigratingPasswordHasher,
  __resetArgon2Cache,
  type IPasswordHasher,
} from '@withwiz/toolkit/core/auth/password/hasher';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';

// 정적 argon2id 인코딩 문자열 (모듈 없이 파싱 검증용)
const ARGON2_HASH_STRONG = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzYWx0$qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
const ARGON2_HASH_WEAK = '$argon2id$v=19$m=4096,t=1,p=1$c29tZXNhbHRzYWx0$qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher({ rounds: 10 });

  it('hashes and verifies a password roundtrip', async () => {
    const hash = await hasher.hash('password123');
    expect(hasher.identifies(hash)).toBe(true);
    expect(await hasher.verify('password123', hash)).toBe(true);
    expect(await hasher.verify('wrong', hash)).toBe(false);
  });

  it('does not identify a non-bcrypt hash', () => {
    expect(hasher.identifies(ARGON2_HASH_STRONG)).toBe(false);
    expect(hasher.identifies('plaintext')).toBe(false);
  });

  it('needsRehash is true for a non-bcrypt hash (scheme migration)', () => {
    expect(hasher.needsRehash(ARGON2_HASH_STRONG)).toBe(true);
  });

  it('needsRehash is true when stored cost is lower than configured rounds', async () => {
    const weak = await new BcryptPasswordHasher({ rounds: 4 }).hash('password123');
    expect(hasher.needsRehash(weak)).toBe(true); // configured rounds=10 > stored cost=4
  });

  it('needsRehash is false when stored cost matches configured rounds', async () => {
    const same = await hasher.hash('password123');
    expect(hasher.needsRehash(same)).toBe(false);
  });
});

describe('Argon2idPasswordHasher', () => {
  beforeEach(() => __resetArgon2Cache());

  const hasher = new Argon2idPasswordHasher({ memoryCost: 19456, timeCost: 2, parallelism: 1 });

  it('identifies argon2 hashes only', () => {
    expect(hasher.identifies(ARGON2_HASH_STRONG)).toBe(true);
    expect(hasher.identifies('$2b$12$abcdefghijklmnopqrstuv')).toBe(false);
  });

  it('needsRehash is false when params meet configured cost', () => {
    expect(hasher.needsRehash(ARGON2_HASH_STRONG)).toBe(false);
  });

  it('needsRehash is true when stored params are weaker', () => {
    expect(hasher.needsRehash(ARGON2_HASH_WEAK)).toBe(true);
  });

  it('needsRehash is true for a non-argon2 hash', () => {
    expect(hasher.needsRehash('$2b$12$abcdefghijklmnopqrstuv')).toBe(true);
  });

  it('throws ARGON2_NOT_INSTALLED when the optional dependency is absent', async () => {
    // argon2 패키지는 devDependency 가 아니므로 이 환경에서 import 실패해야 한다.
    await expect(hasher.hash('password123')).rejects.toMatchObject({
      code: 'ARGON2_NOT_INSTALLED',
    });
    await expect(hasher.verify('password123', ARGON2_HASH_STRONG)).rejects.toBeInstanceOf(AuthError);
  });
});

describe('MigratingPasswordHasher', () => {
  // 레거시 스킴을 흉내내는 가짜 해셔 (소비자가 plug 하는 scrypt 어댑터 대역)
  const legacyHasher: IPasswordHasher = {
    id: 'legacy',
    identifies: (h: string) => h.startsWith('legacy$'),
    hash: async (p: string) => `legacy$${p}`,
    verify: async (p: string, h: string) => h === `legacy$${p}`,
    needsRehash: () => true,
  };

  const preferred = new BcryptPasswordHasher({ rounds: 10 });
  const migrating = new MigratingPasswordHasher({ preferred, legacy: [legacyHasher] });

  it('exposes the preferred scheme id', () => {
    expect(migrating.id).toBe('bcrypt');
  });

  it('verifies a preferred-scheme hash', async () => {
    const hash = await preferred.hash('secret');
    expect(await migrating.verify('secret', hash)).toBe(true);
  });

  it('verifies a legacy-scheme hash by routing to the legacy hasher', async () => {
    expect(await migrating.verify('secret', 'legacy$secret')).toBe(true);
    expect(await migrating.verify('wrong', 'legacy$secret')).toBe(false);
  });

  it('returns false for an unrecognized hash format', async () => {
    expect(await migrating.verify('secret', 'unknown-format')).toBe(false);
  });

  it('needsRehash is true for a legacy hash (migrate to preferred)', () => {
    expect(migrating.needsRehash('legacy$secret')).toBe(true);
  });

  it('needsRehash is false for a current preferred hash', async () => {
    const hash = await preferred.hash('secret');
    expect(migrating.needsRehash(hash)).toBe(false);
  });

  it('hash() always produces the preferred scheme', async () => {
    const hash = await migrating.hash('secret');
    expect(preferred.identifies(hash)).toBe(true);
  });
});
