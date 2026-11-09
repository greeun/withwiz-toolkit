/**
 * Prisma MFA 저장소 어댑터.
 * PrismaClient 는 index.ts 와 같이 덕 타이핑으로 받는다.
 */
import type { MfaRepository, UserMfaRecord } from '@withwiz/toolkit/core/auth/mfa/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = Record<string, any>;

export interface PrismaMfaRepositoryConfig {
  /** 기본 'userMfa' */
  userMfaModel?: string;
  /** 기본 'mfaRecoveryCode' */
  recoveryCodeModel?: string;
}

export class PrismaMfaRepository implements MfaRepository {
  private readonly userMfaModel: string;
  private readonly recoveryCodeModel: string;

  constructor(
    private readonly prisma: PrismaClientLike,
    config: PrismaMfaRepositoryConfig = {},
  ) {
    this.userMfaModel = config.userMfaModel ?? 'userMfa';
    this.recoveryCodeModel = config.recoveryCodeModel ?? 'mfaRecoveryCode';
  }

  async findByUserId(userId: string): Promise<UserMfaRecord | null> {
    const row = await this.prisma[this.userMfaModel].findUnique({ where: { userId } });
    if (!row) return null;
    return {
      userId: row.userId,
      secretEnc: row.secretEnc,
      enabledAt: row.enabledAt ?? null,
      lastUsedStep: row.lastUsedStep ?? null,
    };
  }

  async savePendingSecret(userId: string, secretEnc: string): Promise<void> {
    await this.prisma.$transaction(async (tx: PrismaClientLike) => {
      await tx[this.userMfaModel].upsert({
        where: { userId },
        create: { userId, secretEnc, enabledAt: null, lastUsedStep: null },
        update: { secretEnc, enabledAt: null, lastUsedStep: null },
      });
      await tx[this.recoveryCodeModel].deleteMany({ where: { userId } });
    });
  }

  async enable(userId: string, recoveryCodeHashes: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx: PrismaClientLike) => {
      await tx[this.recoveryCodeModel].deleteMany({ where: { userId } });
      await tx[this.recoveryCodeModel].createMany({
        data: recoveryCodeHashes.map((codeHash) => ({ userId, codeHash })),
      });
      await tx[this.userMfaModel].update({
        where: { userId },
        data: { enabledAt: new Date() },
      });
    });
  }

  async disable(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx: PrismaClientLike) => {
      await tx[this.recoveryCodeModel].deleteMany({ where: { userId } });
      await tx[this.userMfaModel].deleteMany({ where: { userId } });
    });
  }

  async markStepUsed(userId: string, step: number): Promise<boolean> {
    const res = await this.prisma[this.userMfaModel].updateMany({
      where: { userId, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
      data: { lastUsedStep: step },
    });
    return res.count === 1;
  }

  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const res = await this.prisma[this.recoveryCodeModel].updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    return res.count === 1;
  }

  async replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx: PrismaClientLike) => {
      await tx[this.recoveryCodeModel].deleteMany({ where: { userId } });
      await tx[this.recoveryCodeModel].createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      });
    });
  }

  async countUnusedRecoveryCodes(userId: string): Promise<number> {
    return this.prisma[this.recoveryCodeModel].count({ where: { userId, usedAt: null } });
  }
}
