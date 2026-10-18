/**
 * GitHub OAuth Provider Adapter
 *
 * GitHub OAuth 2.0 인증 어댑터
 */

import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/toolkit/core/auth/types';
import { OAuthError } from '@withwiz/toolkit/core/auth/errors';

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
    // /user 의 email 은 공개 프로필 값이라 인증 여부가 없고, 비공개 설정이면 null 이다 → 주 이메일과 그 인증 여부를 쓴다
    const primary = await this.getPrimaryEmail(accessToken);

    return {
      id: data.id.toString(),
      email: primary ? primary.email : data.email,
      name: data.name || null,
      image: data.avatar_url || null,
      emailVerified: primary?.verified === true,
    };
  }

  /** `user:email` 범위로 주 이메일을 조회한다. 조회하지 못하면 null(그때 이메일은 미인증으로 본다) */
  private async getPrimaryEmail(accessToken: string): Promise<{ email: string; verified: boolean } | null> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Auth-Module',
        },
      });
      if (!response.ok) return null;
      const emails: unknown = await response.json();
      if (!Array.isArray(emails)) return null;
      const primary = emails.find((e) => e?.primary === true && typeof e.email === 'string');
      return primary ? { email: primary.email, verified: primary.verified === true } : null;
    } catch {
      return null;
    }
  }
}
