import { generateRawKey, hashKey, keyPreview } from './key-generator';
import { validateApiKeyRecord } from './validate';
import type {
  IApiKeyRepository, IApiKeyCacheStore, IPlanConfigProvider, IUsageTracker, ApiKeyServiceEnv,
} from './ports';
import type { CreateApiKeyOptions, ApiKeyResult, ApiKeyValidationResult } from './types';

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

  async generateApiKey(userId: string, options: CreateApiKeyOptions): Promise<ApiKeyResult> {
    const { repo, planConfig, env } = this.deps;
    const maxKeys = await planConfig.getApiKeyLimit(/* plan 불명 시 */ 'UNKNOWN').catch(() => Infinity);
    // 플랜은 호출측(어댑터 repo)이 user 기준으로 한도를 알지만, 코어는 plan을 모름 →
    // 한도는 countActive vs planConfig 결과로 판정. plan 해석은 어댑터 책임.
    const active = await repo.countActive(userId);
    if (active >= maxKeys) throw new Error(`API key limit reached. Max ${maxKeys} keys.`);

    const rawKey = generateRawKey(this.prefix(options.environment));
    const rateLimit = options.customRateLimit
      ? Math.min(options.customRateLimit, await planConfig.getRateLimit('UNKNOWN').catch(() => options.customRateLimit))
      : await planConfig.getRateLimit('UNKNOWN').catch(() => 100);
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
    if (cached) return cached;

    const record = await repo.findByHash(keyHash);
    const result = validateApiKeyRecord(record, { freemiumPlans: env.restrictedPlans });
    if (result.valid) await cache.setValidation(keyHash, result);
    return result;
  }
}
