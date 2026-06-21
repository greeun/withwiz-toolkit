import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:crypto', () => ({ randomUUID: vi.fn(() => 'generated-id') }));

import { SqlUserRepository } from '@withwiz/toolkit/core/auth/adapters/sql';

function createMockExec(rows: Record<string, unknown>[] = []) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

const ROW = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  image: null,
  email_verified: new Date('2024-01-01'),
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-02'),
};

describe('SqlUserRepository (postgres)', () => {
  describe('findById', () => {
    it('SELECT를 보내고 BaseUser로 매핑한다', async () => {
      const exec = createMockExec([ROW]);
      const repo = new SqlUserRepository(exec, { dialect: 'postgres' });
      const result = await repo.findById('user-1');

      expect(exec.query).toHaveBeenCalledWith(
        'SELECT "id", "email", "name", "role", "image", "email_verified", "is_active", "created_at", "updated_at" FROM "users" WHERE "id" = $1',
        ['user-1'],
      );
      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        emailVerified: new Date('2024-01-01'),
        isActive: true,
        image: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });
    });

    it('row가 없으면 null', async () => {
      const repo = new SqlUserRepository(createMockExec([]), { dialect: 'postgres' });
      expect(await repo.findById('x')).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('password 컬럼 포함 SELECT 후 반환 객체에 password 부착', async () => {
      const exec = createMockExec([{ ...ROW, password: 'hash' }]);
      const repo = new SqlUserRepository(exec, { dialect: 'postgres' });
      const result = await repo.findByEmail('test@example.com');

      expect(exec.query).toHaveBeenCalledWith(
        'SELECT "id", "email", "name", "role", "image", "email_verified", "is_active", "created_at", "updated_at", "password" FROM "users" WHERE "email" = $1',
        ['test@example.com'],
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).password).toBe('hash');
    });

    it('없으면 null', async () => {
      const repo = new SqlUserRepository(createMockExec([]), { dialect: 'postgres' });
      expect(await repo.findByEmail('x@y.com')).toBeNull();
    });
  });

  describe('create', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('id/timestamps 생성 후 INSERT, 생성 객체 반환', async () => {
      const exec = createMockExec([]);
      const repo = new SqlUserRepository(exec, { dialect: 'postgres' });
      const now = new Date('2025-01-01T00:00:00Z');
      const result = await repo.create({ email: 'new@example.com', password: 'h', name: 'New', role: 'USER' });

      expect(exec.query).toHaveBeenCalledWith(
        'INSERT INTO "users" ("id", "email", "name", "password", "role", "email_verified", "image", "is_active", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        ['generated-id', 'new@example.com', 'New', 'h', 'USER', null, null, true, now, now],
      );
      expect(result).toMatchObject({
        id: 'generated-id',
        email: 'new@example.com',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-02T00:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('SET 절 생성 후 findById 재조회', async () => {
      const exec = { query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([ROW]) };
      const repo = new SqlUserRepository(exec, { dialect: 'postgres' });
      const now = new Date('2025-02-02T00:00:00Z');
      const result = await repo.update('user-1', { name: 'Renamed', isActive: false });

      expect(exec.query).toHaveBeenNthCalledWith(
        1,
        'UPDATE "users" SET "name" = $1, "is_active" = $2, "updated_at" = $3 WHERE "id" = $4',
        ['Renamed', false, now, 'user-1'],
      );
      expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('SELECT'), ['user-1']);
      expect(result.id).toBe('user-1');
    });
  });

  describe('updateLastLoginAt / verifyEmail / delete', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-03-03T00:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('updateLastLoginAt', async () => {
      const exec = createMockExec([]);
      const repo = new SqlUserRepository(exec, { dialect: 'postgres' });
      await repo.updateLastLoginAt('user-1');
      expect(exec.query).toHaveBeenCalledWith(
        'UPDATE "users" SET "last_login_at" = $1 WHERE "id" = $2',
        [new Date('2025-03-03T00:00:00Z'), 'user-1'],
      );
    });

    it('verifyEmail', async () => {
      const exec = createMockExec([]);
      const repo = new SqlUserRepository(exec, { dialect: 'postgres' });
      await repo.verifyEmail('test@example.com');
      expect(exec.query).toHaveBeenCalledWith(
        'UPDATE "users" SET "email_verified" = $1 WHERE "email" = $2',
        [new Date('2025-03-03T00:00:00Z'), 'test@example.com'],
      );
    });

    it('delete', async () => {
      const exec = createMockExec([]);
      const repo = new SqlUserRepository(exec, { dialect: 'postgres' });
      await repo.delete('user-1');
      expect(exec.query).toHaveBeenCalledWith('DELETE FROM "users" WHERE "id" = $1', ['user-1']);
    });
  });
});

describe('SqlUserRepository (mysql)', () => {
  it('findById는 ? placeholder와 백틱 식별자를 쓴다', async () => {
    const exec = createMockExec([ROW]);
    const repo = new SqlUserRepository(exec, { dialect: 'mysql' });
    await repo.findById('user-1');
    expect(exec.query).toHaveBeenCalledWith(
      'SELECT `id`, `email`, `name`, `role`, `image`, `email_verified`, `is_active`, `created_at`, `updated_at` FROM `users` WHERE `id` = ?',
      ['user-1'],
    );
  });
});

describe('SqlUserRepository (config override)', () => {
  it('커스텀 테이블/컬럼명을 SQL에 반영', async () => {
    const exec = createMockExec([]);
    const repo = new SqlUserRepository(exec, {
      dialect: 'postgres',
      tables: { user: 'app_users' },
      userColumns: { email: 'email_address' },
    });
    await repo.findByEmail('a@b.com');
    const [sql] = exec.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM "app_users"');
    expect(sql).toContain('"email_address" = $');
  });
});
