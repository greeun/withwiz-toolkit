/**
 * Microsoft OAuth Provider Adapter
 *
 * Microsoft Entra v2.0 (common 테넌트, server-side code flow).
 *
 * 신뢰 모델: 이 어댑터의 `getUserInfo`는 동일 어댑터의 `exchangeCodeForToken`이
 * 반환한 토큰만 입력으로 받는다는 가정 하에 동작한다 (HTTPS code-flow 채널 신뢰).
 * 외부에서 받은 id_token을 직접 주입하지 말 것. 클라이언트-사이드 흐름(SPA/PKCE)
 * 지원이 필요해지면 JWKS 기반 서명 검증을 별도 spec으로 추가한다.
 *
 * 인터페이스 우회: IOAuthProviderAdapter 변경 없이 id_token 클레임을 사용하기
 * 위해, exchangeCodeForToken은 upstream의 `id_token` 값을 OAuthTokenResponse.access_token
 * 필드에 담아 반환한다. getUserInfo는 그 문자열을 jose.decodeJwt로 디코딩한다.
 */

import { decodeJwt } from 'jose';
import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/auth/types';
import { OAuthError } from '@withwiz/auth/errors';

interface MicrosoftIdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  oid?: string;
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  email_verified?: boolean;
}

interface MicrosoftTokenResponse {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export class MicrosoftOAuthProvider implements IOAuthProviderAdapter {
  readonly name = 'microsoft';

  getLoginUrl(config: OAuthProviderConfig, state?: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid profile email',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(_config: OAuthProviderConfig, _code: string): Promise<OAuthTokenResponse> {
    throw new OAuthError('Not implemented yet', 'NOT_IMPLEMENTED');
  }

  async getUserInfo(_token: string): Promise<OAuthUserInfo> {
    throw new OAuthError('Not implemented yet', 'NOT_IMPLEMENTED');
  }
}
