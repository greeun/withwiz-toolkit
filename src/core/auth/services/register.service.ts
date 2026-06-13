import { hash } from 'bcryptjs';
import { TokenGenerator } from '@withwiz/toolkit/core/auth/email/token-generator';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { UserRepository, EmailTokenRepository, EmailSender, BaseUser, Logger } from '@withwiz/toolkit/core/auth/types';
import { TokenType } from '@withwiz/toolkit/core/auth/types';

export interface RegisterServiceConfig {
  userRepository: UserRepository;
  emailTokenRepository: EmailTokenRepository;
  emailSender?: EmailSender;
  emailVerificationRequired?: boolean;
  bcryptRounds?: number;
  logger?: Logger;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface RegisterResult {
  user: BaseUser;
  verificationSent: boolean;
}

export class RegisterService {
  private userRepo: UserRepository;
  private tokenRepo: EmailTokenRepository;
  private emailSender?: EmailSender;
  private emailVerificationRequired: boolean;
  private bcryptRounds: number;
  private logger: Logger;

  constructor(config: RegisterServiceConfig) {
    this.userRepo = config.userRepository;
    this.tokenRepo = config.emailTokenRepository;
    this.emailSender = config.emailSender;
    this.emailVerificationRequired = config.emailVerificationRequired ?? true;
    this.bcryptRounds = config.bcryptRounds ?? 12;
    this.logger = config.logger ?? { debug() {}, info() {}, warn() {}, error() {} };
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new AuthError('Email already in use', 'EMAIL_ALREADY_EXISTS', 409);
    }

    const hashedPassword = await hash(input.password, this.bcryptRounds);

    const user = await this.userRepo.create({
      email: input.email,
      password: hashedPassword,
      name: input.name ?? null,
      emailVerified: this.emailVerificationRequired ? null : new Date(),
    });

    let verificationSent = false;

    if (this.emailVerificationRequired && this.emailSender) {
      const token = TokenGenerator.generate();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      // DB 에는 해시만 저장하고 평문은 이메일로만 전달한다 (DB 유출 시 토큰 복원 방지)
      await this.tokenRepo.create(input.email, TokenGenerator.hash(token), TokenType.EMAIL_VERIFICATION, expires);
      await this.emailSender.sendVerificationEmail(input.email, token);
      verificationSent = true;
    }

    this.logger.info('User registered', { userId: user.id, email: input.email });
    return { user, verificationSent };
  }
}
