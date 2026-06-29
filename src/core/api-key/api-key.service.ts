import { generateRawKey, hashKey, keyPreview } from '@withwiz/toolkit/core/api-key/key-generator';
import { validateApiKeyRecord } from '@withwiz/toolkit/core/api-key/validate';
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
    if (!rec) throw new Error('API key not found');
    if (!isAdmin && rec.userId !== userId) throw new Error('Unauthorized');
    return rec;
  }

  async generateApiKey(userId: string, options: CreateApiKeyOptions, plan: string): Promise<ApiKeyResult> {
    const { repo, planConfig, env } = this.deps;
    // FREEMIUM 등 제한 플랜은 한도(0) 의존이 아닌 명시 차단 — generate/validate 단일원천
    if (env.restrictedPlans.includes(plan)) {
      throw new Error(`API key is not available for the ${plan} plan. Please upgrade.`);
    }
    const maxKeys = await planConfig.getApiKeyLimit(plan);
    const active = await repo.countActive(userId);
    if (active >= maxKeys) throw new Error(`API key limit reached. Max ${maxKeys} keys.`);

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

    const cached = await cache.getValidation(keyHash);
    if (cached) {
      // 캐시 hit이라도 자연 만료(expiresAt)는 재검사 — stale-auth 방지
      const exp = cached.apiKey?.expiresAt;
      if (!(exp && new Date(exp) < new Date())) return cached;
      await cache.invalidate(keyHash); // 만료 → 캐시 제거 후 재조회
    }

    const record = await repo.findByHash(keyHash);
    const result = validateApiKeyRecord(record, { freemiumPlans: env.restrictedPlans });
    if (result.valid) await cache.setValidation(keyHash, result);
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
    if (!options.keepOldKeyActive) {
      const max = await this.deps.planConfig.getApiKeyLimit(plan);
      if (await this.deps.repo.countActive(userId) >= max) throw new Error(`API key limit reached. Max ${max} keys.`);
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
