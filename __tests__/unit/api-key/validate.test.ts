import { describe, it, expect } from 'vitest';
import { validateApiKeyRecord } from '../../../src/core/api-key/validate';
import type { ApiKeyWithUser } from '../../../src/core/api-key/ports';

const base = (over: Partial<ApiKeyWithUser> = {}): ApiKeyWithUser => ({
  id: 'k1', userId: 'u1', name: 'k', description: null, key: 'hash',
  permissions: ['read'], rateLimit: 100, endpointLimits: null, environment: 'production',
  ipWhitelist: [], isActive: true, usageCount: 0, lastUsedAt: null, lastUsedIp: null,
  expiresAt: null, createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01'),
  user: { id: 'u1', email: 'a@b.c', isActive: true, plan: 'PRO' }, ...over,
});

describe('validateApiKeyRecord', () => {
  it('null → INVALID_API_KEY', () => {
    expect(validateApiKeyRecord(null, {}).error).toBe('INVALID_API_KEY');
  });
  it('비활성 키 → INACTIVE_API_KEY', () => {
    expect(validateApiKeyRecord(base({ isActive: false }), {}).error).toBe('INACTIVE_API_KEY');
  });
  it('만료 키 → EXPIRED_API_KEY', () => {
    expect(validateApiKeyRecord(base({ expiresAt: new Date('2000-01-01') }), {}).error).toBe('EXPIRED_API_KEY');
  });
  it('비활성 사용자 → INACTIVE_USER', () => {
    const r = base(); r.user.isActive = false;
    expect(validateApiKeyRecord(r, {}).error).toBe('INACTIVE_USER');
  });
  it('제한 플랜 → PLAN_RESTRICTED', () => {
    const r = base(); r.user.plan = 'FREEMIUM';
    expect(validateApiKeyRecord(r, { freemiumPlans: ['FREEMIUM'] }).error).toBe('PLAN_RESTRICTED');
  });
  it('정상 → valid true + apiKey/user 채움', () => {
    const res = validateApiKeyRecord(base(), {});
    expect(res.valid).toBe(true);
    expect(res.apiKey?.id).toBe('k1');
    expect(res.user?.plan).toBe('PRO');
  });
});
