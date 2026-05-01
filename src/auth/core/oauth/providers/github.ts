/**
 * GitHub OAuth Provider Adapter
 *
 * GitHub OAuth 2.0 인증 어댑터
 */

import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/auth/types';
import { OAuthError } from '@withwiz/auth/errors';

export class GitHubOAuthProvider implements IOAuthProviderAdapter {
  readonly name = 'github';

  getLoginUrl(config: OAuthProviderConfig, state?: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: 'read:user user:email',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new OAuthError(`GitHub token exchange failed: ${errorData}`, 'TOKEN_EXCHANGE_FAILED');
    }

    return response.json();
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Auth-Module',
      },
    });

    if (!response.ok) {
      throw new OAuthError('Failed to get GitHub user info', 'USER_INFO_FAILED');
    }

    const data = await response.json();

    return {
      id: data.id.toString(),
      email: data.email,
      name: data.name || null,
      image: data.avatar_url || null,
      emailVerified: !!data.email,
    };
  }
}
