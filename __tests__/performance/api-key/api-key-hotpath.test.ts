/**
 * api-key 인증 hot path 성능 테스트
 *
 * 목적: 정밀 벤치마크가 아닌 차수 단위 회귀 감지
 * (예: 요청당 해시 이중 실행, 캐시 경로에 동기 병목 유입).
 *
 * 테스트 대상 수치는 환경변수로 조정:
 * - TEST_APIKEY_PERF_HASH_MS: hashKey 10k회 상한 ms (default: 2000)
 * - TEST_APIKEY_PERF_CACHE_MS: 캐시 hit validate 1k회 상한 ms (default: 2000)
 *
 * 테스트 범위 (performance-gap-testcases.md):
 * - TC-PERF-AK-001: hashKey 10k회 처리량
 * - TC-PERF-AK-002: validateApiKey 캐시 hit 1k회 + repo 미조회 유지
 */
import { describe, it, expect, vi } from 'vitest';
import { ApiKeyService, type ApiKeyServiceDeps } from '../../../src/core/api-key/api-key.service';
import { hashKey } from '../../../src/core/api-key/key-generator';

const HASH_MS = parseInt(process.env.TEST_APIKEY_PERF_HASH_MS || '2000', 10);
const CACHE_MS = parseInt(process.env.TEST_APIKEY_PERF_CACHE_MS || '2000', 10);

describe('api-key hot path 성능', () => {
  it(`TC-PERF-AK-001: hashKey 10,000회 < ${HASH_MS}ms`, () => {
    const raw = 'sk_live_' + 'ab'.repeat(32);
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) hashKey(raw + i);
    const elapsed = performance.now() - start;
    expect(elapsed, `hashKey 10k회 ${elapsed.toFixed(0)}ms — 해시 경로 회귀 의심`).toBeLessThan(HASH_MS);
  });

  it(`TC-PERF-AK-002: 캐시 hit validate 1,000회 < ${CACHE_MS}ms + repo 미조회`, async () => {
    const findByHash = vi.fn(async () => null);
    const deps = {
      repo: { findByHash } as unknown as ApiKeyServiceDeps['repo'],
      cache: {
        getValidation: async () => ({ valid: true, user: { id: 'u1', email: 'a@b.c', plan: 'PRO' } }),
        setValidation: async () => {},
        invalidate: async () => {},
      },
      planConfig: { getApiKeyLimit: async () => 5, getRateLimit: async () => 100 },
      usage: { canMakeApiCall: async () => ({ allowed: true, current: { daily: 0, monthly: 0 }, limit: { daily: 1, monthly: 1 } }) },
      env: { prefixProd: 'sk_live_', prefixDev: 'sk_test_', defaultExpiryDays: 365, restrictedPlans: [] },
    } as ApiKeyServiceDeps;
    const svc = new ApiKeyService(deps);

    const start = performance.now();
    for (let i = 0; i < 1_000; i++) await svc.validateApiKey('sk_live_x');
    const elapsed = performance.now() - start;

    expect(findByHash).not.toHaveBeenCalled();
    expect(elapsed, `캐시 hit 1k회 ${elapsed.toFixed(0)}ms — 캐시 경로 병목 의심`).toBeLessThan(CACHE_MS);
  });
});
