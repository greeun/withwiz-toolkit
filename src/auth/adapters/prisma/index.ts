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
} from '@withwiz/auth/types';

export interface PrismaAdapterConfig {
  tokenTables?: {
    emailVerification?: string;
    passwordReset?: string;
    magicLink?: string;
  };
  userFields?: {
    password?: string;
    emailVerified?: string;
    role?: string;
    image?: string;
  };
}

type ResolvedPrismaAdapterConfig = {
  tokenTables: Required<NonNullable<PrismaAdapterConfig['tokenTables']>>;
  userFields: Required<NonNullable<PrismaAdapterConfig['userFields']>>;
};

const DEFAULT_CONFIG: ResolvedPrismaAdapterConfig = {
  tokenTables: {
    emailVerification: 'emailVerificationToken',
    passwordReset: 'passwordResetToken',
    magicLink: 'magicLinkToken',
  },
  userFields: {
    password: 'password',
    emailVerified: 'emailVerified',
    role: 'role',
    image: 'image',
  },
};

function mergeConfig(config?: PrismaAdapterConfig): ResolvedPrismaAdapterConfig {
  return {
    tokenTables: { ...DEFAULT_CONFIG.tokenTables, ...config?.tokenTables },
    userFields: { ...DEFAULT_CONFIG.userFields, ...config?.userFields },
  };
}

// ============================================================================
// User Repository Implementation
// ============================================================================

export class PrismaUserRepository implements UserRepository {
  private config: ResolvedPrismaAdapterConfig;

  constructor(private prisma: PrismaClientLike, config?: PrismaAdapterConfig) {
    this.config = mergeConfig(config);
  }

  async findById(id: string): Promise<BaseUser | null> {
    const user = await (this.prisma as any).user.findUnique({ where: { id } });
    return user ? this.mapToBaseUser(user) : null;
  }

  async findByEmail(email: string): Promise<BaseUser | null> {
    const user = await (this.prisma as any).user.findUnique({ where: { email } });
    if (!user) return null;
    // Include password hash on the returned object for auth handler compatibility.
    // The login handler accesses (user as any).password for bcrypt comparison.
    const baseUser = this.mapToBaseUser(user);
    return Object.assign(baseUser, { password: user[this.config.userFields.password] ?? null });
  }

  async create(data: CreateUserData): Promise<BaseUser> {
    const createData: Record<string, unknown> = {
      email: data.email,
      name: data.name || null,
    };
    // Use configured field names for write operations
    createData[this.config.userFields.password] = data.password || null;
    if (this.config.userFields.role !== 'role' || data.role) {
      createData[this.config.userFields.role] = (data.role as any) || 'USER';
    }
    createData[this.config.userFields.emailVerified] = data.emailVerified || null;
    createData[this.config.userFields.image] = data.image || null;

    const user = await (this.prisma as any).user.create({ data: createData });
    return this.mapToBaseUser(user);
  }

  async update(id: string, data: UpdateUserData): Promise<BaseUser> {
    const updateData: Record<string, unknown> = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    // Use configured field names for write operations
    if (data.password !== undefined) updateData[this.config.userFields.password] = data.password;
    if (data.role !== undefined) updateData[this.config.userFields.role] = data.role as any;
    if (data.emailVerified !== undefined) updateData[this.config.userFields.emailVerified] = data.emailVerified;
    if (data.image !== undefined) updateData[this.config.userFields.image] = data.image;

    const user = await (this.prisma as any).user.update({ where: { id }, data: updateData });
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
      role: user[this.config.userFields.role],
      emailVerified: user[this.config.userFields.emailVerified],
      isActive: user.isActive,
      image: user[this.config.userFields.image],
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
    provider: string,
    providerAccountId: string
  ): Promise<OAuthAccount | null> {
    const account = await (this.prisma as any).account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
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
        provider: data.provider,
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
      provider: account.provider,
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
  private config: ResolvedPrismaAdapterConfig;

  constructor(private prisma: PrismaClientLike, config?: PrismaAdapterConfig) {
    this.config = mergeConfig(config);
  }

  private getTokenTable(type: TokenType): string {
    switch (type) {
      case 'EMAIL_VERIFICATION': return this.config.tokenTables.emailVerification;
      case 'PASSWORD_RESET': return this.config.tokenTables.passwordReset;
      case 'MAGIC_LINK': return this.config.tokenTables.magicLink;
      default: throw new Error(`Unsupported token type: ${type}`);
    }
  }

  async create(
    email: string,
    token: string,
    type: TokenType,
    expiresAt: Date
  ): Promise<EmailToken> {
    const tableName = this.getTokenTable(type);
    const data: any = { email, token, expires: expiresAt };
    if (type === 'MAGIC_LINK') data.used = false;

    const result = await (this.prisma as any)[tableName].create({ data });

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

  async findByEmailAndToken(
    email: string,
    token: string,
    type: TokenType
  ): Promise<EmailToken | null> {
    const tableName = this.getTokenTable(type);
    const result = await (this.prisma as any)[tableName].findFirst({
      where: { email, token },
    });

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
    const tableName = this.getTokenTable(type);
    await (this.prisma as any)[tableName].deleteMany({
      where: { email, token },
    });
  }

  async deleteExpired(): Promise<void> {
    const now = new Date();
    await Promise.all([
      (this.prisma as any)[this.config.tokenTables.emailVerification].deleteMany({
        where: { expires: { lt: now } },
      }),
      (this.prisma as any)[this.config.tokenTables.passwordReset].deleteMany({
        where: { expires: { lt: now } },
      }),
      (this.prisma as any)[this.config.tokenTables.magicLink].deleteMany({
        where: { expires: { lt: now } },
      }),
    ]);
  }

  async markAsUsed(id: string): Promise<void> {
    await (this.prisma as any)[this.config.tokenTables.magicLink].update({
      where: { id },
      data: { used: true },
    });
  }
}
