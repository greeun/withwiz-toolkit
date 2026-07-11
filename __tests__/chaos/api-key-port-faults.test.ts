/**
 * api-key 포트 장애 주입 (Chaos 도메인)
 *
 * 스펙 근거 (chaos-gap-scenarios.md):
 * - 캐시는 순수 최적화 계층 — validate 경로의 read/write 장애는 miss 취급 (가용성 우선).
 *   근거: api-key-auth "사용량 확인 실패 → 가용성 우선 허용", service "추적 실패는 무시" 설계 철학.
 * - 단, mutation 경로(update/delete)의 invalidate 실패는 전파 — revoke 확실성(보안) 우선.
 *
 * 테스트 범위 (chaos-gap-testcases.md):
 * - TC-CHAOS-AK-001: cache read 장애 → repo 경로로 검증 지속
 * - TC-CHAOS-AK-002: cache write 장애 → 유효 결과 반환
 * - TC-CHAOS-AK-003: 만료 캐시 invalidate 장애 → 재조회 지속
 * - TC-CHAOS-AK-004: mutation invalidate 장애 → 전파
 */
import { describe, it, expect, vi } from 'vitest';
import { ApiKeyService, type ApiKeyServiceDeps } from '../../src/core/api-key/api-key.service';
import { hashKey } from '../../src/core/api-key/key-generator';
import type { ApiKeyRecord, ApiKeyWithUser } from '../../src/core/api-key/ports';

const RAW = 'sk_live_' + 'ef'.repeat(32);

function record(over: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  return { id: 'k1', userId: 'u1', name: 'k', description: null, key: hashKey(RAW),
    permissions: ['read'], rateLimit: 100, endpointLimits: null, environment: 'production',
    ipWhitelist: [], isActive: true, usageCount: 0, lastUsedAt: null, lastUsedIp: null,
    expiresAt: null, createdAt: new Date(), updatedAt: new Date(), ...over };
}
const withUser = (): ApiKeyWithUser =>
  ({ ...record(), user: { id: 'u1', email: 'a@b.c', isActive: true, plan: 'PRO' } });

function makeDeps(over: Partial<ApiKeyServiceDeps> = {}): ApiKeyServiceDeps {
  return {
    repo: {
      create: vi.fn(async () => record()),
      findByHash: vi.fn(async () => withUser()),
      findById: vi.fn(async () => record()),
      findMany: vi.fn(async () => ({ items: [], total: 0 })),
      countActive: vi.fn(async () => 0),
      update: vi.fn(async () => record()),
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

describe('validate 경로 캐시 장애 — 가용성 우선', () => {
  it('TC-CHAOS-AK-001: cache.getValidation throw → miss 취급, repo로 검증 지속', async () => {
    const deps = makeDeps();
    deps.cache.getValidation = vi.fn(async () => { throw new Error('redis down'); });
    const res = await new ApiKeyService(deps).validateApiKey(RAW);
    expect(res.valid, '캐시 read 장애가 인증 실패로 확산').toBe(true);
    expect(deps.repo.findByHash).toHaveBeenCalled();
  });

  it('TC-CHAOS-AK-002: cache.setValidation throw → 무시, 유효 결과 반환', async () => {
    const deps = makeDeps();
    deps.cache.setValidation = vi.fn(async () => { throw new Error('redis down'); });
    const res = await new ApiKeyService(deps).validateApiKey(RAW);
    expect(res.valid, '캐시 write 장애가 유효 키 인증을 차단').toBe(true);
  });

  it('TC-CHAOS-AK-003: 만료 캐시 + invalidate throw → 무시, repo 재조회 지속', async () => {
    const deps = makeDeps();
    deps.cache.getValidation = vi.fn(async () => ({
      valid: true,
      apiKey: { id: 'k1', userId: 'u1', permissions: ['read'], rateLimit: 100,
        ipWhitelist: [], environment: 'production', expiresAt: new Date('2000-01-01') },
      user: { id: 'u1', email: 'a@b.c', plan: 'PRO' },
    }) as never);
    deps.cache.invalidate = vi.fn(async () => { throw new Error('redis down'); });
    deps.repo.findByHash = vi.fn(async () => null);
    const res = await new ApiKeyService(deps).validateApiKey(RAW);
    expect(res.valid).toBe(false); // stale 캐시 무시하고 repo 기준 판정
    expect(deps.repo.findByHash).toHaveBeenCalled();
  });
});

describe('mutation 경로 invalidate 장애 — 전파 (revoke 확실성)', () => {
  it('TC-CHAOS-AK-004: updateApiKey/deleteApiKey의 invalidate throw → reject', async () => {
    const deps = makeDeps();
    deps.cache.invalidate = vi.fn(async () => { throw new Error('redis down'); });
    const svc = new ApiKeyService(deps);
    await expect(svc.updateApiKey('k1', 'u1', { name: 'x' })).rejects.toThrow('redis down');
    await expect(svc.deleteApiKey('k1', 'u1')).rejects.toThrow('redis down');
  });
});
