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

// 응답 code 값(40101/40301/50001)은 소비처 wire 계약 — api-key-auth.ts:15 주석이 스펙.
// 값이 바뀌면 소비처 에러 분기가 배포 후 파손되므로 body 단위로 고정한다.
describe('createApiKeyAuth wire 계약 (api-gap-testcases.md)', () => {
  async function body(r: Awaited<ReturnType<ReturnType<typeof createApiKeyAuth>>>) {
    if (!('response' in r)) throw new Error('response 아님 — user 반환됨');
    return r.response.json();
  }

  it('TC-API-OAPI-001: 헤더 없음 → body {success:false, error:{40101, 고정 메시지}}', async () => {
    const r = await createApiKeyAuth(opts())(req());
    expect(await body(r)).toEqual({
      success: false,
      error: { code: 40101, message: 'X-API-Key header is required' },
    });
  });

  it('TC-API-OAPI-002: 무효 키 → 40101 + validate message 전달', async () => {
    const o = opts();
    o.service.validateApiKey = vi.fn(async () => ({ valid: false, message: 'API key has expired' }));
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('response' in r && r.response.status).toBe(401);
    expect(await body(r)).toEqual({
      success: false,
      error: { code: 40101, message: 'API key has expired' },
    });
  });

  it('TC-API-OAPI-003: IP 위반 → 40301', async () => {
    const o = opts();
    o.service.validateApiKey = vi.fn(async () => ({ ...okValidation, apiKey: { ...okValidation.apiKey, ipWhitelist: ['9.9.9.9'] } }));
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect(await body(r)).toEqual({
      success: false,
      error: { code: 40301, message: 'Access denied: IP not in whitelist' },
    });
  });

  it('TC-API-OAPI-004: usage 초과 → 40301 + daily/monthly 메시지 분기', async () => {
    for (const [reason, word] of [['DAILY_LIMIT', 'daily'], ['MONTHLY_LIMIT', 'monthly']] as const) {
      const o = opts();
      o.usage.canMakeApiCall = vi.fn(async () => ({ allowed: false, reason, current: { daily: 10, monthly: 10 }, limit: { daily: 10, monthly: 100 } }));
      const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
      const b = await body(r);
      expect(b.error.code).toBe(40301);
      expect(b.error.message).toContain(`API ${word} usage limit exceeded`);
    }
  });

  it('TC-API-OAPI-005: 예외 → 50001 (내부 정보 미노출 고정 메시지)', async () => {
    const o = opts();
    o.service.validateApiKey = vi.fn(async () => { throw new Error('db down'); });
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect(await body(r)).toEqual({
      success: false,
      error: { code: 50001, message: 'Internal authentication error' },
    });
  });

  it('TC-API-OAPI-006: usage tracker throw → 가용성 우선 허용 (인증 성공)', async () => {
    const o = opts();
    o.usage.canMakeApiCall = vi.fn(async () => { throw new Error('usage store down'); });
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('user' in r && r.user.id).toBe('u1');
  });

  it('TC-API-OAPI-007: resolveRole 결과 반영 + user 매핑 정확', async () => {
    const o = opts({ resolveRole: vi.fn(async () => 'ADMIN' as const) });
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('user' in r && r.user).toEqual({
      id: 'u1', email: 'a@b', role: 'ADMIN', plan: 'PRO', apiKeyId: 'k1',
    });
  });

  it('TC-API-OAPI-008: valid=true여도 user/apiKey 누락이면 401 (방어 분기)', async () => {
    const o = opts();
    o.service.validateApiKey = vi.fn(async () => ({ valid: true, apiKey: okValidation.apiKey, user: undefined }));
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('response' in r && r.response.status).toBe(401);
    expect((await body(r)).error.code).toBe(40101);
  });

  it('TC-API-OAPI-009: ipWhitelist 미설정(undefined) → IP 제한 없음 허용', async () => {
    const o = opts();
    o.service.validateApiKey = vi.fn(async () => ({ ...okValidation, apiKey: { ...okValidation.apiKey, ipWhitelist: undefined } }));
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('user' in r && r.user.id).toBe('u1');
  });

  it('TC-API-OAPI-010: 소비자 주입 trackUsage reject → fire-and-forget, 인증 성공 유지', async () => {
    const o = opts();
    o.service.trackUsage = vi.fn(async () => { throw new Error('tracking down'); });
    const r = await createApiKeyAuth(o)(req({ 'x-api-key': 'sk_live_x' }));
    expect('user' in r && r.user.id).toBe('u1'); // unhandled rejection 발생 시 vitest가 실패시킴
  });
});
