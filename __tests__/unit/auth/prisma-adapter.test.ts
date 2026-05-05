/**
 * Prisma Adapter Repository Unit Tests
 *
 * PrismaUserRepository, PrismaOAuthAccountRepository, PrismaEmailTokenRepository
 * 의 전체 메서드 커버리지 확보를 위한 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PrismaUserRepository,
  PrismaOAuthAccountRepository,
  PrismaEmailTokenRepository,
} from '../../../src/auth/adapters/prisma';

// ============================================================================
// Mock Prisma Client Factory
// ============================================================================

function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    magicLinkToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  };
}

// ============================================================================
// PrismaUserRepository
// ============================================================================

describe('PrismaUserRepository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let repo: InstanceType<typeof PrismaUserRepository>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    repo = new PrismaUserRepository(mockPrisma);
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('사용자를 찾으면 BaseUser를 반환해야 한다', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        emailVerified: new Date('2024-01-01'),
        isActive: true,
        image: 'https://img.example.com/avatar.png',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        emailVerified: new Date('2024-01-01'),
        isActive: true,
        image: 'https://img.example.com/avatar.png',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });
    });

    it('사용자가 없으면 null을 반환해야 한다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('사용자를 찾으면 password 필드를 포함한 BaseUser를 반환해야 한다', async () => {
      const mockUser = {
        id: 'user-2',
        email: 'find@example.com',
        name: 'Find User',
        role: 'ADMIN',
        emailVerified: null,
        isActive: true,
        image: null,
        password: 'hashed-password-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByEmail('find@example.com');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'find@example.com' } });
      expect(result).not.toBeNull();
      expect(result!.email).toBe('find@example.com');
      expect((result as any).password).toBe('hashed-password-123');
    });

    it('사용자가 없으면 null을 반환해야 한다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });

    it('password 필드가 없으면 null을 포함해야 한다', async () => {
      const mockUser = {
        id: 'user-3',
        email: 'nopass@example.com',
        name: 'No Pass',
        role: 'USER',
        emailVerified: null,
        isActive: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByEmail('nopass@example.com');

      expect((result as any).password).toBeNull();
    });
  });

  describe('create', () => {
    it('기본 설정으로 사용자를 생성해야 한다', async () => {
      const mockCreated = {
        id: 'new-user-1',
        email: 'new@example.com',
        name: 'New User',
        role: 'USER',
        emailVerified: null,
        isActive: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.create.mockResolvedValue(mockCreated);

      const result = await repo.create({
        email: 'new@example.com',
        name: 'New User',
        password: 'hashed-pw',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
          password: 'hashed-pw',
        }),
      });
      expect(result.id).toBe('new-user-1');
      expect(result.email).toBe('new@example.com');
    });

    it('커스텀 userFields 설정으로 사용자를 생성해야 한다', async () => {
      const customRepo = new PrismaUserRepository(mockPrisma, {
        userFields: {
          password: 'hashedPassword',
          role: 'userRole',
          image: 'avatarUrl',
          emailVerified: 'verifiedAt',
        },
      });

      const mockCreated = {
        id: 'custom-1',
        email: 'custom@example.com',
        name: 'Custom User',
        userRole: 'EDITOR',
        verifiedAt: null,
        isActive: true,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.create.mockResolvedValue(mockCreated);

      await customRepo.create({
        email: 'custom@example.com',
        name: 'Custom User',
        password: 'secret',
        role: 'EDITOR',
      });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.hashedPassword).toBe('secret');
      expect(createCall.data.userRole).toBe('EDITOR');
      expect(createCall.data.verifiedAt).toBeNull();
      expect(createCall.data.avatarUrl).toBeNull();
    });

    it('password 없이 생성 가능해야 한다', async () => {
      const mockCreated = {
        id: 'oauth-user',
        email: 'oauth@example.com',
        name: null,
        role: 'USER',
        emailVerified: null,
        isActive: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.create.mockResolvedValue(mockCreated);

      await repo.create({ email: 'oauth@example.com' });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).toBeNull();
      expect(createCall.data.name).toBeNull();
    });

    it('role이 지정되면 해당 role을 사용해야 한다', async () => {
      const mockCreated = {
        id: 'admin-user',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
        emailVerified: null,
        isActive: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.create.mockResolvedValue(mockCreated);

      await repo.create({ email: 'admin@example.com', name: 'Admin', role: 'ADMIN' });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('ADMIN');
    });
  });

  describe('update', () => {
    it('일부 필드만 업데이트해야 한다', async () => {
      const mockUpdated = {
        id: 'user-1',
        email: 'updated@example.com',
        name: 'Updated',
        role: 'USER',
        emailVerified: null,
        isActive: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.update.mockResolvedValue(mockUpdated);

      const result = await repo.update('user-1', { email: 'updated@example.com', name: 'Updated' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: 'updated@example.com', name: 'Updated' },
      });
      expect(result.email).toBe('updated@example.com');
    });

    it('커스텀 필드명으로 업데이트해야 한다', async () => {
      const customRepo = new PrismaUserRepository(mockPrisma, {
        userFields: { password: 'hashedPw', role: 'userRole', image: 'avatar', emailVerified: 'verifiedAt' },
      });

      const mockUpdated = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        userRole: 'ADMIN',
        verifiedAt: new Date(),
        isActive: true,
        avatar: 'new-img.png',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.update.mockResolvedValue(mockUpdated);

      await customRepo.update('user-1', {
        password: 'new-hash',
        role: 'ADMIN',
        image: 'new-img.png',
        emailVerified: new Date('2024-06-01'),
      });

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.hashedPw).toBe('new-hash');
      expect(updateCall.data.userRole).toBe('ADMIN');
      expect(updateCall.data.avatar).toBe('new-img.png');
      expect(updateCall.data.verifiedAt).toEqual(new Date('2024-06-01'));
    });

    it('isActive 필드를 업데이트해야 한다', async () => {
      const mockUpdated = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'USER',
        emailVerified: null,
        isActive: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.update.mockResolvedValue(mockUpdated);

      await repo.update('user-1', { isActive: false });

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.isActive).toBe(false);
    });
  });

  describe('delete', () => {
    it('사용자를 삭제해야 한다', async () => {
      mockPrisma.user.delete.mockResolvedValue({});

      await repo.delete('user-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });

  describe('updateLastLoginAt', () => {
    it('lastLoginAt을 현재 시간으로 업데이트해야 한다', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await repo.updateLastLoginAt('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('verifyEmail', () => {
    it('emailVerified를 현재 시간으로 업데이트해야 한다', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await repo.verifyEmail('verify@example.com');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { email: 'verify@example.com' },
        data: { emailVerified: expect.any(Date) },
      });
    });
  });
});

// ============================================================================
// PrismaOAuthAccountRepository
// ============================================================================

describe('PrismaOAuthAccountRepository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let repo: InstanceType<typeof PrismaOAuthAccountRepository>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    repo = new PrismaOAuthAccountRepository(mockPrisma);
    vi.clearAllMocks();
  });

  describe('findByProvider', () => {
    it('계정을 찾으면 OAuthAccount를 반환해야 한다', async () => {
      const mockAccount = {
        id: 'acc-1',
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-123',
        token: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: 1700000000,
          tokenType: 'Bearer',
          scope: 'email profile',
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      const result = await repo.findByProvider('google', 'google-123');

      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: 'google-123',
          },
        },
        include: { token: true },
      });
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('google');
      expect(result!.accessToken).toBe('access-token');
      expect(result!.refreshToken).toBe('refresh-token');
      expect(result!.expiresAt).toEqual(new Date(1700000000 * 1000));
      expect(result!.tokenType).toBe('Bearer');
      expect(result!.scope).toBe('email profile');
    });

    it('계정이 없으면 null을 반환해야 한다', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      const result = await repo.findByProvider('github', 'nonexistent');

      expect(result).toBeNull();
    });

    it('token이 없는 계정도 올바르게 매핑해야 한다', async () => {
      const mockAccount = {
        id: 'acc-2',
        userId: 'user-2',
        provider: 'kakao',
        providerAccountId: 'kakao-456',
        token: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      const result = await repo.findByProvider('kakao', 'kakao-456');

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBeNull();
      expect(result!.refreshToken).toBeNull();
      expect(result!.expiresAt).toBeNull();
      expect(result!.tokenType).toBeNull();
      expect(result!.scope).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('사용자의 모든 OAuth 계정을 반환해야 한다', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          userId: 'user-1',
          provider: 'google',
          providerAccountId: 'g-123',
          token: { accessToken: 'at1', refreshToken: null, expiresAt: null, tokenType: 'Bearer', scope: null },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'acc-2',
          userId: 'user-1',
          provider: 'github',
          providerAccountId: 'gh-456',
          token: null,
          createdAt: new Date(),
        },
      ];
      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await repo.findByUserId('user-1');

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { token: true },
      });
      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('google');
      expect(result[1].provider).toBe('github');
    });

    it('계정이 없으면 빈 배열을 반환해야 한다', async () => {
      mockPrisma.account.findMany.mockResolvedValue([]);

      const result = await repo.findByUserId('no-accounts');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('토큰과 함께 계정을 생성해야 한다', async () => {
      const expiresAt = new Date('2024-12-31');
      const mockCreated = {
        id: 'new-acc',
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'g-new',
        token: {
          accessToken: 'new-at',
          refreshToken: 'new-rt',
          expiresAt: Math.floor(expiresAt.getTime() / 1000),
          tokenType: 'Bearer',
          scope: 'email',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.account.create.mockResolvedValue(mockCreated);

      const result = await repo.create({
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'g-new',
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        expiresAt,
        tokenType: 'Bearer',
        scope: 'email',
      });

      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'oauth',
          provider: 'google',
          providerAccountId: 'g-new',
          token: {
            create: {
              accessToken: 'new-at',
              refreshToken: 'new-rt',
              expiresAt: Math.floor(expiresAt.getTime() / 1000),
              tokenType: 'Bearer',
              scope: 'email',
            },
          },
        },
        include: { token: true },
      });
      expect(result.accessToken).toBe('new-at');
      expect(result.refreshToken).toBe('new-rt');
    });

    it('토큰 없이 계정을 생성해야 한다', async () => {
      const mockCreated = {
        id: 'no-token-acc',
        userId: 'user-2',
        provider: 'github',
        providerAccountId: 'gh-123',
        token: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.account.create.mockResolvedValue(mockCreated);

      const result = await repo.create({
        userId: 'user-2',
        provider: 'github',
        providerAccountId: 'gh-123',
      });

      const createCall = mockPrisma.account.create.mock.calls[0][0];
      expect(createCall.data.token).toBeUndefined();
      expect(result.accessToken).toBeNull();
    });

    it('accessToken만 있어도 token nested create를 생성해야 한다', async () => {
      const mockCreated = {
        id: 'partial-token',
        userId: 'user-3',
        provider: 'kakao',
        providerAccountId: 'k-111',
        token: { accessToken: 'only-at', refreshToken: null, expiresAt: null, tokenType: null, scope: null },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.account.create.mockResolvedValue(mockCreated);

      await repo.create({
        userId: 'user-3',
        provider: 'kakao',
        providerAccountId: 'k-111',
        accessToken: 'only-at',
      });

      const createCall = mockPrisma.account.create.mock.calls[0][0];
      expect(createCall.data.token).toBeDefined();
      expect(createCall.data.token.create.accessToken).toBe('only-at');
      expect(createCall.data.token.create.refreshToken).toBeNull();
    });
  });

  describe('update', () => {
    it('토큰을 upsert으로 업데이트해야 한다', async () => {
      const expiresAt = new Date('2025-06-01');
      const mockUpdated = {
        id: 'acc-1',
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'g-123',
        token: {
          accessToken: 'updated-at',
          refreshToken: 'updated-rt',
          expiresAt: Math.floor(expiresAt.getTime() / 1000),
          tokenType: 'Bearer',
          scope: 'email profile',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.account.update.mockResolvedValue(mockUpdated);

      const result = await repo.update('acc-1', {
        accessToken: 'updated-at',
        refreshToken: 'updated-rt',
        expiresAt,
        tokenType: 'Bearer',
        scope: 'email profile',
      });

      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          token: {
            upsert: {
              create: {
                accessToken: 'updated-at',
                refreshToken: 'updated-rt',
                expiresAt: Math.floor(expiresAt.getTime() / 1000),
                tokenType: 'Bearer',
                scope: 'email profile',
              },
              update: {
                accessToken: 'updated-at',
                refreshToken: 'updated-rt',
                expiresAt: Math.floor(expiresAt.getTime() / 1000),
                tokenType: 'Bearer',
                scope: 'email profile',
              },
            },
          },
        },
        include: { token: true },
      });
      expect(result.accessToken).toBe('updated-at');
    });

    it('expiresAt가 없으면 null을 전달해야 한다', async () => {
      const mockUpdated = {
        id: 'acc-2',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'gh-1',
        token: { accessToken: 'at', refreshToken: null, expiresAt: null, tokenType: null, scope: null },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.account.update.mockResolvedValue(mockUpdated);

      await repo.update('acc-2', { accessToken: 'at' });

      const updateCall = mockPrisma.account.update.mock.calls[0][0];
      expect(updateCall.data.token.upsert.create.expiresAt).toBeNull();
    });
  });

  describe('delete', () => {
    it('계정을 삭제해야 한다', async () => {
      mockPrisma.account.delete.mockResolvedValue({});

      await repo.delete('acc-1');

      expect(mockPrisma.account.delete).toHaveBeenCalledWith({ where: { id: 'acc-1' } });
    });
  });
});

// ============================================================================
// PrismaEmailTokenRepository — 추가 커버리지
// ============================================================================

describe('PrismaEmailTokenRepository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let repo: InstanceType<typeof PrismaEmailTokenRepository>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    repo = new PrismaEmailTokenRepository(mockPrisma);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('EMAIL_VERIFICATION 토큰을 생성해야 한다', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      mockPrisma.emailVerificationToken.create.mockResolvedValue({
        id: 'ev-1',
        email: 'test@example.com',
        token: 'abc123',
        expires: expiresAt,
        createdAt: new Date(),
      });

      const result = await repo.create('test@example.com', 'abc123', 'EMAIL_VERIFICATION' as any, expiresAt);

      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledWith({
        data: { email: 'test@example.com', token: 'abc123', expires: expiresAt },
      });
      expect(result.type).toBe('EMAIL_VERIFICATION');
      expect(result.email).toBe('test@example.com');
      expect(result.token).toBe('abc123');
    });

    it('PASSWORD_RESET 토큰을 생성해야 한다', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      mockPrisma.passwordResetToken.create.mockResolvedValue({
        id: 'pr-1',
        email: 'reset@example.com',
        token: 'reset-token',
        expires: expiresAt,
        createdAt: new Date(),
      });

      const result = await repo.create('reset@example.com', 'reset-token', 'PASSWORD_RESET' as any, expiresAt);

      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
      expect(result.type).toBe('PASSWORD_RESET');
    });

    it('MAGIC_LINK 토큰을 생성할 때 used: false를 포함해야 한다', async () => {
      const expiresAt = new Date(Date.now() + 600000);
      mockPrisma.magicLinkToken.create.mockResolvedValue({
        id: 'ml-1',
        email: 'magic@example.com',
        token: 'magic-token',
        expires: expiresAt,
        used: false,
        createdAt: new Date(),
      });

      const result = await repo.create('magic@example.com', 'magic-token', 'MAGIC_LINK' as any, expiresAt);

      expect(mockPrisma.magicLinkToken.create).toHaveBeenCalledWith({
        data: { email: 'magic@example.com', token: 'magic-token', expires: expiresAt, used: false },
      });
      expect(result.type).toBe('MAGIC_LINK');
      expect(result.used).toBe(false);
    });

    it('지원하지 않는 토큰 타입이면 에러를 던져야 한다', async () => {
      const expiresAt = new Date(Date.now() + 3600000);

      await expect(
        repo.create('test@example.com', 'token', 'UNKNOWN_TYPE' as any, expiresAt)
      ).rejects.toThrow('Unsupported token type: UNKNOWN_TYPE');
    });
  });

  describe('findByEmailAndToken', () => {
    it('토큰을 찾으면 EmailToken을 반환해야 한다', async () => {
      const expires = new Date(Date.now() + 3600000);
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue({
        id: 'found-1',
        email: 'found@example.com',
        token: 'found-token',
        expires,
        used: false,
        createdAt: new Date(),
      });

      const result = await repo.findByEmailAndToken('found@example.com', 'found-token', 'EMAIL_VERIFICATION' as any);

      expect(mockPrisma.emailVerificationToken.findFirst).toHaveBeenCalledWith({
        where: { email: 'found@example.com', token: 'found-token' },
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe('found-1');
      expect(result!.type).toBe('EMAIL_VERIFICATION');
    });

    it('토큰이 없으면 null을 반환해야 한다', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      const result = await repo.findByEmailAndToken('none@example.com', 'bad-token', 'PASSWORD_RESET' as any);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('지정한 이메일과 토큰으로 삭제해야 한다', async () => {
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 1 });

      await repo.delete('del@example.com', 'del-token', 'EMAIL_VERIFICATION' as any);

      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'del@example.com', token: 'del-token' },
      });
    });

    it('PASSWORD_RESET 토큰을 삭제해야 한다', async () => {
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });

      await repo.delete('del@example.com', 'reset-token', 'PASSWORD_RESET' as any);

      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'del@example.com', token: 'reset-token' },
      });
    });
  });

  describe('deleteExpired', () => {
    it('세 테이블 모두에 만료된 토큰 삭제를 호출해야 한다', async () => {
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.magicLinkToken.deleteMany.mockResolvedValue({ count: 0 });

      await repo.deleteExpired();

      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { expires: { lt: expect.any(Date) } },
      });
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { expires: { lt: expect.any(Date) } },
      });
      expect(mockPrisma.magicLinkToken.deleteMany).toHaveBeenCalledWith({
        where: { expires: { lt: expect.any(Date) } },
      });
    });
  });

  describe('markAsUsed', () => {
    it('magicLinkToken 테이블에서 used=true로 업데이트해야 한다', async () => {
      mockPrisma.magicLinkToken.update.mockResolvedValue({});

      await repo.markAsUsed('token-id-1');

      expect(mockPrisma.magicLinkToken.update).toHaveBeenCalledWith({
        where: { id: 'token-id-1' },
        data: { used: true },
      });
    });
  });
});
