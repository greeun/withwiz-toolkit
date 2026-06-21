import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:crypto', () => ({ randomUUID: vi.fn(() => 'token-id') }));

import { SqlEmailTokenRepository } from '@withwiz/toolkit/core/auth/adapters/sql';
import { TokenType } from '@withwiz/toolkit/core/auth/types';

function createMockExec(rows: Record<string, unknown>[] = []) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('SqlEmailTokenRepository (postgres)', () => {
  describe('create', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('EMAIL_VERIFICATION: used 컬럼 없이 INSERT', async () => {
      const exec = createMockExec([]);
      const repo = new SqlEmailTokenRepository(exec, { dialect: 'postgres' });
      const now = new Date('2025-01-01T00:00:00Z');
      const expires = new Date('2025-01-02T00:00:00Z');
      const result = await repo.create('a@b.com', 'tok', TokenType.EMAIL_VERIFICATION, expires);

      expect(exec.query).toHaveBeenCalledWith(
        'INSERT INTO "email_verification_tokens" ("id", "email", "token", "expires", "created_at") VALUES ($1, $2, $3, $4, $5)',
        ['token-id', 'a@b.com', 'tok', expires, now],
      );
      expect(result).toEqual({
        id: 'token-id',
        email: 'a@b.com',
        token: 'tok',
        type: TokenType.EMAIL_VERIFICATION,
        expires,
        used: false,
        createdAt: now,
      });
    });

    it('MAGIC_LINK: used=false 컬럼 포함 INSERT', async () => {
      const exec = createMockExec([]);
      const repo = new SqlEmailTokenRepository(exec, { dialect: 'postgres' });
      const expires = new Date('2025-01-02T00:00:00Z');
      await repo.create('a@b.com', 'tok', TokenType.MAGIC_LINK, expires);

      expect(exec.query).toHaveBeenCalledWith(
        'INSERT INTO "magic_link_tokens" ("id", "email", "token", "expires", "created_at", "used") VALUES ($1, $2, $3, $4, $5, $6)',
        ['token-id', 'a@b.com', 'tok', expires, new Date('2025-01-01T00:00:00Z'), false],
      );
    });
  });

  describe('findByEmailAndToken', () => {
    it('PASSWORD_RESET: used 제외 SELECT, used=false 매핑', async () => {
      const exec = createMockExec([{
        id: 't1', email: 'a@b.com', token: 'tok',
        expires: new Date('2025-01-02'), created_at: new Date('2025-01-01'),
      }]);
      const repo = new SqlEmailTokenRepository(exec, { dialect: 'postgres' });
      const result = await repo.findByEmailAndToken('a@b.com', 'tok', TokenType.PASSWORD_RESET);

      expect(exec.query).toHaveBeenCalledWith(
        'SELECT "id", "email", "token", "expires", "created_at" FROM "password_reset_tokens" WHERE "email" = $1 AND "token" = $2',
        ['a@b.com', 'tok'],
      );
      expect(result).toMatchObject({ id: 't1', type: TokenType.PASSWORD_RESET, used: false });
    });

    it('MAGIC_LINK: used 컬럼 SELECT 및 Boolean 매핑', async () => {
      const exec = createMockExec([{
        id: 't1', email: 'a@b.com', token: 'tok',
        expires: new Date('2025-01-02'), created_at: new Date('2025-01-01'), used: true,
      }]);
      const repo = new SqlEmailTokenRepository(exec, { dialect: 'postgres' });
      const result = await repo.findByEmailAndToken('a@b.com', 'tok', TokenType.MAGIC_LINK);

      expect(exec.query).toHaveBeenCalledWith(
        'SELECT "id", "email", "token", "expires", "created_at", "used" FROM "magic_link_tokens" WHERE "email" = $1 AND "token" = $2',
        ['a@b.com', 'tok'],
      );
      expect(result?.used).toBe(true);
    });

    it('미존재 시 null', async () => {
      const repo = new SqlEmailTokenRepository(createMockExec([]), { dialect: 'postgres' });
      expect(await repo.findByEmailAndToken('a@b.com', 'x', TokenType.EMAIL_VERIFICATION)).toBeNull();
    });
  });

  it('delete', async () => {
    const exec = createMockExec([]);
    const repo = new SqlEmailTokenRepository(exec, { dialect: 'postgres' });
    await repo.delete('a@b.com', 'tok', TokenType.EMAIL_VERIFICATION);
    expect(exec.query).toHaveBeenCalledWith(
      'DELETE FROM "email_verification_tokens" WHERE "email" = $1 AND "token" = $2',
      ['a@b.com', 'tok'],
    );
  });

  describe('deleteExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-03-03T00:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('세 토큰 테이블에서 만료분 DELETE', async () => {
      const exec = createMockExec([]);
      const repo = new SqlEmailTokenRepository(exec, { dialect: 'postgres' });
      const now = new Date('2025-03-03T00:00:00Z');
      await repo.deleteExpired();

      expect(exec.query).toHaveBeenCalledTimes(3);
      expect(exec.query).toHaveBeenCalledWith('DELETE FROM "email_verification_tokens" WHERE "expires" < $1', [now]);
      expect(exec.query).toHaveBeenCalledWith('DELETE FROM "password_reset_tokens" WHERE "expires" < $1', [now]);
      expect(exec.query).toHaveBeenCalledWith('DELETE FROM "magic_link_tokens" WHERE "expires" < $1', [now]);
    });
  });

  it('markAsUsed는 magic_link_tokens.used=true UPDATE', async () => {
    const exec = createMockExec([]);
    const repo = new SqlEmailTokenRepository(exec, { dialect: 'postgres' });
    await repo.markAsUsed('t1');
    expect(exec.query).toHaveBeenCalledWith(
      'UPDATE "magic_link_tokens" SET "used" = $1 WHERE "id" = $2',
      [true, 't1'],
    );
  });
});

describe('SqlEmailTokenRepository (mysql)', () => {
  it('백틱 + ? placeholder', async () => {
    const exec = createMockExec([]);
    const repo = new SqlEmailTokenRepository(exec, { dialect: 'mysql' });
    await repo.delete('a@b.com', 'tok', TokenType.EMAIL_VERIFICATION);
    expect(exec.query).toHaveBeenCalledWith(
      'DELETE FROM `email_verification_tokens` WHERE `email` = ? AND `token` = ?',
      ['a@b.com', 'tok'],
    );
  });

  it('커스텀 토큰 테이블명 반영', async () => {
    const exec = createMockExec([]);
    const repo = new SqlEmailTokenRepository(exec, {
      dialect: 'postgres',
      tables: { passwordReset: 'pw_resets' },
    });
    await repo.delete('a@b.com', 'tok', TokenType.PASSWORD_RESET);
    expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "pw_resets"'), ['a@b.com', 'tok']);
  });
});
