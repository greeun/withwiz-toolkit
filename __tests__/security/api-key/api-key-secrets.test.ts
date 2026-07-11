/**
 * api-key 비밀 재료 취급 보안 테스트
 *
 * 테스트 범위 (security-gap-testcases.md):
 * - TC-SEC-AK-001: raw key 미영속 (repo에는 sha256 해시만)
 * - TC-SEC-AK-002: 검증 실패 메시지에 키 재료 미노출
 * - TC-SEC-AK-003: keyPreview는 해시 기반 축약
 * - TC-SEC-AK-004: generateRawKey 유일성
 *
 * IDOR/스코프 강제는 unit(api-key.service.test.ts) 소유 — 중복 금지.
 */
import { describe, it, expect, vi } from 'vitest';
import { ApiKeyService, type ApiKeyServiceDeps } from '../../../src/core/api-key/api-key.service';
import { generateRawKey, hashKey } from '../../../src/core/api-key/key-generator';
import type { ApiKeyCreateInput, ApiKeyRecord, ApiKeyWithUser } from '../../../src/core/api-key/ports';

function baseRecord(over: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  return { id: 'k1', userId: 'u1', name: 'k', description: null, key: 'h', permissions: ['read'],
    rateLimit: 100, endpointLimits: null, environment: 'production', ipWhitelist: [], isActive: true,
    usageCount: 0, lastUsedAt: null, lastUsedIp: null, expiresAt: null,
    createdAt: new Date(), updatedAt: new Date(), ...over };
}

function makeDeps(over: Partial<ApiKeyServiceDeps> = {}): ApiKeyServiceDeps {
  return {
    repo: {
      create: vi.fn(async (d: ApiKeyCreateInput) => baseRecord({ ...d, description: d.description ?? null, endpointLimits: d.endpointLimits ?? null })),
      findByHash: vi.fn(async () => null),
      findById: vi.fn(async () => null),
      findMany: vi.fn(async () => ({ items: [], total: 0 })),
      countActive: vi.fn(async () => 0),
      update: vi.fn(async () => baseRecord()),
      deactivate: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      incrementUsage: vi.fn(async () => {}),
    },
    cache: { getValidation: vi.fn(async () => null), setValidation: vi.fn(async () => {}), invalidate: vi.fn(async () => {}) },
    planConfig: { getApiKeyLimit: vi.fn(async () => 5), getRateLimit: vi.fn(async () => 100) },
    usage: { canMakeApiCall: vi.fn(async () => ({ allowed: true, current: { daily: 0, monthly: 0 }, limit: { daily: 1, monthly: 1 } })) },
    env: { prefixProd: 'sk_live_', prefixDev: 'sk_test_', defaultExpiryDays: 365, restrictedPlans: ['FREEMIUM'] },
    ...over,
  };
}

describe('api-key 비밀 재료 취급', () => {
  it('TC-SEC-AK-001: repo.create에는 sha256 해시만 전달 — raw key 미영속', async () => {
    const deps = makeDeps();
    const svc = new ApiKeyService(deps);
    const res = await svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production' }, 'PRO');

    const createArg = (deps.repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiKeyCreateInput;
    expect(createArg.key).toBe(hashKey(res.key));
    expect(createArg.key).toMatch(/^[0-9a-f]{64}$/);
    // 영속 인자 어디에도 raw key 원문이 없어야 한다
    expect(JSON.stringify(createArg)).not.toContain(res.key);
  });

  it('TC-SEC-AK-002: 검증 실패 메시지에 키 재료(raw/해시) 미노출', async () => {
    const rawKey = generateRawKey('sk_live_');
    const keyHash = hashKey(rawKey);

    // 미존재 키
    const missing = await new ApiKeyService(makeDeps()).validateApiKey(rawKey);
    expect(missing.valid).toBe(false);
    expect(missing.message).not.toContain(rawKey);
    expect(missing.message).not.toContain(keyHash);

    // 만료 키
    const deps = makeDeps();
    deps.repo.findByHash = vi.fn(async () => ({
      ...baseRecord({ key: keyHash, expiresAt: new Date(Date.now() - 1000) }),
      user: { id: 'u1', email: 'a@b.c', isActive: true, plan: 'PRO' },
    } as ApiKeyWithUser));
    const expired = await new ApiKeyService(deps).validateApiKey(rawKey);
    expect(expired.valid).toBe(false);
    expect(expired.message).not.toContain(rawKey);
    expect(expired.message).not.toContain(keyHash);
  });

  it('TC-SEC-AK-003: keyPreview는 해시 축약(앞10...뒤4) — 원문 미노출', async () => {
    const rawKey = generateRawKey('sk_live_');
    const keyHash = hashKey(rawKey);
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => baseRecord({ key: keyHash }));
    const info = await new ApiKeyService(deps).getApiKey('k1', 'u1');

    expect(info.keyPreview).toBe(`${keyHash.slice(0, 10)}...${keyHash.slice(-4)}`);
    expect(info.keyPreview).not.toContain(rawKey.slice(-8)); // raw 꼬리 미노출
    expect(JSON.stringify(info)).not.toContain(rawKey);
  });

  it('TC-SEC-AK-004: generateRawKey 1000회 무충돌 + 형식 불변', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const k = generateRawKey('sk_live_');
      expect(k).toMatch(/^sk_live_[0-9a-f]{64}$/);
      keys.add(k);
    }
    expect(keys.size, 'raw key 충돌 발생 — RNG 회귀 의심').toBe(1000);
  });
});
