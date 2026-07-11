import { describe, it, expect, vi } from 'vitest';
import { ApiKeyService, type ApiKeyServiceDeps } from '../../../src/core/api-key/api-key.service';
import { ApiKeyError, API_KEY_ERROR_CODES, isApiKeyError } from '../../../src/core/api-key/errors';
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

describe('ApiKeyError typed error 계약', () => {
  // 소비자는 메시지 문자열이 아닌 code로 판별한다 — 메시지 문구 변경이 판별을 깨지 않는다.
  it('미존재 키 → code NOT_FOUND (메시지 하위호환 유지)', async () => {
    const svc = new ApiKeyService(makeDeps());
    const err = await svc.getApiKey('none', 'u1').then(() => null, (e) => e);
    expect(isApiKeyError(err, API_KEY_ERROR_CODES.NOT_FOUND)).toBe(true);
    expect((err as Error).message).toBe('API key not found');
  });
  it('비소유자 접근 → code OWNERSHIP (메시지 하위호환 유지)', async () => {
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => ({ ...recordDefaults(), userId: 'OTHER' }));
    const svc = new ApiKeyService(deps);
    const err = await svc.deleteApiKey('k1', 'u1').then(() => null, (e) => e);
    expect(isApiKeyError(err, API_KEY_ERROR_CODES.OWNERSHIP)).toBe(true);
    expect((err as Error).message).toBe('Unauthorized');
  });
  it('제한 플랜 발급 → code PLAN_RESTRICTED', async () => {
    const svc = new ApiKeyService(makeDeps());
    const err = await svc
      .generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production' }, 'FREEMIUM')
      .then(() => null, (e) => e);
    expect(isApiKeyError(err, API_KEY_ERROR_CODES.PLAN_RESTRICTED)).toBe(true);
  });
  it('키 한도 초과 발급 → code LIMIT_REACHED', async () => {
    const deps = makeDeps();
    deps.planConfig.getApiKeyLimit = vi.fn(async () => 1);
    deps.repo.countActive = vi.fn(async () => 1);
    const svc = new ApiKeyService(deps);
    const genErr = await svc
      .generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production' }, 'PRO')
      .then(() => null, (e) => e);
    expect(isApiKeyError(genErr, API_KEY_ERROR_CODES.LIMIT_REACHED)).toBe(true);
  });
  it('회전(구키 비활성화)은 순증 0 — 한도 도달 상태에서도 허용', async () => {
    const deps = makeDeps();
    let active = 1; // 한도 1, 활성 1 = 한도 도달
    deps.planConfig.getApiKeyLimit = vi.fn(async () => 1);
    deps.repo.countActive = vi.fn(async () => active);
    deps.repo.deactivate = vi.fn(async () => { active -= 1; });
    deps.repo.findById = vi.fn(async () => recordDefaults());
    const svc = new ApiKeyService(deps);
    const res = await svc.regenerateApiKey('u1', 'k1', 'PRO');
    expect(deps.repo.deactivate).toHaveBeenCalledWith('k1');
    expect(res.key.startsWith('sk_live_')).toBe(true);
  });
  it('keepOldKeyActive 회전은 순증 +1 — 한도 도달이면 LIMIT_REACHED', async () => {
    const deps = makeDeps();
    deps.planConfig.getApiKeyLimit = vi.fn(async () => 1);
    deps.repo.countActive = vi.fn(async () => 1);
    deps.repo.findById = vi.fn(async () => recordDefaults());
    const svc = new ApiKeyService(deps);
    const err = await svc
      .regenerateApiKey('u1', 'k1', 'PRO', { keepOldKeyActive: true })
      .then(() => null, (e) => e);
    expect(isApiKeyError(err, API_KEY_ERROR_CODES.LIMIT_REACHED)).toBe(true);
    expect(deps.repo.create).not.toHaveBeenCalled();
  });
  it('비활성 구키 regenerate는 순증 +1 — 한도 도달이면 LIMIT_REACHED', async () => {
    const deps = makeDeps();
    deps.planConfig.getApiKeyLimit = vi.fn(async () => 1);
    deps.repo.countActive = vi.fn(async () => 1);
    deps.repo.findById = vi.fn(async () => ({ ...recordDefaults(), isActive: false }));
    const svc = new ApiKeyService(deps);
    const err = await svc.regenerateApiKey('u1', 'k1', 'PRO').then(() => null, (e) => e);
    expect(isApiKeyError(err, API_KEY_ERROR_CODES.LIMIT_REACHED)).toBe(true);
    expect(deps.repo.deactivate).not.toHaveBeenCalled();
  });
  it('제한 플랜 regenerate → deactivate 전 PLAN_RESTRICTED (구키 보존, 부분 실패 방지)', async () => {
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => recordDefaults());
    const svc = new ApiKeyService(deps);
    const err = await svc.regenerateApiKey('u1', 'k1', 'FREEMIUM').then(() => null, (e) => e);
    expect(isApiKeyError(err, API_KEY_ERROR_CODES.PLAN_RESTRICTED)).toBe(true);
    expect(deps.repo.deactivate).not.toHaveBeenCalled();
    expect(deps.cache.invalidate).not.toHaveBeenCalled();
  });
  it('isApiKeyError: 일반 Error·code 불일치 거부, 모듈 인스턴스 분리(구조 동일) 허용', () => {
    expect(isApiKeyError(new Error('API key not found'))).toBe(false);
    const err = new ApiKeyError('Unauthorized', API_KEY_ERROR_CODES.OWNERSHIP);
    expect(isApiKeyError(err, API_KEY_ERROR_CODES.NOT_FOUND)).toBe(false);
    // 중복 설치 시나리오: 다른 모듈 인스턴스의 ApiKeyError를 구조로 판별
    const foreign = Object.assign(new Error('Unauthorized'), { code: API_KEY_ERROR_CODES.OWNERSHIP });
    foreign.name = 'ApiKeyError';
    expect(isApiKeyError(foreign, API_KEY_ERROR_CODES.OWNERSHIP)).toBe(true);
  });
});

