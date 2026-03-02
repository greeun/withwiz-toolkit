/**
 * @shared/auth/adapters/prisma
 *
 * Prisma ORM 어댑터 (데이터베이스 추상화 구현)
 * 타 프로젝트에서 재사용 가능
 *
 * Prisma 7부터 Generated Client가 프로젝트별 경로에 생성되므로,
 * 패키지 독립성을 위해 덕 타이핑(Duck Typing) 방식으로 PrismaClient를 받습니다.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = Record<string, any>;
import type {
  UserRepository,
  OAuthAccountRepository,
  EmailTokenRepository,
  BaseUser,
  CreateUserData,
  UpdateUserData,
  OAuthAccount,
  CreateOAuthAccountData,
  UpdateOAuthAccountData,
  EmailToken,
  TokenType,
  UserRole,
  OAuthProvider,
} from '@withwiz/auth/types';

// ============================================================================
// User Repository Implementation
// ============================================================================

export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClientLike) {}

  async findById(id: string): Promise<BaseUser | null> {
    const user = await (this.prisma as any).user.findUnique({ where: { id } });
    return user ? this.mapToBaseUser(user) : null;
  }

  async findByEmail(email: string): Promise<BaseUser | null> {
    const user = await (this.prisma as any).user.findUnique({ where: { email } });
    return user ? this.mapToBaseUser(user) : null;
  }

  async create(data: CreateUserData): Promise<BaseUser> {
    const user = await (this.prisma as any).user.create({
      data: {
        email: data.email,
        password: data.password || null,
        name: data.name || null,
        role: (data.role as any) || 'USER',
        emailVerified: data.emailVerified || null,
        image: data.image || null,
      },
    });
    return this.mapToBaseUser(user);
  }

  async update(id: string, data: UpdateUserData): Promise<BaseUser> {
    const user = await (this.prisma as any).user.update({
      where: { id },
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: data.role as any,
        emailVerified: data.emailVerified,
        isActive: data.isActive,
        image: data.image,
      },
    });
    return this.mapToBaseUser(user);
  }

  async delete(id: string): Promise<void> {
    await (this.prisma as any).user.delete({ where: { id } });
  }

  async updateLastLoginAt(id: string): Promise<void> {
    await (this.prisma as any).user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async verifyEmail(email: string): Promise<void> {
    await (this.prisma as any).user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });
  }

  private mapToBaseUser(user: any): BaseUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

// ============================================================================
// OAuth Account Repository Implementation
// ============================================================================

export class PrismaOAuthAccountRepository implements OAuthAccountRepository {
  constructor(private prisma: PrismaClientLike) {}

  async findByProvider(
    provider: OAuthProvider,
    providerAccountId: string
  ): Promise<OAuthAccount | null> {
    const account = await (this.prisma as any).account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: provider as string,
          providerAccountId,
        },
      },
      include: {
        token: true,
      },
    });
    return account ? this.mapToOAuthAccount(account) : null;
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    const accounts = await (this.prisma as any).account.findMany({
      where: { userId },
      include: {
        token: true,
      },
    });
    return accounts.map((a: any) => this.mapToOAuthAccount(a));
  }

  async create(data: CreateOAuthAccountData): Promise<OAuthAccount> {
    // Account와 AccountToken을 함께 생성
    const account = await (this.prisma as any).account.create({
      data: {
        userId: data.userId,
        type: 'oauth', // Account 모델의 type 필드
        provider: data.provider as string,
        providerAccountId: data.providerAccountId,
        token: data.accessToken || data.refreshToken ? {
          create: {
            accessToken: data.accessToken || null,
            refreshToken: data.refreshToken || null,
            expiresAt: data.expiresAt ? Math.floor(data.expiresAt.getTime() / 1000) : null,
            tokenType: data.tokenType || null,
            scope: data.scope || null,
          }
        } : undefined,
      },
      include: {
        token: true,
      },
    });
    return this.mapToOAuthAccount(account);
  }

  async update(id: string, data: UpdateOAuthAccountData): Promise<OAuthAccount> {
    const account = await (this.prisma as any).account.update({
      where: { id },
      data: {
        token: {
          upsert: {
            create: {
              accessToken: data.accessToken || null,
              refreshToken: data.refreshToken || null,
              expiresAt: data.expiresAt ? Math.floor(data.expiresAt.getTime() / 1000) : null,
              tokenType: data.tokenType || null,
              scope: data.scope || null,
            },
            update: {
              accessToken: data.accessToken || null,
              refreshToken: data.refreshToken || null,
              expiresAt: data.expiresAt ? Math.floor(data.expiresAt.getTime() / 1000) : null,
              tokenType: data.tokenType || null,
              scope: data.scope || null,
            }
          }
        }
      },
      include: {
        token: true,
      },
    });
    return this.mapToOAuthAccount(account);
  }

  async delete(id: string): Promise<void> {
    await (this.prisma as any).account.delete({ where: { id } });
  }

  private mapToOAuthAccount(account: any): OAuthAccount {
    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider as OAuthProvider,
      providerAccountId: account.providerAccountId,
      accessToken: account.token?.accessToken || null,
      refreshToken: account.token?.refreshToken || null,
      expiresAt: account.token?.expiresAt ? new Date(account.token.expiresAt * 1000) : null,
      tokenType: account.token?.tokenType || null,
      scope: account.token?.scope || null,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt || account.createdAt,
    };
  }
}

// ============================================================================
// Email Token Repository Implementation
// ============================================================================

export class PrismaEmailTokenRepository implements EmailTokenRepository {
  constructor(private prisma: PrismaClientLike) {}

  async create(
    email: string,
    token: string,
    type: TokenType,
    expiresAt: Date
  ): Promise<EmailToken> {
    let result: any;

    switch (type) {
      case 'EMAIL_VERIFICATION':
        result = await (this.prisma as any).emailVerificationToken.create({
          data: { email, token, expires: expiresAt },
        });
        break;
      case 'PASSWORD_RESET':
        result = await (this.prisma as any).passwordResetToken.create({
          data: { email, token, expires: expiresAt },
        });
        break;
      case 'MAGIC_LINK':
        result = await (this.prisma as any).magicLinkToken.create({
          data: { email, token, expires: expiresAt, used: false },
        });
        break;
      default:
        throw new Error(`Unsupported token type: ${type}`);
    }

    return {
      id: result.id,
      email: result.email,
      token: result.token,
      type: type as TokenType,
      expires: result.expires,
      used: result.used,
      createdAt: result.createdAt,
    };
  }

  async findByEmailAndToken(
    email: string,
    token: string,
    type: TokenType
  ): Promise<EmailToken | null> {
    let result: any;

    switch (type) {
      case 'EMAIL_VERIFICATION':
        result = await (this.prisma as any).emailVerificationToken.findFirst({
          where: { email, token },
        });
        break;
      case 'PASSWORD_RESET':
        result = await (this.prisma as any).passwordResetToken.findFirst({
          where: { email, token },
        });
        break;
      case 'MAGIC_LINK':
        result = await (this.prisma as any).magicLinkToken.findFirst({
          where: { email, token },
        });
        break;
      default:
        throw new Error(`Unsupported token type: ${type}`);
    }

    if (!result) return null;

    return {
      id: result.id,
      email: result.email,
      token: result.token,
      type,
      expires: result.expires,
      used: result.used,
      createdAt: result.createdAt,
    };
  }

  async delete(email: string, token: string, type: TokenType): Promise<void> {
    switch (type) {
      case 'EMAIL_VERIFICATION':
        await (this.prisma as any).emailVerificationToken.deleteMany({
          where: { email, token },
        });
        break;
      case 'PASSWORD_RESET':
        await (this.prisma as any).passwordResetToken.deleteMany({
          where: { email, token },
        });
        break;
      case 'MAGIC_LINK':
        await (this.prisma as any).magicLinkToken.deleteMany({
          where: { email, token },
        });
        break;
    }
  }

  async deleteExpired(): Promise<void> {
    const now = new Date();
    await Promise.all([
      (this.prisma as any).emailVerificationToken.deleteMany({
        where: { expires: { lt: now } },
      }),
      (this.prisma as any).passwordResetToken.deleteMany({
        where: { expires: { lt: now } },
      }),
      (this.prisma as any).magicLinkToken.deleteMany({
        where: { expires: { lt: now } },
      }),
    ]);
  }

  async markAsUsed(id: string): Promise<void> {
    await (this.prisma as any).magicLinkToken.update({
      where: { id },
      data: { used: true },
    });
  }
}
