import type { ApiKeyWithUser } from '@withwiz/toolkit/core/api-key/ports';
import type { ApiKeyValidationResult } from '@withwiz/toolkit/core/api-key/types';

/**
 * API 키 레코드 검증 FSM(순수). 우선순위:
 * null → 비활성키 → 만료 → 비활성사용자 → 제한플랜 → 정상.
 */
export function validateApiKeyRecord(
  record: ApiKeyWithUser | null,
  opts: { freemiumPlans?: string[] }
): ApiKeyValidationResult {
  if (!record) return { valid: false, error: 'INVALID_API_KEY', message: 'Invalid API key' };
  if (!record.isActive) return { valid: false, error: 'INACTIVE_API_KEY', message: 'API key is inactive' };
  if (record.expiresAt && record.expiresAt < new Date())
    return { valid: false, error: 'EXPIRED_API_KEY', message: 'API key has expired' };
  if (!record.user.isActive) return { valid: false, error: 'INACTIVE_USER', message: 'User account is inactive' };
  if ((opts.freemiumPlans ?? []).includes(record.user.plan))
    return { valid: false, error: 'PLAN_RESTRICTED', message: 'API access is not available for this plan. Please upgrade.' };

  return {
    valid: true,
    apiKey: {
      id: record.id, userId: record.user.id, permissions: record.permissions,
      rateLimit: record.rateLimit, endpointLimits: record.endpointLimits ?? undefined,
      ipWhitelist: record.ipWhitelist, environment: record.environment,
      expiresAt: record.expiresAt,
    },
    user: { id: record.user.id, email: record.user.email, plan: record.user.plan },
  };
}