describe('ApiKeyService 미커버 분기 (gap — unit-gap-testcases.md)', () => {
  it('TC-UNIT-AKSVC-101: admin은 비소유 키 접근 허용 (getApiKey/updateApiKey)', async () => {
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => ({ ...recordDefaults(), userId: 'OTHER' }));
    const svc = new ApiKeyService(deps);
    await expect(svc.getApiKey('k1', 'u1', true)).resolves.toMatchObject({ id: 'k1' });
    await expect(svc.updateApiKey('k1', 'u1', { name: 'x' }, true)).resolves.toBeDefined();
  });

  it('TC-UNIT-AKSVC-102: admin getApiKeys는 filters 그대로 (스코프 미강제) + hasMore 계산', async () => {
    const deps = makeDeps();
    const findMany = vi.fn(async () => ({ items: [recordDefaults()], total: 25 }));
    deps.repo.findMany = findMany;
    const svc = new ApiKeyService(deps);
    const res = await svc.getApiKeys({ userId: 'target', page: 2, pageSize: 10 }, 'admin1', true);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ userId: 'target', page: 2, pageSize: 10 }));
    expect(res.hasMore).toBe(true); // 25 > 2*10
    expect(res.total).toBe(25);
  });

  it('TC-UNIT-AKSVC-103/104: customRateLimit은 플랜 한도로 clamp', async () => {
    const deps = makeDeps(); // planRate 100
    const svc = new ApiKeyService(deps);
    await svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production', customRateLimit: 500 }, 'PRO');
    await svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production', customRateLimit: 50 }, 'PRO');
    const calls = (deps.repo.create as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0].rateLimit).toBe(100); // 500 → 플랜 한도 100
    expect(calls[1][0].rateLimit).toBe(50);  // 50 → 그대로
  });

  it('TC-UNIT-AKSVC-105: expiresAt 미지정 시 defaultExpiryDays 적용', async () => {
    const deps = makeDeps(); // defaultExpiryDays 365
    const svc = new ApiKeyService(deps);
    const before = Date.now();
    await svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production' }, 'PRO');
    const expiresAt = (deps.repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0].expiresAt as Date;
    const expected = before + 365 * 86400_000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expected);
    expect(expiresAt.getTime()).toBeLessThan(expected + 60_000);
  });

  it('TC-UNIT-AKSVC-106: expiresAt 명시 시 그대로 전달', async () => {
    const deps = makeDeps();
    const svc = new ApiKeyService(deps);
    const explicit = new Date('2030-01-01T00:00:00Z');
    await svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production', expiresAt: explicit }, 'PRO');
    expect((deps.repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0].expiresAt).toBe(explicit);
  });

  it('TC-UNIT-AKSVC-107: production 환경은 prod prefix', async () => {
    const svc = new ApiKeyService(makeDeps());
    const res = await svc.generateApiKey('u1', { name: 'k', permissions: ['read'], environment: 'production' }, 'PRO');
    expect(res.key.startsWith('sk_live_')).toBe(true);
  });

  it('TC-UNIT-AKSVC-108: keepOldKeyActive 회전 성공 — deactivate 미호출 + 신키 발급', async () => {
    const deps = makeDeps(); // limit 5
    deps.repo.countActive = vi.fn(async () => 1);
    deps.repo.findById = vi.fn(async () => recordDefaults());
    const svc = new ApiKeyService(deps);
    const res = await svc.regenerateApiKey('u1', 'k1', 'PRO', { keepOldKeyActive: true });
    expect(deps.repo.deactivate).not.toHaveBeenCalled();
    expect(deps.repo.create).toHaveBeenCalledOnce();
    expect(res.key.startsWith('sk_live_')).toBe(true);
  });

  it('TC-UNIT-AKSVC-109: regenerate — name override + 구키 속성 승계', async () => {
    const deps = makeDeps();
    deps.repo.findById = vi.fn(async () => ({
      ...recordDefaults(), name: 'old', description: 'd', permissions: ['read', 'write'] as const,
      environment: 'development' as const, rateLimit: 42, ipWhitelist: ['1.1.1.1'], endpointLimits: { create: 5 },
    }));
    const svc = new ApiKeyService(deps);
    const res = await svc.regenerateApiKey('u1', 'k1', 'PRO', { name: 'renamed' });
    expect(deps.repo.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'renamed', description: 'd', permissions: ['read', 'write'],
      environment: 'development', rateLimit: 42, // min(42, planRate 100)
      ipWhitelist: ['1.1.1.1'], endpointLimits: { create: 5 },
    }));
    expect(res.key.startsWith('sk_test_')).toBe(true); // 환경 승계 → dev prefix
  });
});
