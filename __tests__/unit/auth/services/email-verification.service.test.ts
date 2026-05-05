import { EmailVerificationService } from '../../../../src/auth/services/email-verification.service';
import type { UserRepository, EmailTokenRepository, EmailSender } from '../../../../src/auth/types';

const mockUserRepo: UserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateLastLoginAt: vi.fn(),
  verifyEmail: vi.fn(),
};

const mockTokenRepo: EmailTokenRepository = {
  create: vi.fn().mockResolvedValue({ token: 'ver-token' }),
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

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmailVerificationService({
      userRepository: mockUserRepo,
      emailTokenRepository: mockTokenRepo,
      emailSender: mockEmailSender,
    });
  });

  it('should verify email with valid token', async () => {
    (mockTokenRepo.findByEmailAndToken as any).mockResolvedValue({
      id: 't1', email: 'test@test.com', token: 'valid',
      expires: new Date(Date.now() + 60000), used: false,
    });

    await service.verify('test@test.com', 'valid');
    expect(mockUserRepo.verifyEmail).toHaveBeenCalledWith('test@test.com');
    expect(mockTokenRepo.delete).toHaveBeenCalled();
  });

  it('should throw for expired token', async () => {
    (mockTokenRepo.findByEmailAndToken as any).mockResolvedValue({
      id: 't1', email: 'test@test.com', token: 'expired',
      expires: new Date(Date.now() - 60000), used: false,
    });

    await expect(service.verify('test@test.com', 'expired')).rejects.toThrow('Invalid or expired');
  });

  it('should throw for null token record', async () => {
    (mockTokenRepo.findByEmailAndToken as any).mockResolvedValue(null);
    await expect(service.verify('test@test.com', 'bad')).rejects.toThrow('Invalid or expired');
  });

  it('should resend verification email', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'u1', email: 'test@test.com', emailVerified: null });
    await service.resend('test@test.com');
    expect(mockEmailSender.sendVerificationEmail).toHaveBeenCalled();
    expect(mockTokenRepo.create).toHaveBeenCalled();
  });

  it('should throw when resending to already verified email', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'u1', email: 'test@test.com', emailVerified: new Date() });
    await expect(service.resend('test@test.com')).rejects.toThrow('Email already verified');
  });

  it('should throw when resending to non-existent user', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue(null);
    await expect(service.resend('nobody@test.com')).rejects.toThrow('User not found');
  });
});
