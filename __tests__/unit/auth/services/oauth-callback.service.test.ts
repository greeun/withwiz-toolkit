import { OAuthCallbackService } from '@withwiz/toolkit/core/auth/services/oauth-callback.service';
import type { UserRepository, OAuthAccountRepository } from '@withwiz/toolkit/core/auth/types';

const mockUserRepo: UserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn().mockResolvedValue({ id: 'new-user', email: 'oauth@test.com', name: 'OAuth User', role: 'USER', emailVerified: new Date() }),
  update: vi.fn(),
  delete: vi.fn(),
  updateLastLoginAt: vi.fn(),
  verifyEmail: vi.fn(),
};

const mockOAuthRepo: OAuthAccountRepository = {
  findByProvider: vi.fn(),
  findByUserId: vi.fn(),
  create: vi.fn().mockResolvedValue({ id: 'acc-1', userId: 'new-user', provider: 'google', providerAccountId: 'g-123' } as any),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('OAuthCallbackService', () => {
  let service: OAuthCallbackService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OAuthCallbackService({
      userRepository: mockUserRepo,
      oauthAccountRepository: mockOAuthRepo,
      jwtSecret: 'a'.repeat(32),
    });
  });

  it('should create new user on first OAuth login', async () => {
    (mockOAuthRepo.findByProvider as any).mockResolvedValue(null);
    (mockUserRepo.findByEmail as any).mockResolvedValue(null);

    const result = await service.handleCallback({
      provider: 'google',
      providerAccountId: 'g-123',
      email: 'oauth@test.com',
      name: 'OAuth User',
      image: null,
      accessToken: 'at-123',
    });

    expect(result.isNewUser).toBe(true);
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(mockUserRepo.create).toHaveBeenCalledTimes(1);
    expect(mockOAuthRepo.create).toHaveBeenCalledTimes(1);
  });

  it('should return existing user if OAuth account exists', async () => {
    (mockOAuthRepo.findByProvider as any).mockResolvedValue({ id: 'acc-1', userId: 'existing-user', provider: 'google', providerAccountId: 'g-123' });
    (mockUserRepo.findById as any).mockResolvedValue({ id: 'existing-user', email: 'oauth@test.com', role: 'USER', emailVerified: new Date(), isActive: true });

    const result = await service.handleCallback({
      provider: 'google',
      providerAccountId: 'g-123',
      email: 'oauth@test.com',
      name: 'OAuth User',
      image: null,
      accessToken: 'at-123',
    });

    expect(result.isNewUser).toBe(false);
    expect(mockUserRepo.create).not.toHaveBeenCalled();
    expect(mockOAuthRepo.update).toHaveBeenCalled();
  });

  it('should link to existing user if email matches and provider email is verified', async () => {
    (mockOAuthRepo.findByProvider as any).mockResolvedValue(null);
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'email-user', email: 'oauth@test.com', role: 'USER', emailVerified: new Date(), isActive: true });

    const result = await service.handleCallback({
      provider: 'github',
      providerAccountId: 'gh-456',
      email: 'oauth@test.com',
      name: 'OAuth User',
      image: null,
      accessToken: 'at-456',
      emailVerified: true,
    });

    expect(result.isNewUser).toBe(false);
    expect(mockUserRepo.create).not.toHaveBeenCalled();
    expect(mockOAuthRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'email-user' }));
  });

  it('should block linking to an existing account when the provider email is NOT verified', async () => {
    (mockOAuthRepo.findByProvider as any).mockResolvedValue(null);
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'victim-user', email: 'victim@test.com', role: 'USER', emailVerified: new Date(), isActive: true });

    // 공격자가 피해자 이메일을 미검증 상태로 주장 → 기존 계정 연결은 탈취이므로 차단
    await expect(service.handleCallback({
      provider: 'github',
      providerAccountId: 'attacker-789',
      email: 'victim@test.com',
      name: 'Attacker',
      image: null,
      accessToken: 'at-789',
      emailVerified: false,
    })).rejects.toThrow('not verified');

    // 연결(account create)이 일어나지 않아야 한다
    expect(mockOAuthRepo.create).not.toHaveBeenCalled();
  });

  it('should block linking when emailVerified is omitted (strict default)', async () => {
    (mockOAuthRepo.findByProvider as any).mockResolvedValue(null);
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'victim-user', email: 'victim@test.com', role: 'USER', emailVerified: new Date(), isActive: true });

    await expect(service.handleCallback({
      provider: 'github',
      providerAccountId: 'attacker-789',
      email: 'victim@test.com',
      name: 'Attacker',
      image: null,
      accessToken: 'at-789',
    })).rejects.toThrow('not verified');
    expect(mockOAuthRepo.create).not.toHaveBeenCalled();
  });

  it('should throw for disabled user', async () => {
    (mockOAuthRepo.findByProvider as any).mockResolvedValue({ id: 'acc-1', userId: 'disabled-user' });
    (mockUserRepo.findById as any).mockResolvedValue({ id: 'disabled-user', email: 'test@test.com', isActive: false });

    await expect(service.handleCallback({
      provider: 'google',
      providerAccountId: 'g-123',
      email: 'test@test.com',
      name: null,
      image: null,
      accessToken: 'at',
    })).rejects.toThrow('Account is disabled');
  });
});
