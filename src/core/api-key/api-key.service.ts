import { generateRawKey, hashKey, keyPreview } from '@withwiz/toolkit/core/api-key/key-generator';
import { validateApiKeyRecord } from '@withwiz/toolkit/core/api-key/validate';
import { ApiKeyError, API_KEY_ERROR_CODES } from '@withwiz/toolkit/core/api-key/errors';
import type {
  IApiKeyRepository, IApiKeyCacheStore, IPlanConfigProvider, IUsageTracker, ApiKeyServiceEnv,
  ApiKeyRecord,
} from '@withwiz/toolkit/core/api-key/ports';
import type {
  CreateApiKeyOptions, ApiKeyResult, ApiKeyValidationResult,
  ApiKeyInfo, ApiKeyFilters, ApiKeyListResponse, UpdateApiKeyData,
} from '@withwiz/toolkit/core/api-key/types';

export interface ApiKeyServiceDeps {
  repo: IApiKeyRepository;
  cache: IApiKeyCacheStore;
  planConfig: IPlanConfigProvider;
  usage: IUsageTracker;
  env: ApiKeyServiceEnv;
}

export class ApiKeyService {
  constructor(private readonly deps: ApiKeyServiceDeps) {}

  private prefix(env: CreateApiKeyOptions['environment']): string {
    return env === 'production' ? this.deps.env.prefixProd : this.deps.env.prefixDev;
  }

