import { describe, it, expect, vi } from 'vitest';
import { createApiKeyAuth } from '../../../src/next/oapi/api-key-auth';

function req(headers: Record<string, string> = {}, path = '/oapi/v1/links') {
  return { headers: new Headers(headers), nextUrl: { pathname: path } } as any;
}
const okValidation = {
  valid: true,
  apiKey: { id: 'k1', userId: 'u1', permissions: ['read'], rateLimit: 100, ipWhitelist: [], environment: 'production' },
  user: { id: 'u1', email: 'a@b', plan: 'PRO' },
};
function opts(over: any = {}) {
  return {
    service: { validateApiKey: vi.fn(async () => okValidation), trackUsage: vi.fn(async () => {}) },
    usage: { canMakeApiCall: vi.fn(async () => ({ allowed: true, current: { daily: 0, monthly: 0 }, limit: { daily: 1, monthly: 1 } })), logUsage: vi.fn(async () => {}) },
    extractClientIp: () => '1.2.3.4',
    resolveRole: vi.fn(async () => 'USER' as const),
    ...over,
  };
}

describe('createApiKeyAuth', () => {
  it('x-api-key 없음 → 401 response', async () => {
    const r = await createApiKeyAuth(opts())(req());
    expect('response' in r && r.response.status).toBe(401);
  });
  it('유효 키 → user 반환 + trackUsage 호출', async () => {
    const o = opts();
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('user' in r && r.user.id).toBe('u1');
    expect(o.service.trackUsage).toHaveBeenCalled();
  });
  it('IP 화이트리스트 위반 → 403', async () => {
    const o = opts();
    o.service.validateApiKey = vi.fn(async () => ({ ...okValidation, apiKey: { ...okValidation.apiKey, ipWhitelist: ['9.9.9.9'] } }));
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('response' in r && r.response.status).toBe(403);
  });
  it('사용량 초과 → 403', async () => {
    const o = opts();
    o.usage.canMakeApiCall = vi.fn(async () => ({ allowed: false, reason: 'DAILY_LIMIT', current: { daily: 10, monthly: 10 }, limit: { daily: 10, monthly: 100 } }));
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('response' in r && r.response.status).toBe(403);
  });
  it('validateApiKey throw → 500 (예외 안전 degrade)', async () => {
    const o = opts();
    o.service.validateApiKey = vi.fn(async () => { throw new Error('db down'); });
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('response' in r && r.response.status).toBe(500);
  });
});
