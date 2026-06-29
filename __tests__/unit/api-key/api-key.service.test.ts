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
    const res = await svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'development' });
    expect(res.key.startsWith('sk_test_')).toBe(true);
    expect(deps.repo.create).toHaveBeenCalledOnce();
  });
  it('키 한도 초과 시 throw', async () => {
    const deps = makeDeps();
    deps.planConfig.getApiKeyLimit = vi.fn(async () => 2);
    deps.repo.countActive = vi.fn(async () => 2);
    const svc = new ApiKeyService(deps);
    await expect(svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production' }))
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
