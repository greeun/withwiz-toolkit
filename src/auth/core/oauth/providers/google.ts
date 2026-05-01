/**
 * Google OAuth Provider Adapter
 *
 * Google OAuth 2.0 인증 어댑터
 */

import type { IOAuthProviderAdapter, OAuthProviderConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/auth/types';
import { OAuthError } from '@withwiz/auth/errors';

export class GoogleOAuthProvider implements IOAuthProviderAdapter {
  readonly name = 'google';

  getLoginUrl(config: OAuthProviderConfig, state?: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account consent',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
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
      throw new OAuthError(`Google token exchange failed: ${errorData}`, 'TOKEN_EXCHANGE_FAILED');
    }

    return response.json();
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new OAuthError('Failed to get Google user info', 'USER_INFO_FAILED');
    }

    const data = await response.json();

    return {
      id: data.id,
      email: data.email,
      name: data.name || null,
      image: data.picture || null,
      emailVerified: data.verified_email || false,
    };
  }
}
