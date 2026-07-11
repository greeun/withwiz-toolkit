/**
 * api-key 모듈 간 통합 테스트 — 실 key-generator/validate + fake 저장소
 *
 * 테스트 범위 (integration-gap-testcases.md):
 * - TC-INT-AK-001: generate → validate 라운드트립 (모듈 간 해시 계약)
 * - TC-INT-AK-002: 수명주기 — 캐시 적재 후 delete 시 재검증 무효
 *
 * 개별 모듈 로직은 unit 소유 — 여기서는 모듈 간 조합만 검증.
 */
import { describe, it, expect } from 'vitest';
import { ApiKeyService, type ApiKeyServiceDeps } from '../../../src/core/api-key/api-key.service';
import type { ApiKeyRecord, ApiKeyWithUser } from '../../../src/core/api-key/ports';
import type { ApiKeyValidationResult } from '../../../src/core/api-key/types';

const USER = { id: 'u1', email: 'a@b.c', isActive: true, plan: 'PRO' };

function makeInMemoryDeps(): ApiKeyServiceDeps {
  const records = new Map<string, ApiKeyRecord>(); // id → record
  const cache = new Map<string, ApiKeyValidationResult>();
  let seq = 0;
  return {
    repo: {
      create: async (d) => {
        const rec: ApiKeyRecord = {
          id: `key-${++seq}`, userId: d.userId, name: d.name, description: d.description ?? null,
          key: d.key, permissions: d.permissions, rateLimit: d.rateLimit,
          endpointLimits: d.endpointLimits ?? null, environment: d.environment,
          ipWhitelist: d.ipWhitelist, isActive: true, usageCount: 0,
          lastUsedAt: null, lastUsedIp: null, expiresAt: d.expiresAt,
          createdAt: new Date(), updatedAt: new Date(),
        };
        records.set(rec.id, rec);
        return rec;
      },
      findByHash: async (h) => {
        const rec = [...records.values()].find((r) => r.key === h);
        return rec ? ({ ...rec, user: USER } as ApiKeyWithUser) : null;
      },
      findById: async (id) => records.get(id) ?? null,
      findMany: async () => ({ items: [...records.values()], total: records.size }),
      countActive: async (userId) =>
        [...records.values()].filter((r) => r.userId === userId && r.isActive).length,
      update: async (id, d) => {
        const rec = { ...records.get(id)!, ...d, updatedAt: new Date() } as ApiKeyRecord;
        records.set(id, rec);
        return rec;
      },
      deactivate: async (id) => {
        records.set(id, { ...records.get(id)!, isActive: false });
      },
      delete: async (id) => {
        records.delete(id);
      },
      incrementUsage: async () => {},
    },
    cache: {
      getValidation: async (h) => cache.get(h) ?? null,
      setValidation: async (h, r) => {
        cache.set(h, r);
      },
      invalidate: async (h) => {
        cache.delete(h);
      },
    },
    planConfig: { getApiKeyLimit: async () => 5, getRateLimit: async () => 100 },
    usage: {
      canMakeApiCall: async () => ({
        allowed: true, current: { daily: 0, monthly: 0 }, limit: { daily: 1, monthly: 1 },
      }),
    },
    env: { prefixProd: 'sk_live_', prefixDev: 'sk_test_', defaultExpiryDays: 365, restrictedPlans: ['FREEMIUM'] },
  };
}

describe('api-key 모듈 간 통합', () => {
  it('TC-INT-AK-001: generate 반환 rawKey로 validate 성공 (해시 계약 일치)', async () => {
    const svc = new ApiKeyService(makeInMemoryDeps());
    const created = await svc.generateApiKey(
      'u1', { name: 'ci', permissions: ['read'], environment: 'production' }, 'PRO',
    );
    const res = await svc.validateApiKey(created.key);
    expect(res.valid, `발급 키가 validate에서 무효 판정: ${res.message}`).toBe(true);
    expect(res.user?.id).toBe('u1');
    expect(res.apiKey?.id).toBe(created.id);
  });

  it('TC-INT-AK-002: validate(캐시 적재) → delete → 재validate 무효', async () => {
    const svc = new ApiKeyService(makeInMemoryDeps());
    const created = await svc.generateApiKey(
      'u1', { name: 'ci', permissions: ['read'], environment: 'production' }, 'PRO',
    );
    expect((await svc.validateApiKey(created.key)).valid).toBe(true); // 캐시 적재
    await svc.deleteApiKey(created.id, 'u1');
    const after = await svc.validateApiKey(created.key);
    expect(after.valid, 'revoke된 키가 캐시 경유로 계속 인증됨').toBe(false);
    expect(after.error).toBe('INVALID_API_KEY');
  });
});
