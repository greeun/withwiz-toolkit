import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '@withwiz/toolkit/core/auth/oauth';
// state-cookie 는 서브모듈 경로에서 import — handlers.test.ts 가 oauth
// 인덱스를 OAuthManager 만으로 mock 하므로 인덱스 경유 시 가려진다.
import {
  generateOAuthState,
  setOAuthStateCookie,
} from '@withwiz/toolkit/core/auth/oauth/state-cookie';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder, zodFieldErrors } from '@withwiz/toolkit/next/auth-handlers/respond';

export function createOAuthAuthorizeHandler(options: AuthHandlerOptions) {
  const respond = createAuthResponder(options);
  const { oauth } = options;

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await request.json();
      const provider = body.provider as string;

      if (!provider || !oauth?.[provider]) {
        return respond.error(request, { status: 400, key: 'OAUTH_PROVIDER_INVALID', message: 'Invalid provider' });
      }

      const providers: Record<string, { clientId: string; clientSecret: string; redirectUri: string }> = {};
      for (const [name, config] of Object.entries(oauth)) {
        providers[name] = config;
      }

      const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };
      const manager = new OAuthManager({ providers }, options.dependencies.logger ?? noopLogger);
      const state = generateOAuthState();
      const loginUrl = manager.getLoginUrl(provider, state);

      const response = NextResponse.json({ success: true, loginUrl, state });
      setOAuthStateCookie(response, state, {
        secure: options.cookie?.secure,
        sameSite: options.cookie?.sameSite,
        domain: options.cookie?.domain,
      });
      return response;
    } catch {
      return respond.error(request, { status: 500, key: 'OAUTH_INIT_FAILED', message: 'OAuth initialization failed' });
    }
  };
}
