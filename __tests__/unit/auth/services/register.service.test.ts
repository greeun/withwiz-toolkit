import { RegisterService } from '../../../../src/auth/services/register.service';
import type { UserRepository, EmailTokenRepository, EmailSender } from '../../../../src/auth/types';

const mockUserRepo: UserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: 'new-user', email: 'new@test.com', name: 'New', role: 'USER' }),
  update: vi.fn(),
  delete: vi.fn(),
  updateLastLoginAt: vi.fn(),
  verifyEmail: vi.fn(),
};

const mockTokenRepo: EmailTokenRepository = {
  create: vi.fn().mockResolvedValue({ id: 't1', email: 'new@test.com', token: 'abc', type: 'EMAIL_VERIFICATION', expires: new Date(), used: false, createdAt: new Date() }),
  findByEmailAndToken: vi.fn(),
  delete: vi.fn(),
  deleteExpired: vi.fn(),
  markAsUsed: vi.fn(),
};

const mockEmailSender: EmailSender = {
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendMagicLinkEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
};

describe('RegisterService', () => {
  let service: RegisterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RegisterService({
      userRepository: mockUserRepo,
      emailTokenRepository: mockTokenRepo,
      emailSender: mockEmailSender,
      emailVerificationRequired: true,
    });
  });

  it('should create user and send verification email', async () => {
    const result = await service.register({
      email: 'new@test.com',
      password: 'StrongPass1!',
      name: 'New User',
    });

    expect(result.user.email).toBe('new@test.com');
    expect(result.verificationSent).toBe(true);
    expect(mockUserRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEmailSender.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('should throw if email already exists', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValueOnce({ id: 'existing', email: 'new@test.com' });

    await expect(service.register({
      email: 'new@test.com',
      password: 'StrongPass1!',
    })).rejects.toThrow('Email already in use');
  });

  it('should skip verification email if not required', async () => {
    service = new RegisterService({
      userRepository: mockUserRepo,
      emailTokenRepository: mockTokenRepo,
      emailSender: mockEmailSender,
      emailVerificationRequired: false,
    });

    const result = await service.register({ email: 'new@test.com', password: 'StrongPass1!' });
    expect(result.verificationSent).toBe(false);
    expect(mockEmailSender.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('should hash password before storing', async () => {
    await service.register({ email: 'new@test.com', password: 'MyPassword123' });

    const createCall = (mockUserRepo.create as any).mock.calls[0][0];
    expect(createCall.password).not.toBe('MyPassword123');
    expect(createCall.password.startsWith('$2')).toBe(true); // bcrypt hash prefix
  });
});
