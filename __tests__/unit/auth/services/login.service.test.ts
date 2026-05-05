import { LoginService } from '../../../../src/auth/services/login.service';
import type { UserRepository, Logger } from '../../../../src/auth/types';
import { hash } from 'bcryptjs';

const mockUserRepo: UserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateLastLoginAt: vi.fn(),
  verifyEmail: vi.fn(),
};

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('LoginService', () => {
  let service: LoginService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoginService({
      userRepository: mockUserRepo,
      jwtSecret: 'a'.repeat(32),
      accessTokenExpiry: '7d',
      refreshTokenExpiry: '30d',
      logger: mockLogger,
    });
  });

  it('should return tokens for valid credentials', async () => {
    const hashedPassword = await hash('password123', 10);
    (mockUserRepo.findByEmail as any).mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test',
      role: 'USER',
      emailVerified: new Date(),
      isActive: true,
    });

    const result = await service.login('test@test.com', 'password123', hashedPassword);
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(result.user.email).toBe('test@test.com');
    expect(mockUserRepo.updateLastLoginAt).toHaveBeenCalledWith('user-1');
  });

  it('should throw for invalid password', async () => {
    const hashedPassword = await hash('correct', 10);
    (mockUserRepo.findByEmail as any).mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      role: 'USER',
      emailVerified: new Date(),
      isActive: true,
    });

    await expect(service.login('test@test.com', 'wrong', hashedPassword)).rejects.toThrow('Invalid credentials');
  });

  it('should throw for non-existent user', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue(null);
    await expect(service.login('nobody@test.com', 'any', 'hash')).rejects.toThrow('Invalid credentials');
  });

  it('should throw for inactive user', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      role: 'USER',
      isActive: false,
    });

    await expect(service.login('test@test.com', 'any', 'hash')).rejects.toThrow('Account is disabled');
  });
});
