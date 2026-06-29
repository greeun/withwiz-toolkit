import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isIpAllowed } from '@withwiz/toolkit/core/api-key';
import type { ApiKeyService, IUsageTracker } from '@withwiz/toolkit/core/api-key';

export interface AuthedUser { id: string; email: string; role: 'USER' | 'ADMIN'; plan: string; apiKeyId: string; }
export interface ApiKeyAuthOptions {
  service: Pick<ApiKeyService, 'validateApiKey' | 'trackUsage'>;
  usage: IUsageTracker;
  extractClientIp: (h: Headers) => string;
  resolveRole: (userId: string) => Promise<'USER' | 'ADMIN'>;
}
type AuthResult = { user: AuthedUser } | { response: NextResponse };

const err = (code: number, status: number, message: string): { response: NextResponse } =>
  ({ response: NextResponse.json({ success: false, error: { code, message } }, { status }) });

/**
 * x-api-key 인증 미들웨어 팩토리. core ApiKeyService로 키 검증,
 * IP 화이트리스트(core isIpAllowed)·사용량(IUsageTracker) 확인 후 인증 사용자 반환.
 */
export function createApiKeyAuth(options: ApiKeyAuthOptions) {
  return async (req: NextRequest): Promise<AuthResult> => {
    try {
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) return err(40101, 401, 'X-API-Key header is required');

      const v = await options.service.validateApiKey(apiKey);
      if (!v.valid || !v.apiKey || !v.user) return err(40101, 401, v.message || 'Invalid API key');

      const ip = options.extractClientIp(req.headers);
      if (!isIpAllowed(ip, v.apiKey.ipWhitelist ?? null)) return err(40301, 403, 'Access denied: IP not in whitelist');

      try {
        const usage = await options.usage.canMakeApiCall(v.user.id, v.user.plan);
        if (!usage.allowed) {
          const t = usage.reason === 'DAILY_LIMIT' ? 'daily' : 'monthly';
          return err(40301, 403, `API ${t} usage limit exceeded. Please upgrade your plan or wait until reset.`);
        }
      } catch { /* 사용량 확인 실패 → 가용성 우선 허용 */ }

      options.service.trackUsage(v.apiKey.id, ip).catch(() => {});
      const role = await options.resolveRole(v.user.id);
      return { user: { id: v.user.id, email: v.user.email, role, plan: v.user.plan, apiKeyId: v.apiKey.id } };
    } catch {
      // validateApiKey/resolveRole 등 예기치 못한 예외 → 안전한 500 degrade
      return err(50001, 500, 'Internal authentication error');
    }
  };
}
