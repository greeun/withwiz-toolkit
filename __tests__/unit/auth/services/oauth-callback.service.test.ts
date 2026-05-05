import { OAuthCallbackService } from '../../../../src/auth/services/oauth-callback.service';
import type { UserRepository, OAuthAccountRepository } from '../../../../src/auth/types';

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

  it('should link to existing user if email matches', async () => {
    (mockOAuthRepo.findByProvider as any).mockResolvedValue(null);
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'email-user', email: 'oauth@test.com', role: 'USER', emailVerified: new Date(), isActive: true });

    const result = await service.handleCallback({
      provider: 'github',
      providerAccountId: 'gh-456',
      email: 'oauth@test.com',
      name: 'OAuth User',
      image: null,
      accessToken: 'at-456',
    });

    expect(result.isNewUser).toBe(false);
    expect(mockUserRepo.create).not.toHaveBeenCalled();
    expect(mockOAuthRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'email-user' }));
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
