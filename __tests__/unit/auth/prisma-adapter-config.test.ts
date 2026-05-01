/**
 * Prisma Adapter Config Injection Unit Tests
 *
 * - PrismaAdapterConfig를 통한 커스텀 테이블/필드명 주입 검증
 * - PrismaUserRepository: userFields 커스텀 매핑
 * - PrismaEmailTokenRepository: tokenTables 커스텀 매핑
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PrismaUserRepository,
  PrismaEmailTokenRepository,
  PrismaOAuthAccountRepository,
} from '@withwiz/auth/adapters/prisma';
import type { PrismaAdapterConfig } from '@withwiz/auth/adapters/prisma';

// ============================================================================
// Mock Prisma Client Factory
// ============================================================================

function createMockPrisma() {
  const mockPrisma: any = {};

  // User table mock
  mockPrisma.user = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  // Token table mocks (default names)
  ['emailVerificationToken', 'passwordResetToken', 'magicLinkToken'].forEach(name => {
    mockPrisma[name] = {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    };
  });

  // Token table mocks (custom names for config tests)
  ['email_tokens', 'custom_reset', 'custom_magic'].forEach(name => {
    mockPrisma[name] = {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    };
  });

  // Account table mock
  mockPrisma.account = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  return mockPrisma;
}

// ============================================================================
// PrismaUserRepository — Config Injection
// ============================================================================

describe('PrismaUserRepository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
  });

  describe('기본 설정 (config 없음)', () => {
    it('기본 필드명 role, emailVerified, image로 매핑해야 한다', async () => {
      const repo = new PrismaUserRepository(mockPrisma);

      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        role: 'ADMIN',
        emailVerified: new Date('2024-01-01'),
        isActive: true,
        image: 'https://example.com/avatar.png',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById('user-1');

      expect(result).not.toBeNull();
      expect(result!.role).toBe('ADMIN');
      expect(result!.emailVerified).toEqual(new Date('2024-01-01'));
      expect(result!.image).toBe('https://example.com/avatar.png');
    });
  });

  describe('커스텀 설정', () => {
    it('userFields로 커스텀 필드명을 매핑해야 한다', async () => {
      const config: PrismaAdapterConfig = {
        userFields: {
          role: 'userRole',
          image: 'avatarUrl',
        },
      };
      const repo = new PrismaUserRepository(mockPrisma, config);

      // Prisma에서 반환하는 실제 필드명은 커스텀 필드명
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        userRole: 'EDITOR',           // 커스텀 필드명
        emailVerified: new Date(),     // 기본 필드명 (오버라이드 안 함)
        isActive: true,
        avatarUrl: 'https://example.com/custom-avatar.png', // 커스텀 필드명
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById('user-1');

      expect(result).not.toBeNull();
      expect(result!.role).toBe('EDITOR');
      expect(result!.image).toBe('https://example.com/custom-avatar.png');
    });

    it('일부 필드만 오버라이드하면 나머지는 기본값을 사용해야 한다', async () => {
      const config: PrismaAdapterConfig = {
        userFields: {
          role: 'userRole',
          // image, emailVerified, password는 기본값 유지
        },
      };
      const repo = new PrismaUserRepository(mockPrisma, config);

      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        userRole: 'MODERATOR',    // 커스텀
        emailVerified: null,       // 기본 필드명
        isActive: true,
        image: 'default-avatar',   // 기본 필드명
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById('user-1');

      expect(result).not.toBeNull();
      expect(result!.role).toBe('MODERATOR');     // 커스텀 필드에서 읽음
      expect(result!.image).toBe('default-avatar'); // 기본 필드에서 읽음
      expect(result!.emailVerified).toBeNull();     // 기본 필드에서 읽음
    });
  });

  describe('findByEmail', () => {
    it('커스텀 설정으로 이메일 검색 결과를 올바르게 매핑해야 한다', async () => {
      const config: PrismaAdapterConfig = {
        userFields: { role: 'userRole', image: 'profileImage' },
      };
      const repo = new PrismaUserRepository(mockPrisma, config);

      const mockUser = {
        id: 'user-2',
        email: 'search@test.com',
        name: 'Search User',
        userRole: 'USER',
        emailVerified: null,
        isActive: true,
        profileImage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByEmail('search@test.com');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'search@test.com' } });
      expect(result).not.toBeNull();
      expect(result!.role).toBe('USER');
      expect(result!.image).toBeNull();
    });
  });

  describe('findById — null 반환', () => {
    it('사용자가 없으면 null을 반환해야 한다', async () => {
      const repo = new PrismaUserRepository(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// PrismaEmailTokenRepository — Config Injection
// ============================================================================

describe('PrismaEmailTokenRepository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
  });

  // ========================================================================
  // 기본 설정
  // ========================================================================

  describe('기본 설정 (config 없음)', () => {
    it('기본 테이블명 emailVerificationToken, passwordResetToken, magicLinkToken을 사용해야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma);
      const expiresAt = new Date(Date.now() + 3600000);

      // EMAIL_VERIFICATION
      mockPrisma.emailVerificationToken.create.mockResolvedValue({
        id: 'token-1', email: 'a@test.com', token: 'abc', expires: expiresAt, createdAt: new Date(),
      });
      await repo.create('a@test.com', 'abc', 'EMAIL_VERIFICATION' as any, expiresAt);
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledWith({
        data: { email: 'a@test.com', token: 'abc', expires: expiresAt },
      });

      // PASSWORD_RESET
      mockPrisma.passwordResetToken.create.mockResolvedValue({
        id: 'token-2', email: 'b@test.com', token: 'def', expires: expiresAt, createdAt: new Date(),
      });
      await repo.create('b@test.com', 'def', 'PASSWORD_RESET' as any, expiresAt);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: { email: 'b@test.com', token: 'def', expires: expiresAt },
      });

      // MAGIC_LINK
      mockPrisma.magicLinkToken.create.mockResolvedValue({
        id: 'token-3', email: 'c@test.com', token: 'ghi', expires: expiresAt, used: false, createdAt: new Date(),
      });
      await repo.create('c@test.com', 'ghi', 'MAGIC_LINK' as any, expiresAt);
      expect(mockPrisma.magicLinkToken.create).toHaveBeenCalledWith({
        data: { email: 'c@test.com', token: 'ghi', expires: expiresAt, used: false },
      });
    });
  });

  // ========================================================================
  // 커스텀 설정
  // ========================================================================

  describe('커스텀 설정', () => {
    const customConfig: PrismaAdapterConfig = {
      tokenTables: {
        emailVerification: 'email_tokens',
        passwordReset: 'custom_reset',
        magicLink: 'custom_magic',
      },
    };

    it('커스텀 테이블명으로 토큰을 생성해야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma, customConfig);
      const expiresAt = new Date(Date.now() + 3600000);

      mockPrisma.email_tokens.create.mockResolvedValue({
        id: 'token-1', email: 'test@test.com', token: 'xyz', expires: expiresAt, createdAt: new Date(),
      });

      const result = await repo.create('test@test.com', 'xyz', 'EMAIL_VERIFICATION' as any, expiresAt);

      expect(mockPrisma.email_tokens.create).toHaveBeenCalledWith({
        data: { email: 'test@test.com', token: 'xyz', expires: expiresAt },
      });
      expect(result.email).toBe('test@test.com');
      expect(result.token).toBe('xyz');
    });

    it('커스텀 테이블명으로 토큰을 조회해야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma, customConfig);

      mockPrisma.custom_reset.findFirst.mockResolvedValue({
        id: 'token-2', email: 'find@test.com', token: 'find-token', expires: new Date(), createdAt: new Date(),
      });

      const result = await repo.findByEmailAndToken('find@test.com', 'find-token', 'PASSWORD_RESET' as any);

      expect(mockPrisma.custom_reset.findFirst).toHaveBeenCalledWith({
        where: { email: 'find@test.com', token: 'find-token' },
      });
      expect(result).not.toBeNull();
      expect(result!.email).toBe('find@test.com');
    });

    it('커스텀 테이블명으로 토큰을 삭제해야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma, customConfig);

      mockPrisma.custom_magic.deleteMany.mockResolvedValue({ count: 1 });

      await repo.delete('del@test.com', 'del-token', 'MAGIC_LINK' as any);

      expect(mockPrisma.custom_magic.deleteMany).toHaveBeenCalledWith({
        where: { email: 'del@test.com', token: 'del-token' },
      });
    });
  });

  // ========================================================================
  // deleteExpired — 모든 테이블에 대해 실행
  // ========================================================================

  describe('deleteExpired', () => {
    it('기본 설정에서 세 테이블 모두에 deleteMany를 호출해야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma);

      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
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

    it('커스텀 설정에서 세 커스텀 테이블 모두에 deleteMany를 호출해야 한다', async () => {
      const customConfig: PrismaAdapterConfig = {
        tokenTables: {
          emailVerification: 'email_tokens',
          passwordReset: 'custom_reset',
          magicLink: 'custom_magic',
        },
      };
      const repo = new PrismaEmailTokenRepository(mockPrisma, customConfig);

      mockPrisma.email_tokens.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.custom_reset.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.custom_magic.deleteMany.mockResolvedValue({ count: 0 });

      await repo.deleteExpired();

      expect(mockPrisma.email_tokens.deleteMany).toHaveBeenCalledWith({
        where: { expires: { lt: expect.any(Date) } },
      });
      expect(mockPrisma.custom_reset.deleteMany).toHaveBeenCalledWith({
        where: { expires: { lt: expect.any(Date) } },
      });
      expect(mockPrisma.custom_magic.deleteMany).toHaveBeenCalledWith({
        where: { expires: { lt: expect.any(Date) } },
      });
    });
  });

  // ========================================================================
  // 부분 커스텀 설정
  // ========================================================================

  describe('부분 커스텀 설정', () => {
    it('일부 테이블만 오버라이드하면 나머지는 기본값을 사용해야 한다', async () => {
      const partialConfig: PrismaAdapterConfig = {
        tokenTables: {
          emailVerification: 'email_tokens',
          // passwordReset, magicLink은 기본값 유지
        },
      };
      const repo = new PrismaEmailTokenRepository(mockPrisma, partialConfig);
      const expiresAt = new Date(Date.now() + 3600000);

      // 커스텀 테이블명 사용
      mockPrisma.email_tokens.create.mockResolvedValue({
        id: 'token-1', email: 'a@test.com', token: 'abc', expires: expiresAt, createdAt: new Date(),
      });
      await repo.create('a@test.com', 'abc', 'EMAIL_VERIFICATION' as any, expiresAt);
      expect(mockPrisma.email_tokens.create).toHaveBeenCalled();

      // 기본 테이블명 유지
      mockPrisma.passwordResetToken.create.mockResolvedValue({
        id: 'token-2', email: 'b@test.com', token: 'def', expires: expiresAt, createdAt: new Date(),
      });
      await repo.create('b@test.com', 'def', 'PASSWORD_RESET' as any, expiresAt);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();

      // 기본 테이블명 유지
      mockPrisma.magicLinkToken.create.mockResolvedValue({
        id: 'token-3', email: 'c@test.com', token: 'ghi', expires: expiresAt, used: false, createdAt: new Date(),
      });
      await repo.create('c@test.com', 'ghi', 'MAGIC_LINK' as any, expiresAt);
      expect(mockPrisma.magicLinkToken.create).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // findByEmailAndToken — null 반환
  // ========================================================================

  describe('findByEmailAndToken — null 반환', () => {
    it('토큰이 없으면 null을 반환해야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma);
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(null);

      const result = await repo.findByEmailAndToken('no@test.com', 'no-token', 'EMAIL_VERIFICATION' as any);

      expect(result).toBeNull();
    });
  });

  // ========================================================================
  // markAsUsed
  // ========================================================================

  describe('markAsUsed', () => {
    it('magicLink 테이블의 토큰을 used=true로 업데이트해야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma);
      mockPrisma.magicLinkToken.update.mockResolvedValue({});

      await repo.markAsUsed('token-id-1');

      expect(mockPrisma.magicLinkToken.update).toHaveBeenCalledWith({
        where: { id: 'token-id-1' },
        data: { used: true },
      });
    });

    it('커스텀 설정에서 커스텀 magicLink 테이블의 토큰을 업데이트해야 한다', async () => {
      const config: PrismaAdapterConfig = {
        tokenTables: { magicLink: 'custom_magic' },
      };
      const repo = new PrismaEmailTokenRepository(mockPrisma, config);
      mockPrisma.custom_magic.update.mockResolvedValue({});

      await repo.markAsUsed('token-id-2');

      expect(mockPrisma.custom_magic.update).toHaveBeenCalledWith({
        where: { id: 'token-id-2' },
        data: { used: true },
      });
    });
  });

  // ========================================================================
  // MAGIC_LINK create — used: false 자동 설정
  // ========================================================================

  describe('MAGIC_LINK 토큰 생성', () => {
    it('MAGIC_LINK 타입일 때 used: false를 data에 포함해야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma);
      const expiresAt = new Date(Date.now() + 3600000);

      mockPrisma.magicLinkToken.create.mockResolvedValue({
        id: 'ml-1', email: 'magic@test.com', token: 'magic-token',
        expires: expiresAt, used: false, createdAt: new Date(),
      });

      await repo.create('magic@test.com', 'magic-token', 'MAGIC_LINK' as any, expiresAt);

      expect(mockPrisma.magicLinkToken.create).toHaveBeenCalledWith({
        data: {
          email: 'magic@test.com',
          token: 'magic-token',
          expires: expiresAt,
          used: false,
        },
      });
    });

    it('EMAIL_VERIFICATION 타입일 때 used 필드를 포함하지 않아야 한다', async () => {
      const repo = new PrismaEmailTokenRepository(mockPrisma);
      const expiresAt = new Date(Date.now() + 3600000);

      mockPrisma.emailVerificationToken.create.mockResolvedValue({
        id: 'ev-1', email: 'verify@test.com', token: 'verify-token',
        expires: expiresAt, createdAt: new Date(),
      });

      await repo.create('verify@test.com', 'verify-token', 'EMAIL_VERIFICATION' as any, expiresAt);

      const callArgs = mockPrisma.emailVerificationToken.create.mock.calls[0][0];
      expect(callArgs.data).not.toHaveProperty('used');
    });
  });
});
