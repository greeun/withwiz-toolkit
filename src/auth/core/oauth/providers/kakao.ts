/**
 * Kakao OAuth Provider Adapter
 *
 * Kakao OAuth 2.0 인증 어댑터
 */

import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/auth/types';
import { OAuthError } from '@withwiz/auth/errors';

export class KakaoOAuthProvider implements IOAuthProviderAdapter {
  readonly name = 'kakao';

  getLoginUrl(config: OAuthProviderConfig, state?: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'profile_nickname profile_image account_email',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new OAuthError(`Kakao token exchange failed: ${errorData}`, 'TOKEN_EXCHANGE_FAILED');
    }

    return response.json();
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new OAuthError('Failed to get Kakao user info', 'USER_INFO_FAILED');
    }

    const data = await response.json();
    const account = data.kakao_account || {};
    const profile = account.profile || {};

    return {
      id: data.id.toString(),
      email: account.email,
      name: profile.nickname || null,
      image: profile.profile_image_url || null,
      emailVerified: account.is_email_verified || false,
    };
  }
}
