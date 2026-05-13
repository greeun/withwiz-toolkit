/**
 * Meta(Facebook) OAuth Provider Adapter
 *
 * Meta OAuth 2.0 인증 어댑터 (Graph API v25.0).
 * - Token 교환은 Meta 공식 권고에 따라 GET + query string 사용
 * - 사용자 정보는 Graph /me?fields=id,name,email,picture 응답에서 매핑
 */

import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/auth/types';
import { OAuthError } from '@withwiz/auth/errors';

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

  async exchangeCodeForToken(_config: OAuthProviderConfig, _code: string): Promise<OAuthTokenResponse> {
    throw new OAuthError('Not implemented yet', 'NOT_IMPLEMENTED');
  }

  async getUserInfo(_accessToken: string): Promise<OAuthUserInfo> {
    throw new OAuthError('Not implemented yet', 'NOT_IMPLEMENTED');
  }
}
