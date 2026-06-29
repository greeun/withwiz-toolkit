import type {
  ApiKeyEnvironment, ApiKeyPermission, ApiKeyFilters, ApiKeyValidationResult,
} from '@withwiz/toolkit/core/api-key/types';

export interface ApiKeyRecord {
  id: string; userId: string; name: string; description: string | null;
  key: string; // hash
  permissions: ApiKeyPermission[]; rateLimit: number;
  endpointLimits: Record<string, number> | null; environment: ApiKeyEnvironment;
  ipWhitelist: string[]; isActive: boolean; usageCount: number;
  lastUsedAt: Date | null; lastUsedIp: string | null;
  expiresAt: Date | null; createdAt: Date; updatedAt: Date;
}

export interface ApiKeyWithUser extends ApiKeyRecord {
  user: { id: string; email: string; isActive: boolean; plan: string };
}

export interface ApiKeyCreateInput {
  userId: string; key: string; name: string; description?: string | null;
  permissions: ApiKeyPermission[]; rateLimit: number;
  endpointLimits?: Record<string, number> | null; environment: ApiKeyEnvironment;
  ipWhitelist: string[]; expiresAt: Date;
}

export interface ApiKeyUpdateInput {
  name?: string; description?: string | null; isActive?: boolean;
  permissions?: ApiKeyPermission[]; ipWhitelist?: string[];
  rateLimit?: number; endpointLimits?: Record<string, number> | null;
}

export interface IApiKeyRepository {
  create(data: ApiKeyCreateInput): Promise<ApiKeyRecord>;
  findByHash(keyHash: string): Promise<ApiKeyWithUser | null>;
  findById(id: string): Promise<ApiKeyRecord | null>;
  findMany(filters: ApiKeyFilters): Promise<{ items: ApiKeyRecord[]; total: number }>;
  countActive(userId: string): Promise<number>;
  update(id: string, data: ApiKeyUpdateInput): Promise<ApiKeyRecord>;
  deactivate(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  incrementUsage(id: string, ip?: string): Promise<void>;
}

export interface IApiKeyCacheStore {
  getValidation(keyHash: string): Promise<ApiKeyValidationResult | null>;
  setValidation(keyHash: string, result: ApiKeyValidationResult): Promise<void>;
  invalidate(keyHash: string): Promise<void>;
  invalidateUser?(userId: string): Promise<void>;
}

export interface IPlanConfigProvider {
  getApiKeyLimit(plan: string): Promise<number>;
  getRateLimit(plan: string): Promise<number>;
  getEndpointLimit?(plan: string, action: string): Promise<number>;
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: 'DAILY_LIMIT' | 'MONTHLY_LIMIT';
  current: { daily: number; monthly: number };
  limit: { daily: number; monthly: number };
}
export interface UsageLogInput {
  apiKeyId: string; userId: string; endpoint: string; ip?: string;
}
export interface IUsageTracker {
  canMakeApiCall(userId: string, plan: string): Promise<UsageCheckResult>;
  /** 코어/미들웨어는 호출하지 않음 — 소비자 라우트 계층 선택 사용(optional). */
  logUsage?(data: UsageLogInput): Promise<void>;
}

export interface ApiKeyServiceEnv {
  prefixProd: string;   // 'sk_live_'
  prefixDev: string;    // 'sk_test_'
  defaultExpiryDays: number; // 365
  /** API키 발급/사용 불가 플랜명 목록. 예: ['FREEMIUM'] */
  restrictedPlans: string[];
}
