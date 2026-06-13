/**
 * Microsoft OAuth Provider Adapter
 *
 * Microsoft Entra v2.0 (common 테넌트, server-side code flow).
 *
 * 신뢰 모델: id_token 은 Microsoft Entra v2.0 JWKS 로 RS256 서명을
 * 암호학적으로 검증한 뒤에만 클레임을 신뢰한다(O-2). 따라서 getUserInfo 가
 * 외부에서 주입된 토큰을 받아도 위조 토큰은 서명 검증에서 거부되며,
 * 클라이언트-사이드 흐름(SPA/PKCE)에서도 안전하다.
 *
 * 인터페이스 우회: IOAuthProviderAdapter 변경 없이 id_token 클레임을 사용하기
 * 위해, exchangeCodeForToken은 upstream의 `id_token` 값을 OAuthTokenResponse.access_token
 * 필드에 담아 반환한다. getUserInfo는 그 문자열을 JWKS 서명 검증 후 사용한다.
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/toolkit/core/auth/types';
import { OAuthError } from '@withwiz/toolkit/core/auth/errors';

// Microsoft Entra v2.0 (multi-tenant 'common') 서명 키 — 원격 JWKS.
// createRemoteJWKSet 은 키를 캐싱하므로 매 검증마다 네트워크를 타지 않는다.
const MS_JWKS = createRemoteJWKSet(
  new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'),
);

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

    // JWKS 서명 검증 + 클레임(aud=config.clientId) 검증 후 반환.
    await verifyMicrosoftClaims(data.id_token, config.clientId);

    // Interface workaround: place id_token in the access_token field so getUserInfo can verify it.
    return {
      access_token: data.id_token,
      token_type: data.token_type ?? 'Bearer',
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
      scope: data.scope,
    };
  }

  async getUserInfo(idToken: string): Promise<OAuthUserInfo> {
    // O-2: 외부 입력일 수 있는 idToken 을 JWKS 로 암호학적 서명 검증한다.
    // aud 는 exchangeCodeForToken 시점에 검증되므로 여기서는 서명 + iss/exp/oid.
    const claims = await verifyMicrosoftClaims(idToken);

    return {
      id: claims.oid as string,
      email: (claims.email ?? claims.preferred_username) as string,
      name: claims.name ?? null,
      image: null,
      emailVerified: claims.email_verified === true,
    };
  }
}

/**
 * Microsoft JWKS 로 RS256 서명을 검증하고 클레임을 반환한다.
 * 서명 실패/만료/형식 오류는 모두 OAuthError(INVALID_RESPONSE)로 정규화한다.
 */
async function verifyMicrosoftClaims(
  token: string,
  expectedAud?: string,
): Promise<MicrosoftIdTokenClaims> {
  let claims: MicrosoftIdTokenClaims;
  try {
    const { payload } = await jwtVerify(token, MS_JWKS, { algorithms: ['RS256'] });
    claims = payload as MicrosoftIdTokenClaims;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'ERR_JWT_EXPIRED') {
      throw new OAuthError('Invalid Microsoft id_token: expired', 'INVALID_RESPONSE');
    }
    throw new OAuthError(
      'Invalid Microsoft id_token: signature verification failed',
      'INVALID_RESPONSE',
    );
  }
  assertMicrosoftClaims(claims, expectedAud);
  return claims;
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