  private toInfo(r: ApiKeyRecord): ApiKeyInfo {
    return {
      id: r.id, name: r.name, description: r.description ?? undefined, keyPreview: keyPreview(r.key),
      permissions: r.permissions, environment: r.environment, rateLimit: r.rateLimit,
      endpointLimits: r.endpointLimits ?? undefined, ipWhitelist: r.ipWhitelist,
      lastUsedAt: r.lastUsedAt ?? undefined, lastUsedIp: r.lastUsedIp ?? undefined,
      usageCount: r.usageCount, isActive: r.isActive, expiresAt: r.expiresAt ?? undefined,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  private async requireOwned(id: string, userId: string, isAdmin: boolean): Promise<ApiKeyRecord> {
    const rec = await this.deps.repo.findById(id);
    if (!rec) throw new ApiKeyError('API key not found', API_KEY_ERROR_CODES.NOT_FOUND);
    if (!isAdmin && rec.userId !== userId) throw new ApiKeyError('Unauthorized', API_KEY_ERROR_CODES.OWNERSHIP);
    return rec;
  }

  // FREEMIUM 등 제한 플랜은 한도(0) 의존이 아닌 명시 차단 — generate/validate 단일원천
  private assertPlanNotRestricted(plan: string): void {
    if (this.deps.env.restrictedPlans.includes(plan)) {
      throw new ApiKeyError(
        `API key is not available for the ${plan} plan. Please upgrade.`,
        API_KEY_ERROR_CODES.PLAN_RESTRICTED
      );
    }
  }

  async generateApiKey(userId: string, options: CreateApiKeyOptions, plan: string): Promise<ApiKeyResult> {
    const { repo, planConfig, env } = this.deps;
    this.assertPlanNotRestricted(plan);
    const maxKeys = await planConfig.getApiKeyLimit(plan);
    const active = await repo.countActive(userId);
    if (active >= maxKeys) {
      throw new ApiKeyError(`API key limit reached. Max ${maxKeys} keys.`, API_KEY_ERROR_CODES.LIMIT_REACHED);
    }

    const rawKey = generateRawKey(this.prefix(options.environment));
    const planRate = await planConfig.getRateLimit(plan);
    const rateLimit = options.customRateLimit ? Math.min(options.customRateLimit, planRate) : planRate;
    const expiresAt = options.expiresAt
      ?? new Date(Date.now() + env.defaultExpiryDays * 86400_000);

    const created = await repo.create({
      userId, key: hashKey(rawKey), name: options.name, description: options.description ?? null,
      permissions: options.permissions, rateLimit, endpointLimits: options.endpointLimits ?? null,
      environment: options.environment, ipWhitelist: options.ipWhitelist ?? [], expiresAt,
    });

    return {
      id: created.id, key: rawKey, name: created.name, description: created.description ?? undefined,
      permissions: created.permissions, environment: created.environment, rateLimit: created.rateLimit,
      endpointLimits: created.endpointLimits ?? undefined, expiresAt: created.expiresAt ?? undefined,
      createdAt: created.createdAt,
    };
  }

  async validateApiKey(rawKey: string): Promise<ApiKeyValidationResult> {
    const { repo, cache, env } = this.deps;
    const keyHash = hashKey(rawKey);

    // 캐시는 최적화 계층 — validate 경로의 캐시 장애는 miss 취급 (가용성 우선).
    // update/delete의 invalidate는 revoke 확실성을 위해 전파 유지.
    const cached = await cache.getValidation(keyHash).catch(() => null);
    if (cached) {
      // 캐시 hit이라도 자연 만료(expiresAt)는 재검사 — stale-auth 방지
      const exp = cached.apiKey?.expiresAt;
      if (!(exp && new Date(exp) < new Date())) return cached;
      await cache.invalidate(keyHash).catch(() => {}); // 만료 → 캐시 제거 후 재조회
    }

    const record = await repo.findByHash(keyHash);
    const result = validateApiKeyRecord(record, { freemiumPlans: env.restrictedPlans });
    if (result.valid) await cache.setValidation(keyHash, result).catch(() => {});
    return result;
  }

  async getApiKey(id: string, userId: string, isAdmin = false): Promise<ApiKeyInfo> {
    const rec = await this.requireOwned(id, userId, isAdmin);
    return this.toInfo(rec);
  }

  async getApiKeys(filters: ApiKeyFilters, requesterId: string, isAdmin = false): Promise<ApiKeyListResponse> {
    // 非admin은 본인 userId로 스코프 강제 (IDOR 방지)
    const scoped = isAdmin ? filters : { ...filters, userId: requesterId };
    const page = scoped.page ?? 1, pageSize = scoped.pageSize ?? 10;
    const { items, total } = await this.deps.repo.findMany({ ...scoped, page, pageSize });
    return { keys: items.map((r) => this.toInfo(r)), total, page, pageSize, hasMore: total > page * pageSize };
  }

  async updateApiKey(id: string, userId: string, data: UpdateApiKeyData, isAdmin = false): Promise<ApiKeyInfo> {
    const rec = await this.requireOwned(id, userId, isAdmin);
    const updated = await this.deps.repo.update(id, {
      name: data.name, description: data.description, isActive: data.isActive,
      permissions: data.permissions, ipWhitelist: data.ipWhitelist,
      rateLimit: data.customRateLimit, endpointLimits: data.endpointLimits,
    });
    await this.deps.cache.invalidate(rec.key);
    return this.toInfo(updated);
  }

  async deleteApiKey(id: string, userId: string, isAdmin = false): Promise<void> {
    const rec = await this.requireOwned(id, userId, isAdmin);
    await this.deps.repo.delete(id);
    await this.deps.cache.invalidate(rec.key);
  }

  async trackUsage(apiKeyId: string, ip?: string): Promise<void> {
    try { await this.deps.repo.incrementUsage(apiKeyId, ip); } catch { /* 추적 실패는 무시 */ }
  }

  async regenerateApiKey(userId: string, apiKeyId: string, plan: string,
    options: { name?: string; description?: string; keepOldKeyActive?: boolean } = {}): Promise<ApiKeyResult> {
    const old = await this.requireOwned(apiKeyId, userId, false);
    // 파괴적 단계(deactivate) 전에 발급 가능성 선검증 — 구키만 죽는 부분 실패 방지
    this.assertPlanNotRestricted(plan);
    if (!options.keepOldKeyActive) {
      const max = await this.deps.planConfig.getApiKeyLimit(plan);
      const active = await this.deps.repo.countActive(userId);
      // 활성 구키 회전은 순증 0 — 비활성화 반영한 유효 카운트로 한도 판정
      const effective = old.isActive ? active - 1 : active;
      if (effective >= max) {
        throw new ApiKeyError(`API key limit reached. Max ${max} keys.`, API_KEY_ERROR_CODES.LIMIT_REACHED);
      }
      await this.deps.repo.deactivate(apiKeyId);
      await this.deps.cache.invalidate(old.key);
    }
    return this.generateApiKey(userId, {
      name: options.name ?? old.name, description: options.description ?? old.description ?? undefined,
      permissions: old.permissions, environment: old.environment, customRateLimit: old.rateLimit,
      ipWhitelist: old.ipWhitelist, endpointLimits: old.endpointLimits ?? undefined,
      expiresAt: old.expiresAt ?? undefined,
    }, plan);
  }
}
