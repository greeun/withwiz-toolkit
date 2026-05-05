import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '../core/oauth';
import { OAuthCallbackService } from '../services/oauth-callback.service';
import { setTokenCookies } from '../core/jwt/cookie';
import { AuthError } from '../errors';
import type { AuthHandlerOptions } from '../types/handler-types';

export function createOAuthCallbackHandler(options: AuthHandlerOptions) {
  const { dependencies, jwt, oauth, hooks, cookie, urls } = options;
  const callbackService = new OAuthCallbackService({
    userRepository: dependencies.userRepository,
    oauthAccountRepository: dependencies.oauthAccountRepository,
    jwtSecret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry,
    refreshTokenExpiry: jwt.refreshTokenExpiry,
    logger: dependencies.logger,
  });

  return async (request: NextRequest): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const provider = url.searchParams.get('provider') ?? url.pathname.split('/').pop();

      if (!code || !provider || !oauth?.[provider]) {
        return NextResponse.json({ success: false, error: 'Invalid callback' }, { status: 400 });
      }

      const providers: Record<string, { clientId: string; clientSecret: string; redirectUri: string }> = {};
      for (const [name, config] of Object.entries(oauth)) {
        providers[name] = config;
      }

      const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };
      const manager = new OAuthManager({ providers }, dependencies.logger ?? noopLogger);
      const accessToken = await manager.exchangeCodeForToken(provider, code);
      const userInfo = await manager.getUserInfo(provider, accessToken);

      if (hooks?.allowEmail) {
        const allowed = await hooks.allowEmail(userInfo.email);
        if (!allowed) return NextResponse.json({ success: false, error: 'Email not allowed' }, { status: 403 });
      }

      const result = await callbackService.handleCallback({
        provider,
        providerAccountId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.image,
        accessToken,
      });

      if (hooks?.onAfterOAuth) await hooks.onAfterOAuth(result.user, provider, result.isNewUser);

      if (result.isNewUser && hooks?.onOAuthFirstLogin) {
        const redirect = await hooks.onOAuthFirstLogin(result.user, provider);
        if (redirect) {
          const response = NextResponse.redirect(redirect);
          setTokenCookies(response, result.tokens, { secure: cookie?.secure });
          return response;
        }
      }

      const redirectUrl = urls.afterOAuth ?? urls.afterLogin ?? '/';
      const response = NextResponse.redirect(new URL(redirectUrl, urls.baseUrl));
      setTokenCookies(response, result.tokens, { secure: cookie?.secure });
      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
      }
      return NextResponse.json({ success: false, error: 'OAuth callback failed' }, { status: 500 });
    }
  };
}
