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
import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/core/auth/types';
import { OAuthError } from '@withwiz/core/auth/errors';

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

  async exchangeCodeForToken(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
        scope: 'openid profile email',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new OAuthError(`Microsoft token exchange failed: ${errorData}`, 'TOKEN_EXCHANGE_FAILED');
    }

    const data = (await response.json()) as MicrosoftTokenResponse;

    if (data.error) {
      throw new OAuthError(
        `Microsoft token exchange failed: ${data.error}${data.error_description ? ` - ${data.error_description}` : ''}`,
        'TOKEN_EXCHANGE_FAILED',
      );
    }

    if (!data.id_token) {
      throw new OAuthError('Missing id_token in Microsoft token response', 'INVALID_RESPONSE');
    }

    // Validate id_token claims (including aud against config.clientId) before returning.
    const claims = decodeMicrosoftClaims(data.id_token);
    assertMicrosoftClaims(claims, config.clientId);

    // Interface workaround: place id_token in the access_token field so getUserInfo can decode it.
    return {
      access_token: data.id_token,
      token_type: data.token_type ?? 'Bearer',
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
      scope: data.scope,
    };
  }

  async getUserInfo(idToken: string): Promise<OAuthUserInfo> {
    const claims = decodeMicrosoftClaims(idToken);
    // Defensive: re-verify iss/exp/oid here (aud was validated at exchangeCodeForToken time).
    // This protects against the rare case where a caller invokes getUserInfo with a non-canonical
    // token. See trust model in the file header JSDoc.
    assertMicrosoftClaims(claims);

    return {
      id: claims.oid as string,
      email: (claims.email ?? claims.preferred_username) as string,
      name: claims.name ?? null,
      image: null,
      emailVerified: claims.email_verified === true,
    };
  }
}

function decodeMicrosoftClaims(token: string): MicrosoftIdTokenClaims {
  try {
    return decodeJwt(token) as MicrosoftIdTokenClaims;
  } catch {
    throw new OAuthError('Invalid Microsoft id_token: malformed JWT', 'INVALID_RESPONSE');
  }
}

function assertMicrosoftClaims(claims: MicrosoftIdTokenClaims, expectedAud?: string): void {
  if (
    !claims.iss ||
    !/^https:\/\/login\.microsoftonline\.com\/(?!common\/|consumers\/|organizations\/)[\w-]+\/v2\.0$/.test(claims.iss)
  ) {
    throw new OAuthError('Invalid Microsoft id_token: bad iss', 'INVALID_RESPONSE');
  }
  if (expectedAud !== undefined && claims.aud !== expectedAud) {
    throw new OAuthError('Invalid Microsoft id_token: aud mismatch', 'INVALID_RESPONSE');
  }
  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
    throw new OAuthError('Invalid Microsoft id_token: expired', 'INVALID_RESPONSE');
  }
  if (!claims.oid) {
    throw new OAuthError('Invalid Microsoft id_token: missing oid', 'INVALID_RESPONSE');
  }
}
