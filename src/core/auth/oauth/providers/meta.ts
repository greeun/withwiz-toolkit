/**
 * Meta(Facebook) OAuth Provider Adapter
 *
 * Meta OAuth 2.0 인증 어댑터 (Graph API v25.0).
 * - Token 교환은 Meta 공식 권고에 따라 GET + query string 사용
 * - 사용자 정보는 Graph /me?fields=id,name,email,picture 응답에서 매핑
 */

import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/toolkit/core/auth/types';
import { OAuthError } from '@withwiz/toolkit/core/auth/errors';

const META_GRAPH_VERSION = 'v25.0';

export class MetaOAuthProvider implements IOAuthProviderAdapter {
  readonly name = 'meta';

  getLoginUrl(config: OAuthProviderConfig, state?: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'email,public_profile',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    });

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.text();
      throw new OAuthError(`Meta token exchange failed: ${errorData}`, 'TOKEN_EXCHANGE_FAILED');
    }

    const data = (await response.json()) as Partial<OAuthTokenResponse>;

    // Meta는 오류를 HTTP 200 + { error: {...} } 로 반환할 수 있어 status만으로 부족.
    // 미검증 캐스팅 방지를 위해 핵심 필드(access_token) 존재를 명시 검증한다.
    if (!data.access_token) {
      throw new OAuthError('Invalid Meta response: missing access_token', 'INVALID_RESPONSE');
    }

    return data as OAuthTokenResponse;
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name,email,picture`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new OAuthError('Failed to get Meta user info', 'USER_INFO_FAILED');
    }

    const data = (await response.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };

    if (!data.id) {
      throw new OAuthError('Invalid Meta response: missing id', 'INVALID_RESPONSE');
    }

    return {
      id: data.id,
      email: data.email as string,
      name: data.name ?? null,
      image: data.picture?.data?.url ?? null,
      // Graph API는 이메일 검증 신호를 제공하지 않음 → 존재만으로 true.
      // Microsoft(email_verified)/Kakao(is_email_verified) 같은 strict 검증 불가(provider 한계).
      emailVerified: !!data.email,
    };
  }
}
