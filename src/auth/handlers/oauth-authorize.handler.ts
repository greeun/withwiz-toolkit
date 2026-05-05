import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '../core/oauth';
import type { AuthHandlerOptions } from '../types/handler-types';

export function createOAuthAuthorizeHandler(options: AuthHandlerOptions) {
  const { oauth } = options;

  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = await request.json();
      const provider = body.provider as string;

      if (!provider || !oauth?.[provider]) {
        return NextResponse.json({ success: false, error: 'Invalid provider' }, { status: 400 });
      }

      const providers: Record<string, { clientId: string; clientSecret: string; redirectUri: string }> = {};
      for (const [name, config] of Object.entries(oauth)) {
        providers[name] = config;
      }

      const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };
      const manager = new OAuthManager({ providers }, options.dependencies.logger ?? noopLogger);
      const state = crypto.randomUUID();
      const loginUrl = manager.getLoginUrl(provider, state);

      return NextResponse.json({ success: true, loginUrl, state });
    } catch {
      return NextResponse.json({ success: false, error: 'OAuth initialization failed' }, { status: 500 });
    }
  };
}
