import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '@withwiz/toolkit/core/auth/oauth';
// state-cookie 는 서브모듈 경로에서 import — handlers.test.ts 가 oauth
// 인덱스를 OAuthManager 만으로 mock 하므로 인덱스 경유 시 가려진다.
import {
  OAUTH_STATE_COOKIE,
  validateOAuthState,
  clearOAuthStateCookie,
} from '@withwiz/toolkit/core/auth/oauth/state-cookie';
import { OAuthCallbackService } from '@withwiz/toolkit/core/auth/services/oauth-callback.service';
import { setTokenCookies } from '@withwiz/toolkit/core/auth/jwt/cookie';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

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
    const stateCookieOpts = {
      secure: cookie?.secure,
      sameSite: cookie?.sameSite,
      domain: cookie?.domain,
    };
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const provider = url.searchParams.get('provider') ?? url.pathname.split('/').pop();

      if (!code || !provider || !oauth?.[provider]) {
        return NextResponse.json({ success: false, error: 'Invalid callback' }, { status: 400 });
      }

      // O-1: 코드 교환 이전에 state(query) 와 쿠키를 strict 검증.
      const stateParam = url.searchParams.get('state');
      const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
      if (!validateOAuthState(stateCookie, stateParam)) {
        const res = NextResponse.json(
          { success: false, error: 'Invalid OAuth state' },
          { status: 400 },
        );
        return clearOAuthStateCookie(res, stateCookieOpts);
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
        if (!allowed) {
          const res = NextResponse.json({ success: false, error: 'Email not allowed' }, { status: 403 });
          return clearOAuthStateCookie(res, stateCookieOpts);
        }
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
          return clearOAuthStateCookie(response, stateCookieOpts);
        }
      }

      const redirectUrl = urls.afterOAuth ?? urls.afterLogin ?? '/';
      const response = NextResponse.redirect(new URL(redirectUrl, urls.baseUrl));
      setTokenCookies(response, result.tokens, { secure: cookie?.secure });
      return clearOAuthStateCookie(response, stateCookieOpts);
    } catch (error) {
      if (error instanceof AuthError) {
        const res = NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        return clearOAuthStateCookie(res, stateCookieOpts);
      }
      const res = NextResponse.json({ success: false, error: 'OAuth callback failed' }, { status: 500 });
      return clearOAuthStateCookie(res, stateCookieOpts);
    }
  };
}
