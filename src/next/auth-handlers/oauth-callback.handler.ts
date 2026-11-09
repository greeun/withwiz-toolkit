import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '@withwiz/toolkit/core/auth/oauth';
// state-cookie 는 서브모듈 경로에서 import — handlers.test.ts 가 oauth
// 인덱스를 OAuthManager 만으로 mock 하므로 인덱스 경유 시 가려진다.
import {
  oauthStateCookieName,
  validateOAuthState,
  clearOAuthStateCookie,
} from '@withwiz/toolkit/core/auth/oauth/state-cookie';
import {
  OAuthCallbackService,
  type OAuthCallbackResult,
} from '@withwiz/toolkit/core/auth/services/oauth-callback.service';
import { setTokenCookies } from '@withwiz/toolkit/core/auth/jwt/cookie';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { createAuthResponder } from '@withwiz/toolkit/next/auth-handlers/respond';
import { getMfaRuntime } from '@withwiz/toolkit/next/auth-handlers/mfa-runtime';
import { setMfaPendingCookie } from '@withwiz/toolkit/next/auth-handlers/mfa-pending';
import { AMR } from '@withwiz/toolkit/core/auth/mfa/amr';

export function createOAuthCallbackHandler(options: AuthHandlerOptions) {
  const respond = createAuthResponder(options);
  const { dependencies, jwt, oauth, hooks, cookie, urls } = options;
  const callbackService = new OAuthCallbackService({
    userRepository: dependencies.userRepository,
    oauthAccountRepository: dependencies.oauthAccountRepository,
    jwtSecret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry,
    refreshTokenExpiry: jwt.refreshTokenExpiry,
    logger: dependencies.logger,
  });
  const mfaRuntime = getMfaRuntime(options);

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

      // 자기 속성만 인정한다 — `__proto__`·`constructor` 같은 이름이 프로토타입을 통해 통과하지 않게.
      if (!code || !provider || !oauth || !Object.prototype.hasOwnProperty.call(oauth, provider)) {
        return respond.error(request, { status: 400, key: 'OAUTH_CALLBACK_INVALID', message: 'Invalid callback' });
      }

      // O-1: 코드 교환 이전에 state(query) 와 쿠키를 strict 검증.
      const stateParam = url.searchParams.get('state');
      const stateCookie = request.cookies.get(oauthStateCookieName())?.value;
      if (!validateOAuthState(stateCookie, stateParam)) {
        const res = respond.error(request, { status: 400, key: 'OAUTH_STATE_INVALID', message: 'Invalid OAuth state' });
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
          const res = respond.error(request, { status: 403, key: 'EMAIL_NOT_ALLOWED', message: 'Email not allowed' });
          return clearOAuthStateCookie(res, stateCookieOpts);
        }
      }

      const callbackInput = {
        provider,
        providerAccountId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.image,
        accessToken,
        emailVerified: userInfo.emailVerified,
      };

      let result: OAuthCallbackResult;
      if (!mfaRuntime) {
        // mfa 미설정: 0.29 와 같은 경로(resolveUser → updateLastLoginAt → issueTokens, amr 없음)
        result = await callbackService.handleCallback(callbackInput);
      } else {
        // 사용자 확정과 보안 검사(미검증 이메일 연결 거부 등)는 MFA 판정보다 먼저 한다.
        const { user, isNewUser } = await callbackService.resolveUser(callbackInput);

        // 신규 사용자는 MFA 를 켰을 수 없으므로 건너뛴다.
        if (!isNewUser && (await mfaRuntime.service.isEnabled(user.id))) {
          // 2단계 인증 전에는 로그인 기록·onAfterOAuth·세션 토큰 발급을 하지 않는다.
          const { token } = await mfaRuntime.jwtService.createMfaPendingToken({
            userId: user.id,
            amr: [AMR.FEDERATED],
            origin: 'oauth',
            provider,
          });
          const response = NextResponse.redirect(new URL(urls.mfaChallenge!, urls.baseUrl), 302);
          setMfaPendingCookie(response, token, { secure: cookie?.secure, path: mfaRuntime.cookiePath });
          return clearOAuthStateCookie(response, stateCookieOpts);
        }

        // 신규 사용자는 로그인 기록을 남기지 않는다(handleCallback 과 같은 순서).
        if (!isNewUser) await dependencies.userRepository.updateLastLoginAt(user.id);
        const tokens = await callbackService.issueTokens(user, { amr: [AMR.FEDERATED] });
        result = { user, tokens, isNewUser };
      }

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
        const res = respond.fromAuthError(request, error, false);
        return clearOAuthStateCookie(res, stateCookieOpts);
      }
      const res = respond.error(request, { status: 500, key: 'INTERNAL_SERVER_ERROR', message: 'OAuth callback failed' });
      return clearOAuthStateCookie(res, stateCookieOpts);
    }
  };
}
