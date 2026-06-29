import { describe, it, expect, vi } from 'vitest';
import { ApiKeyService, type ApiKeyServiceDeps } from '../../../src/core/api-key/api-key.service';
import { hashKey } from '../../../src/core/api-key/key-generator';
import type { ApiKeyWithUser, ApiKeyRecord } from '../../../src/core/api-key/ports';

function makeDeps(over: Partial<ApiKeyServiceDeps> = {}): ApiKeyServiceDeps {
  const store = new Map<string, ApiKeyRecord>();
  return {
    repo: {
      create: vi.fn(async (d) => {
        const rec = { ...recordDefaults(), ...d, id: 'k1', description: d.description ?? null,
          endpointLimits: d.endpointLimits ?? null } as ApiKeyRecord;
        store.set(rec.key, rec); return rec;
      }),
      findByHash: vi.fn(async (_h) => null),
      findById: vi.fn(async () => null),
      findMany: vi.fn(async () => ({ items: [], total: 0 })),
      countActive: vi.fn(async () => 0),
      update: vi.fn(async () => recordDefaults()),
      deactivate: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      incrementUsage: vi.fn(async () => {}),
    },
    cache: { getValidation: vi.fn(async () => null), setValidation: vi.fn(async () => {}), invalidate: vi.fn(async () => {}) },
    planConfig: { getApiKeyLimit: vi.fn(async () => 5), getRateLimit: vi.fn(async () => 100) },
    usage: { canMakeApiCall: vi.fn(async () => ({ allowed: true, current: { daily: 0, monthly: 0 }, limit: { daily: 1, monthly: 1 } })), logUsage: vi.fn(async () => {}) },
    env: { prefixProd: 'sk_live_', prefixDev: 'sk_test_', defaultExpiryDays: 365, restrictedPlans: ['FREEMIUM'] },
    ...over,
  };
}
function recordDefaults(): ApiKeyRecord {
  return { id: 'k1', userId: 'u1', name: 'k', description: null, key: 'h', permissions: ['read'],
    rateLimit: 100, endpointLimits: null, environment: 'production', ipWhitelist: [], isActive: true,
    usageCount: 0, lastUsedAt: null, lastUsedIp: null, expiresAt: null,
    createdAt: new Date(), updatedAt: new Date() };
}

describe('ApiKeyService.generateApiKey', () => {
  it('raw key 반환 + repo.create 호출 + dev prefix', async () => {
    const deps = makeDeps();
    const svc = new ApiKeyService(deps);
    const res = await svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'development' }, 'PRO');
    expect(res.key.startsWith('sk_test_')).toBe(true);
    expect(deps.repo.create).toHaveBeenCalledOnce();
  });
  it('키 한도 초과 시 throw', async () => {
    const deps = makeDeps();
    deps.planConfig.getApiKeyLimit = vi.fn(async () => 2);
    deps.repo.countActive = vi.fn(async () => 2);
    const svc = new ApiKeyService(deps);
    await expect(svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production' }, 'PRO'))
      .rejects.toThrow(/limit reached/i);
  });
});

describe('ApiKeyService.validateApiKey', () => {
  it('캐시 hit 시 repo 미조회', async () => {
    const deps = makeDeps();
    deps.cache.getValidation = vi.fn(async () => ({ valid: true, user: { id: 'u1', email: 'a@b', plan: 'PRO' } }));
    const svc = new ApiKeyService(deps);
    const res = await svc.validateApiKey('sk_test_x');
    expect(res.valid).toBe(true);
    expect(deps.repo.findByHash).not.toHaveBeenCalled();
  });
  it('캐시 miss → repo 조회 → 성공 시 캐시 저장', async () => {
    const deps = makeDeps();
    const rec: ApiKeyWithUser = { ...recordDefaults(), key: hashKey('sk_test_x'),
      user: { id: 'u1', email: 'a@b', isActive: true, plan: 'PRO' } };
    deps.repo.findByHash = vi.fn(async () => rec);
    const svc = new ApiKeyService(deps);
    const res = await svc.validateApiKey('sk_test_x');
    expect(res.valid).toBe(true);
    expect(deps.cache.setValidation).toHaveBeenCalledOnce();
  });
});

