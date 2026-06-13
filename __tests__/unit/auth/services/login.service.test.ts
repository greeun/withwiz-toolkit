import { LoginService } from '@withwiz/toolkit/core/auth/services/login.service';
import type { UserRepository, Logger } from '@withwiz/toolkit/core/auth/types';

// compare 를 실제 구현으로 래핑한 spy 로 교체 — 호출 추적은 하되 동작은 보존
vi.mock('bcryptjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('bcryptjs')>();
  return { ...actual, default: actual, compare: vi.fn(actual.compare) };
});
import { hash, compare as mockedCompare } from 'bcryptjs';

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

  it('should perform a dummy bcrypt comparison for a non-existent user (timing equalization)', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue(null);

    await expect(service.login('nobody@test.com', 'any', 'hash')).rejects.toThrow('Invalid credentials');
    // 미존재 계정도 bcrypt.compare 를 수행해 응답 시간을 균일화한다 (계정 enumeration 방지)
    expect(mockedCompare).toHaveBeenCalledTimes(1);
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

  describe('with pluggable passwordHasher', () => {
    const activeUser = {
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test',
      role: 'USER',
      emailVerified: new Date(),
      isActive: true,
    };

    // verify 만 true 를 돌려주는 가짜 해셔. needsRehash 는 케이스별로 조정.
    const makeHasher = (needsRehash: boolean, verifyResult = true) => ({
      id: 'fake',
      identifies: vi.fn(() => true),
      hash: vi.fn(async () => 'rehashed-value'),
      verify: vi.fn(async () => verifyResult),
      needsRehash: vi.fn(() => needsRehash),
    });

    it('uses the injected hasher for verification instead of bcrypt', async () => {
      const hasher = makeHasher(false);
      const svc = new LoginService({
        userRepository: mockUserRepo,
        jwtSecret: 'a'.repeat(32),
        passwordHasher: hasher,
        logger: mockLogger,
      });
      (mockUserRepo.findByEmail as any).mockResolvedValue(activeUser);

      const result = await svc.login('test@test.com', 'pw', 'legacy$hash');
      expect(hasher.verify).toHaveBeenCalledWith('pw', 'legacy$hash');
      expect(mockedCompare).not.toHaveBeenCalled();
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('returns rehashedPassword when the stored hash needs rehashing', async () => {
      const hasher = makeHasher(true);
      const svc = new LoginService({
        userRepository: mockUserRepo,
        jwtSecret: 'a'.repeat(32),
        passwordHasher: hasher,
        logger: mockLogger,
      });
      (mockUserRepo.findByEmail as any).mockResolvedValue(activeUser);

      const result = await svc.login('test@test.com', 'pw', 'legacy$hash');
      expect(hasher.needsRehash).toHaveBeenCalledWith('legacy$hash');
      expect(hasher.hash).toHaveBeenCalledWith('pw');
      expect(result.rehashedPassword).toBe('rehashed-value');
    });

    it('omits rehashedPassword when the stored hash is current', async () => {
      const hasher = makeHasher(false);
      const svc = new LoginService({
        userRepository: mockUserRepo,
        jwtSecret: 'a'.repeat(32),
        passwordHasher: hasher,
        logger: mockLogger,
      });
      (mockUserRepo.findByEmail as any).mockResolvedValue(activeUser);

      const result = await svc.login('test@test.com', 'pw', '$2b$12$current');
      expect(result.rehashedPassword).toBeUndefined();
      expect(hasher.hash).not.toHaveBeenCalled();
    });

    it('burns equivalent work via hasher.hash for a non-existent user (timing equalization)', async () => {
      const hasher = makeHasher(false);
      const svc = new LoginService({
        userRepository: mockUserRepo,
        jwtSecret: 'a'.repeat(32),
        passwordHasher: hasher,
        logger: mockLogger,
      });
      (mockUserRepo.findByEmail as any).mockResolvedValue(null);

      await expect(svc.login('nobody@test.com', 'pw', 'hash')).rejects.toThrow('Invalid credentials');
      // 미존재 계정도 동일 스킴으로 해싱해 타이밍을 균일화한다 (bcrypt 폴백 미사용)
      expect(hasher.hash).toHaveBeenCalledWith('pw');
      expect(mockedCompare).not.toHaveBeenCalled();
    });
  });
});
