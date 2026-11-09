import { describe, it, expect, vi } from 'vitest';
import { PrismaMfaRepository } from '@withwiz/toolkit/prisma/auth-adapter';

function createMockPrisma() {
  const calls: string[] = [];
  const mk = (name: string, ret?: unknown) =>
    vi.fn(async () => {
      calls.push(name);
      return ret;
    });
  const model = () => ({
    findUnique: vi.fn(),
    upsert: mk('upsert'),
    update: mk('update'),
    updateMany: vi.fn(),
    deleteMany: mk('deleteMany'),
    createMany: mk('createMany'),
    count: vi.fn(),
  });
  const prisma: any = {
    userMfa: model(),
    mfaRecoveryCode: model(),
    custMfa: model(),
    custCodes: model(),
  };
  prisma.$transaction = vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma));
  return { prisma, calls };
}

describe('PrismaMfaRepository', () => {
  it('findByUserId 는 레코드를 매핑하고 없으면 null', async () => {
    const { prisma } = createMockPrisma();
    const repo = new PrismaMfaRepository(prisma);
    prisma.userMfa.findUnique.mockResolvedValueOnce(null);
    expect(await repo.findByUserId('u')).toBeNull();
    const d = new Date();
    prisma.userMfa.findUnique.mockResolvedValueOnce({ userId: 'u', secretEnc: 's', enabledAt: d, lastUsedStep: 3, createdAt: d });
    expect(await repo.findByUserId('u')).toEqual({ userId: 'u', secretEnc: 's', enabledAt: d, lastUsedStep: 3 });
  });

  it('savePendingSecret 은 upsert(enabledAt/lastUsedStep null) 후 복구 코드 삭제', async () => {
    const { prisma } = createMockPrisma();
    await new PrismaMfaRepository(prisma).savePendingSecret('u', 'enc');
    const arg = prisma.userMfa.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u' });
    expect(arg.create).toMatchObject({ userId: 'u', secretEnc: 'enc', enabledAt: null, lastUsedStep: null });
    expect(arg.update).toMatchObject({ secretEnc: 'enc', enabledAt: null, lastUsedStep: null });
    expect(prisma.mfaRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u' } });
  });

  it('savePendingSecret 은 한 $transaction 안에서 upsert→deleteMany', async () => {
    const { prisma, calls } = createMockPrisma();
    await new PrismaMfaRepository(prisma).savePendingSecret('u', 'enc');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['upsert', 'deleteMany']);
  });

  it('enable 은 $transaction 안에서 deleteMany→createMany→update 순', async () => {
    const { prisma, calls } = createMockPrisma();
    await new PrismaMfaRepository(prisma).enable('u', ['h1', 'h2']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['deleteMany', 'createMany', 'update']);
    expect(prisma.mfaRecoveryCode.createMany.mock.calls[0][0].data).toEqual([
      { userId: 'u', codeHash: 'h1' },
      { userId: 'u', codeHash: 'h2' },
    ]);
    const upd = prisma.userMfa.update.mock.calls[0][0];
    expect(upd.where).toEqual({ userId: 'u' });
    expect(upd.data.enabledAt).toBeInstanceOf(Date);
  });

  it('disable 은 복구 코드와 UserMfa 삭제', async () => {
    const { prisma } = createMockPrisma();
    await new PrismaMfaRepository(prisma).disable('u');
    expect(prisma.mfaRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u' } });
    expect(prisma.userMfa.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u' } });
  });

  it('disable 의 두 삭제는 한 $transaction 안에서 실행된다', async () => {
    const { prisma, calls } = createMockPrisma();
    await new PrismaMfaRepository(prisma).disable('u');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['deleteMany', 'deleteMany']);
  });

  it('markStepUsed: count 1 → true, 0 → false, where 에 lt: step', async () => {
    const { prisma } = createMockPrisma();
    const repo = new PrismaMfaRepository(prisma);
    prisma.userMfa.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await repo.markStepUsed('u', 7)).toBe(true);
    const arg = prisma.userMfa.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u', OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: 7 } }] });
    expect(arg.data).toEqual({ lastUsedStep: 7 });
    prisma.userMfa.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await repo.markStepUsed('u', 7)).toBe(false);
  });

  it('consumeRecoveryCode: where 에 usedAt: null, count 로 판정', async () => {
    const { prisma } = createMockPrisma();
    const repo = new PrismaMfaRepository(prisma);
    prisma.mfaRecoveryCode.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await repo.consumeRecoveryCode('u', 'h')).toBe(true);
    const arg = prisma.mfaRecoveryCode.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u', codeHash: 'h', usedAt: null });
    expect(arg.data.usedAt).toBeInstanceOf(Date);
    prisma.mfaRecoveryCode.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await repo.consumeRecoveryCode('u', 'h')).toBe(false);
  });

  it('replaceRecoveryCodes 는 deleteMany→createMany, countUnused 는 usedAt: null 카운트', async () => {
    const { prisma, calls } = createMockPrisma();
    const repo = new PrismaMfaRepository(prisma);
    await repo.replaceRecoveryCodes('u', ['a']);
    expect(calls).toEqual(['deleteMany', 'createMany']);
    prisma.mfaRecoveryCode.count.mockResolvedValueOnce(4);
    expect(await repo.countUnusedRecoveryCodes('u')).toBe(4);
    expect(prisma.mfaRecoveryCode.count).toHaveBeenCalledWith({ where: { userId: 'u', usedAt: null } });
  });

  it('모델 이름 설정이 반영된다', async () => {
    const { prisma } = createMockPrisma();
    const repo = new PrismaMfaRepository(prisma, { userMfaModel: 'custMfa', recoveryCodeModel: 'custCodes' });
    await repo.disable('u');
    expect(prisma.custMfa.deleteMany).toHaveBeenCalled();
    expect(prisma.custCodes.deleteMany).toHaveBeenCalled();
    expect(prisma.userMfa.deleteMany).not.toHaveBeenCalled();
  });
});
