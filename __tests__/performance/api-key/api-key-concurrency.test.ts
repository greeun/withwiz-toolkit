/**
 * api-key 동시성 안전 테스트 (Load/Stress 도메인)
 *
 * 서버 부하 대상이 없는 라이브러리 — 이벤트 루프 동시 호출 시
 * 결과 일관성과 unhandled rejection 부재를 검증한다.
 *
 * 알려진 한계(테스트로 고정하지 않음): generateApiKey 한도 검사는 check-then-act로
 * 서비스 계층은 동시 발급 TOCTOU를 원자적으로 막지 않는다 — 원자성은 repo 구현 책임.
 * (load-stress-gap-scenarios.md 참고)
 *
 * 테스트 범위 (load-stress-gap-testcases.md):
 * - TC-LOAD-AK-001: 동시 100 validateApiKey 결과 일관성
 * - TC-LOAD-AK-002: 동시 100 trackUsage 부분 실패 시 전파 없음
 */
import { describe, it, expect, vi } from 'vitest';
import { ApiKeyService, type ApiKeyServiceDeps } from '../../../src/core/api-key/api-key.service';
import { hashKey } from '../../../src/core/api-key/key-generator';
import type { ApiKeyValidationResult } from '../../../src/core/api-key/types';
import type { ApiKeyWithUser } from '../../../src/core/api-key/ports';

describe('api-key 동시성 안전', () => {
  it('TC-LOAD-AK-001: 동시 100 validateApiKey — 전원 동일 valid 결과, reject 0', async () => {
    const raw = 'sk_live_' + 'cd'.repeat(32);
    const record = {
      id: 'k1', userId: 'u1', name: 'k', description: null, key: hashKey(raw),
      permissions: ['read'], rateLimit: 100, endpointLimits: null, environment: 'production',
      ipWhitelist: [], isActive: true, usageCount: 0, lastUsedAt: null, lastUsedIp: null,
      expiresAt: null, createdAt: new Date(), updatedAt: new Date(),
      user: { id: 'u1', email: 'a@b.c', isActive: true, plan: 'PRO' },
    } as ApiKeyWithUser;
    const cacheMap = new Map<string, ApiKeyValidationResult>();
    const deps = {
      repo: { findByHash: vi.fn(async () => record) } as unknown as ApiKeyServiceDeps['repo'],
      cache: {
        getValidation: async (h: string) => cacheMap.get(h) ?? null,
        setValidation: async (h: string, r: ApiKeyValidationResult) => { cacheMap.set(h, r); },
        invalidate: async (h: string) => { cacheMap.delete(h); },
      },
      planConfig: { getApiKeyLimit: async () => 5, getRateLimit: async () => 100 },
      usage: { canMakeApiCall: async () => ({ allowed: true, current: { daily: 0, monthly: 0 }, limit: { daily: 1, monthly: 1 } }) },
      env: { prefixProd: 'sk_live_', prefixDev: 'sk_test_', defaultExpiryDays: 365, restrictedPlans: ['FREEMIUM'] },
    } as ApiKeyServiceDeps;
    const svc = new ApiKeyService(deps);

    const settled = await Promise.allSettled(
      Array.from({ length: 100 }, () => svc.validateApiKey(raw)),
    );
    const rejected = settled.filter((s) => s.status === 'rejected');
    expect(rejected, '동시 검증 중 예외 발생').toHaveLength(0);
    for (const s of settled) {
      expect((s as PromiseFulfilledResult<ApiKeyValidationResult>).value.valid).toBe(true);
    }
  });

  it('TC-LOAD-AK-002: 동시 100 trackUsage — 절반 실패 주입에도 전파 0', async () => {
    let n = 0;
    const deps = {
      repo: {
        incrementUsage: vi.fn(async () => {
          if (n++ % 2 === 0) throw new Error('usage store down');
        }),
      } as unknown as ApiKeyServiceDeps['repo'],
      cache: { getValidation: async () => null, setValidation: async () => {}, invalidate: async () => {} },
      planConfig: { getApiKeyLimit: async () => 5, getRateLimit: async () => 100 },
      usage: { canMakeApiCall: async () => ({ allowed: true, current: { daily: 0, monthly: 0 }, limit: { daily: 1, monthly: 1 } }) },
      env: { prefixProd: 'sk_live_', prefixDev: 'sk_test_', defaultExpiryDays: 365, restrictedPlans: [] },
    } as ApiKeyServiceDeps;
    const svc = new ApiKeyService(deps);

    const settled = await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) => svc.trackUsage('k1', `10.0.0.${i}`)),
    );
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(0);
  });
});
