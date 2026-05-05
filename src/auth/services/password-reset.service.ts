import { hash } from 'bcryptjs';
import { TokenGenerator } from '../core/email/token-generator';
import { AuthError } from '../errors';
import type { UserRepository, EmailTokenRepository, EmailSender, Logger } from '../types';
import { TokenType } from '../types';

export interface PasswordResetServiceConfig {
  userRepository: UserRepository;
  emailTokenRepository: EmailTokenRepository;
  emailSender: EmailSender;
  tokenExpiryHours?: number;
  bcryptRounds?: number;
  logger?: Logger;
}

export class PasswordResetService {
  private userRepo: UserRepository;
  private tokenRepo: EmailTokenRepository;
  private emailSender: EmailSender;
  private tokenExpiryHours: number;
  private bcryptRounds: number;
  private logger: Logger;

  constructor(config: PasswordResetServiceConfig) {
    this.userRepo = config.userRepository;
    this.tokenRepo = config.emailTokenRepository;
    this.emailSender = config.emailSender;
    this.tokenExpiryHours = config.tokenExpiryHours ?? 1;
    this.bcryptRounds = config.bcryptRounds ?? 12;
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async requestReset(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return; // silent - prevent email enumeration

    const token = TokenGenerator.generate();
    const expires = new Date(Date.now() + this.tokenExpiryHours * 60 * 60 * 1000);
    await this.tokenRepo.create(email, token, TokenType.PASSWORD_RESET, expires);
    await this.emailSender.sendPasswordResetEmail(email, token);
    this.logger.info('Password reset requested', { email });
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    const tokenRecord = await this.tokenRepo.findByEmailAndToken(email, token, TokenType.PASSWORD_RESET);

    if (!tokenRecord || tokenRecord.expires < new Date()) {
      throw new AuthError('Invalid or expired token', 'TOKEN_INVALID', 400);
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }

    const hashedPassword = await hash(newPassword, this.bcryptRounds);
    await this.userRepo.update(user.id, { password: hashedPassword });
    await this.tokenRepo.delete(email, token, TokenType.PASSWORD_RESET);
    this.logger.info('Password reset completed', { userId: user.id });
  }
}
