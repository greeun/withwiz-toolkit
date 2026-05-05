import { TokenRefreshService } from '../../../../src/auth/services/token-refresh.service';
import { JWTService } from '../../../../src/auth/core/jwt';
import type { UserRepository } from '../../../../src/auth/types';

const jwtSecret = 'a'.repeat(32);

const mockUserRepo: UserRepository = {
  findById: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com', role: 'USER', emailVerified: new Date(), isActive: true }),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateLastLoginAt: vi.fn(),
  verifyEmail: vi.fn(),
};

describe('TokenRefreshService', () => {
  let service: TokenRefreshService;
  let jwtService: JWTService;

  beforeEach(() => {
    vi.clearAllMocks();
    jwtService = new JWTService({ secret: jwtSecret, accessTokenExpiry: '7d', refreshTokenExpiry: '30d', algorithm: 'HS256' });
    service = new TokenRefreshService({
      userRepository: mockUserRepo,
      jwtSecret,
    });
  });

  it('should issue new access token from valid refresh token', async () => {
    const refreshToken = await jwtService.createRefreshToken('user-1');
    const result = await service.refresh(refreshToken);
    expect(result.accessToken).toBeDefined();
    expect(result.user.id).toBe('user-1');
    expect(result.user.email).toBe('test@test.com');
  });

  it('should throw for inactive user', async () => {
    (mockUserRepo.findById as any).mockResolvedValueOnce({ id: 'user-1', email: 'test@test.com', isActive: false });
    const refreshToken = await jwtService.createRefreshToken('user-1');
    await expect(service.refresh(refreshToken)).rejects.toThrow('Account is disabled');
  });

  it('should throw for blacklisted token', async () => {
    service = new TokenRefreshService({
      userRepository: mockUserRepo,
      jwtSecret,
      isTokenBlacklisted: async () => true,
    });
    const refreshToken = await jwtService.createRefreshToken('user-1');
    await expect(service.refresh(refreshToken)).rejects.toThrow('Token has been revoked');
  });

  it('should throw for non-existent user', async () => {
    (mockUserRepo.findById as any).mockResolvedValueOnce(null);
    const refreshToken = await jwtService.createRefreshToken('user-1');
    await expect(service.refresh(refreshToken)).rejects.toThrow('User not found');
  });
});
