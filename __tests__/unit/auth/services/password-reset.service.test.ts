import { createHash } from 'crypto';
import { PasswordResetService } from '@withwiz/toolkit/core/auth/services/password-reset.service';
import type { UserRepository, EmailTokenRepository, EmailSender } from '@withwiz/toolkit/core/auth/types';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

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
  create: vi.fn().mockResolvedValue({ token: 'reset-token' }),
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

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PasswordResetService({
      userRepository: mockUserRepo,
      emailTokenRepository: mockTokenRepo,
      emailSender: mockEmailSender,
    });
  });

  it('should send reset email for existing user', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
    await service.requestReset('test@test.com');
    expect(mockEmailSender.sendPasswordResetEmail).toHaveBeenCalledWith('test@test.com', expect.any(String));
    expect(mockTokenRepo.create).toHaveBeenCalled();
  });

  it('should not throw for non-existing email (prevent enumeration)', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue(null);
    await expect(service.requestReset('noone@test.com')).resolves.not.toThrow();
    expect(mockEmailSender.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should reset password with valid token', async () => {
    (mockTokenRepo.findByEmailAndToken as any).mockResolvedValue({
      id: 't1', email: 'test@test.com', token: 'valid',
      expires: new Date(Date.now() + 60000), used: false,
    });
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'u1', email: 'test@test.com' });

    await service.resetPassword('test@test.com', 'valid', 'NewPass123!');
    expect(mockUserRepo.update).toHaveBeenCalled();
    expect(mockTokenRepo.delete).toHaveBeenCalled();
  });

  it('requestReset() should store the hashed token but email the plaintext', async () => {
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'u1', email: 'test@test.com' });

    await service.requestReset('test@test.com');

    const storedToken = (mockTokenRepo.create as any).mock.calls[0][1];
    const emailedToken = (mockEmailSender.sendPasswordResetEmail as any).mock.calls[0][1];
    expect(storedToken).toBe(sha256(emailedToken));
    expect(storedToken).not.toBe(emailedToken);
  });

  it('resetPassword() should look up and delete the token by its hash', async () => {
    (mockTokenRepo.findByEmailAndToken as any).mockResolvedValue({
      id: 't1', email: 'test@test.com', token: sha256('plain-reset'),
      expires: new Date(Date.now() + 60000), used: false,
    });
    (mockUserRepo.findByEmail as any).mockResolvedValue({ id: 'u1', email: 'test@test.com' });

    await service.resetPassword('test@test.com', 'plain-reset', 'NewPass123!');

    expect((mockTokenRepo.findByEmailAndToken as any).mock.calls[0][1]).toBe(sha256('plain-reset'));
    expect((mockTokenRepo.delete as any).mock.calls[0][1]).toBe(sha256('plain-reset'));
  });

  it('should throw for expired token', async () => {
    (mockTokenRepo.findByEmailAndToken as any).mockResolvedValue({
      id: 't1', email: 'test@test.com', token: 'expired',
      expires: new Date(Date.now() - 60000), used: false,
    });

    await expect(service.resetPassword('test@test.com', 'expired', 'New1!')).rejects.toThrow('Invalid or expired token');
  });

  it('should throw for invalid token', async () => {
    (mockTokenRepo.findByEmailAndToken as any).mockResolvedValue(null);
    await expect(service.resetPassword('test@test.com', 'invalid', 'New1!')).rejects.toThrow('Invalid or expired token');
  });
});
