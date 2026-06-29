// API 키 코어 타입 — 프레임워크·DB 무관 순수 타입. plan은 string(enum 비의존).
export type ApiKeyPermission = 'read' | 'write' | 'delete';
export type ApiKeyEnvironment = 'production' | 'development';

export interface CreateApiKeyOptions {
  name: string;
  description?: string;
  permissions: ApiKeyPermission[];
  environment: ApiKeyEnvironment;
  expiresAt?: Date;
  ipWhitelist?: string[];
  customRateLimit?: number;
  endpointLimits?: Record<string, number>;
}

export interface ApiKeyResult {
  id: string;
  key: string; // ⚠️ raw key — 한 번만 반환
  name: string;
  description?: string;
  permissions: ApiKeyPermission[];
  environment: ApiKeyEnvironment;
  rateLimit: number;
  endpointLimits?: Record<string, number>;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ApiKeyInfo {
  id: string; name: string; description?: string; keyPreview: string;
  permissions: ApiKeyPermission[]; environment: ApiKeyEnvironment;
  rateLimit: number; endpointLimits?: Record<string, number>; ipWhitelist: string[];
  lastUsedAt?: Date; lastUsedIp?: string; usageCount: number; isActive: boolean;
  expiresAt?: Date; createdAt: Date; updatedAt: Date;
}

/** validate FSM이 반환하는 검증 실패 코드. */
export type ApiKeyValidationError =
  | 'INVALID_API_KEY'
  | 'INACTIVE_API_KEY'
  | 'EXPIRED_API_KEY'
  | 'INACTIVE_USER'
  | 'PLAN_RESTRICTED';

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: ApiKeyValidationError;
  message?: string;
  apiKey?: {
    id: string; userId: string; permissions: ApiKeyPermission[];
    rateLimit: number; endpointLimits?: Record<string, number>;
    ipWhitelist: string[]; environment: ApiKeyEnvironment;
    expiresAt?: Date | null; // 캐시 hit 시 자연 만료 재검사용
  };
  user?: { id: string; email: string; plan: string }; // plan: string (enum 비의존)
}

export interface UpdateApiKeyData {
  name?: string; description?: string; isActive?: boolean;
  permissions?: ApiKeyPermission[]; ipWhitelist?: string[];
  customRateLimit?: number; endpointLimits?: Record<string, number>;
}

export interface ApiKeyFilters {
  userId?: string; environment?: ApiKeyEnvironment; isActive?: boolean;
  search?: string; page?: number; pageSize?: number;
}

export interface ApiKeyListResponse {
  keys: ApiKeyInfo[]; total: number; page: number; pageSize: number; hasMore: boolean;
}
