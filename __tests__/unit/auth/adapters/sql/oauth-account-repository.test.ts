import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:crypto', () => ({ randomUUID: vi.fn(() => 'oauth-id') }));

import { SqlOAuthAccountRepository } from '@withwiz/toolkit/core/auth/adapters/sql';

function createMockExec(rows: Record<string, unknown>[] = []) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

const ROW = {
  id: 'acc-1',
  user_id: 'user-1',
  provider: 'google',
  provider_account_id: 'g-123',
  access_token: 'at',
  refresh_token: 'rt',
  expires_at: new Date('2024-01-01'),
  token_type: 'Bearer',
  scope: 'email profile',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-02'),
};

describe('SqlOAuthAccountRepository (postgres)', () => {
  it('findByProvider는 provider+providerAccountId 조건 SELECT', async () => {
    const exec = createMockExec([ROW]);
    const repo = new SqlOAuthAccountRepository(exec, { dialect: 'postgres' });
    const result = await repo.findByProvider('google', 'g-123');

    expect(exec.query).toHaveBeenCalledWith(
      'SELECT "id", "user_id", "provider", "provider_account_id", "access_token", "refresh_token", "expires_at", "token_type", "scope", "created_at", "updated_at" FROM "accounts" WHERE "provider" = $1 AND "provider_account_id" = $2',
      ['google', 'g-123'],
    );
    expect(result).toEqual({
      id: 'acc-1',
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'g-123',
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: new Date('2024-01-01'),
      tokenType: 'Bearer',
      scope: 'email profile',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    });
  });

  it('findByProvider 미존재 시 null', async () => {
    const repo = new SqlOAuthAccountRepository(createMockExec([]), { dialect: 'postgres' });
    expect(await repo.findByProvider('google', 'x')).toBeNull();
  });

  it('findByUserId는 배열 반환', async () => {
    const exec = createMockExec([ROW, ROW]);
    const repo = new SqlOAuthAccountRepository(exec, { dialect: 'postgres' });
    const result = await repo.findByUserId('user-1');
    expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('WHERE "user_id" = $1'), ['user-1']);
    expect(result).toHaveLength(2);
  });

  describe('create', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('id/timestamps 생성 후 INSERT', async () => {
      const exec = createMockExec([]);
      const repo = new SqlOAuthAccountRepository(exec, { dialect: 'postgres' });
      const now = new Date('2025-01-01T00:00:00Z');
      const result = await repo.create({
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'g-123',
        accessToken: 'at',
      });

      expect(exec.query).toHaveBeenCalledWith(
        'INSERT INTO "accounts" ("id", "user_id", "provider", "provider_account_id", "access_token", "refresh_token", "expires_at", "token_type", "scope", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        ['oauth-id', 'user-1', 'google', 'g-123', 'at', null, null, null, null, now, now],
      );
      expect(result).toMatchObject({ id: 'oauth-id', provider: 'google', accessToken: 'at', createdAt: now });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-02T00:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('토큰 필드 SET 후 selectById 재조회', async () => {
      const exec = { query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([ROW]) };
      const repo = new SqlOAuthAccountRepository(exec, { dialect: 'postgres' });
      const now = new Date('2025-02-02T00:00:00Z');
      const result = await repo.update('acc-1', { accessToken: 'new-at', scope: 'email' });

      expect(exec.query).toHaveBeenNthCalledWith(
        1,
        'UPDATE "accounts" SET "access_token" = $1, "scope" = $2, "updated_at" = $3 WHERE "id" = $4',
        ['new-at', 'email', now, 'acc-1'],
      );
      expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('SELECT'), ['acc-1']);
      expect(result.id).toBe('acc-1');
    });
  });

  it('delete', async () => {
    const exec = createMockExec([]);
    const repo = new SqlOAuthAccountRepository(exec, { dialect: 'postgres' });
    await repo.delete('acc-1');
    expect(exec.query).toHaveBeenCalledWith('DELETE FROM "accounts" WHERE "id" = $1', ['acc-1']);
  });
});

describe('SqlOAuthAccountRepository (mysql)', () => {
  it('백틱 식별자 + ? placeholder', async () => {
    const exec = createMockExec([ROW]);
    const repo = new SqlOAuthAccountRepository(exec, { dialect: 'mysql' });
    await repo.findByProvider('google', 'g-123');
    expect(exec.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE `provider` = ? AND `provider_account_id` = ?'),
      ['google', 'g-123'],
    );
  });
});
