import { TokenGenerator } from '../core/email/token-generator';
import { AuthError } from '../errors';
import type { UserRepository, EmailTokenRepository, EmailSender, Logger } from '../types';
import { TokenType } from '../types';

export interface EmailVerificationServiceConfig {
  userRepository: UserRepository;
  emailTokenRepository: EmailTokenRepository;
  emailSender: EmailSender;
  tokenExpiryHours?: number;
  logger?: Logger;
}

export class EmailVerificationService {
  private userRepo: UserRepository;
  private tokenRepo: EmailTokenRepository;
  private emailSender: EmailSender;
  private tokenExpiryHours: number;
  private logger: Logger;

  constructor(config: EmailVerificationServiceConfig) {
    this.userRepo = config.userRepository;
    this.tokenRepo = config.emailTokenRepository;
    this.emailSender = config.emailSender;
    this.tokenExpiryHours = config.tokenExpiryHours ?? 24;
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async verify(email: string, token: string): Promise<void> {
    const tokenRecord = await this.tokenRepo.findByEmailAndToken(email, token, TokenType.EMAIL_VERIFICATION);

    if (!tokenRecord || tokenRecord.expires < new Date()) {
      throw new AuthError('Invalid or expired verification token', 'TOKEN_INVALID', 400);
    }

    await this.userRepo.verifyEmail(email);
    await this.tokenRepo.delete(email, token, TokenType.EMAIL_VERIFICATION);
    this.logger.info('Email verified', { email });
  }

  async resend(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (user.emailVerified) {
      throw new AuthError('Email already verified', 'EMAIL_ALREADY_VERIFIED', 400);
    }

    const token = TokenGenerator.generate();
    const expires = new Date(Date.now() + this.tokenExpiryHours * 60 * 60 * 1000);
    await this.tokenRepo.create(email, token, TokenType.EMAIL_VERIFICATION, expires);
    await this.emailSender.sendVerificationEmail(email, token);
    this.logger.info('Verification email resent', { email });
  }
}