describe('ApiKeyService.updateApiKey/deleteApiKey 캐시 무효화', () => {
  it('updateApiKey: 소유자 검증 후 update + cache.invalidate(키해시)', async () => {
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => ({ ...recordDefaults(), id: 'k1', userId: 'u1', key: 'HASH' }));
    const svc = new ApiKeyService(deps);
    await svc.updateApiKey('k1', 'u1', { name: 'new' });
    expect(deps.repo.update).toHaveBeenCalled();
    expect(deps.cache.invalidate).toHaveBeenCalledWith('HASH');
  });
  it('updateApiKey: 비소유자 + 非admin → throw', async () => {
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => ({ ...recordDefaults(), id: 'k1', userId: 'OTHER', key: 'HASH' }));
    const svc = new ApiKeyService(deps);
    await expect(svc.updateApiKey('k1', 'u1', { name: 'x' })).rejects.toThrow(/unauthorized/i);
  });
  it('deleteApiKey: delete + cache.invalidate', async () => {
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => ({ ...recordDefaults(), id: 'k1', userId: 'u1', key: 'HASH' }));
    const svc = new ApiKeyService(deps);
    await svc.deleteApiKey('k1', 'u1');
    expect(deps.repo.delete).toHaveBeenCalledWith('k1');
    expect(deps.cache.invalidate).toHaveBeenCalledWith('HASH');
  });
  it('trackUsage: repo.incrementUsage 호출(실패해도 throw 안 함)', async () => {
    const deps = makeDeps();
    deps.repo.incrementUsage = vi.fn(async () => { throw new Error('db'); });
    const svc = new ApiKeyService(deps);
    await expect(svc.trackUsage('k1', '1.2.3.4')).resolves.toBeUndefined();
  });
});

describe('ApiKeyService 보안 강화 (audit)', () => {
  it('generateApiKey: restrictedPlans는 전용 메시지로 차단 (단일원천)', async () => {
    const deps = makeDeps();
    const svc = new ApiKeyService(deps);
    await expect(svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production' }, 'FREEMIUM'))
      .rejects.toThrow(/not available for the FREEMIUM/i);
  });
  it('validateApiKey: 캐시 hit이라도 만료된 키면 재조회 (stale-auth 방지)', async () => {
    const deps = makeDeps();
    const expiredCached = {
      valid: true,
      apiKey: { id: 'k1', userId: 'u1', permissions: ['read'], rateLimit: 100, ipWhitelist: [], environment: 'production', expiresAt: new Date('2000-01-01') },
      user: { id: 'u1', email: 'a@b', plan: 'PRO' },
    };
    deps.cache.getValidation = vi.fn(async () => expiredCached as any);
    deps.repo.findByHash = vi.fn(async () => null); // 재조회 → null → INVALID
    const svc = new ApiKeyService(deps);
    const res = await svc.validateApiKey('sk_test_x');
    expect(deps.cache.invalidate).toHaveBeenCalled();
    expect(deps.repo.findByHash).toHaveBeenCalled();
    expect(res.valid).toBe(false);
  });
  it('getApiKey: 비소유자 + 非admin → throw (IDOR 방지)', async () => {
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => ({ ...recordDefaults(), id: 'k1', userId: 'OTHER', key: 'h' }));
    const svc = new ApiKeyService(deps);
    await expect(svc.getApiKey('k1', 'u1')).rejects.toThrow(/unauthorized/i);
  });
  it('getApiKeys: 非admin은 본인 userId로 스코프', async () => {
    const deps = makeDeps();
    const findMany = vi.fn(async () => ({ items: [], total: 0 }));
    deps.repo.findMany = findMany;
    const svc = new ApiKeyService(deps);
    await svc.getApiKeys({ page: 1 }, 'u1', false);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
  });
});
