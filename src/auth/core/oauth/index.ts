/**
 * Shared Auth - OAuth Module
 *
 * OAuth 2.0 인증 모듈 (프레임워크 독립적)
 * Google, GitHub, Kakao 지원
 */

import type { OAuthConfig, OAuthUserInfo, OAuthTokenResponse, Logger } from '@withwiz/auth/types';
import { OAuthProvider } from '@withwiz/auth/types';
import { OAuthError } from '@withwiz/auth/errors';

// Re-export OAuthProvider
export { OAuthProvider };

// ============================================================================
// OAuth Manager Class
// ============================================================================

export class OAuthManager {
  private config: OAuthConfig;
  private logger: Logger;

  constructor(config: OAuthConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * OAuth 로그인 URL 생성
   */
  getLoginUrl(provider: OAuthProvider, state: string): string {
    if (provider === OAuthProvider.GOOGLE) {
      return this.getGoogleLoginUrl(state);
    } else if (provider === OAuthProvider.GITHUB) {
      return this.getGitHubLoginUrl(state);
    } else if (provider === OAuthProvider.KAKAO) {
      return this.getKakaoLoginUrl(state);
    }
    throw new OAuthError(`Unsupported OAuth provider: ${provider}`, 'UNSUPPORTED_PROVIDER');
  }

  /**
   * Google OAuth 로그인 URL
   */
  private getGoogleLoginUrl(state: string): string {
    if (!this.config.google) {
      throw new OAuthError('Google OAuth not configured', 'GOOGLE_NOT_CONFIGURED');
    }

    const params = new URLSearchParams({
      client_id: this.config.google.clientId,
      redirect_uri: this.config.google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * GitHub OAuth 로그인 URL
   */
  private getGitHubLoginUrl(state: string): string {
    if (!this.config.github) {
      throw new OAuthError('GitHub OAuth not configured', 'GITHUB_NOT_CONFIGURED');
    }

    const params = new URLSearchParams({
      client_id: this.config.github.clientId,
      redirect_uri: this.config.github.redirectUri,
      scope: 'read:user user:email',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * 인증 코드를 액세스 토큰으로 교환
   */
  async exchangeCodeForToken(provider: OAuthProvider, code: string): Promise<string> {
    if (provider === OAuthProvider.GOOGLE) {
      return this.exchangeGoogleCode(code);
    } else if (provider === OAuthProvider.GITHUB) {
      return this.exchangeGitHubCode(code);
    } else if (provider === OAuthProvider.KAKAO) {
      return this.exchangeKakaoCode(code);
    }
    throw new OAuthError(`Unsupported OAuth provider: ${provider}`, 'UNSUPPORTED_PROVIDER');
  }

  /**
   * Google 코드 교환
   */
  private async exchangeGoogleCode(code: string): Promise<string> {
    if (!this.config.google) {
      throw new OAuthError('Google OAuth not configured', 'GOOGLE_NOT_CONFIGURED');
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.google.clientId,
          client_secret: this.config.google.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.google.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error('Google token exchange failed', { status: response.status, errorData });
        throw new OAuthError('Failed to exchange Google code for token', 'TOKEN_EXCHANGE_FAILED');
      }

      const data: OAuthTokenResponse = await response.json();
      this.logger.debug('Google token exchange successful');
      return data.access_token;
    } catch (error: any) {
      this.logger.error('Google token exchange error', { error: error.message });
      throw new OAuthError('Google token exchange failed', 'TOKEN_EXCHANGE_FAILED');
    }
  }

  /**
   * GitHub 코드 교환
   */
  private async exchangeGitHubCode(code: string): Promise<string> {
    if (!this.config.github) {
      throw new OAuthError('GitHub OAuth not configured', 'GITHUB_NOT_CONFIGURED');
    }

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.github.clientId,
          client_secret: this.config.github.clientSecret,
          code,
          redirect_uri: this.config.github.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error('GitHub token exchange failed', { status: response.status, errorData });
        throw new OAuthError('Failed to exchange GitHub code for token', 'TOKEN_EXCHANGE_FAILED');
      }

      const data: OAuthTokenResponse = await response.json();
      this.logger.debug('GitHub token exchange successful');
      return data.access_token;
    } catch (error: any) {
      this.logger.error('GitHub token exchange error', { error: error.message });
      throw new OAuthError('GitHub token exchange failed', 'TOKEN_EXCHANGE_FAILED');
    }
  }

  /**
   * Kakao OAuth 로그인 URL
   */
  private getKakaoLoginUrl(state: string): string {
    if (!this.config.kakao) {
      throw new OAuthError('Kakao OAuth not configured', 'KAKAO_NOT_CONFIGURED');
    }

    const params = new URLSearchParams({
      client_id: this.config.kakao.clientId,
      redirect_uri: this.config.kakao.redirectUri,
      response_type: 'code',
      scope: 'profile_nickname profile_image account_email',
      state,
    });

    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Kakao 코드 교환
   */
  private async exchangeKakaoCode(code: string): Promise<string> {
    if (!this.config.kakao) {
      throw new OAuthError('Kakao OAuth not configured', 'KAKAO_NOT_CONFIGURED');
    }

    try {
      const response = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.kakao.clientId,
          client_secret: this.config.kakao.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.kakao.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error('Kakao token exchange failed', { status: response.status, errorData });
        throw new OAuthError('Failed to exchange Kakao code for token', 'TOKEN_EXCHANGE_FAILED');
      }

      const data: OAuthTokenResponse = await response.json();
      this.logger.debug('Kakao token exchange successful');
      return data.access_token;
    } catch (error: any) {
      this.logger.error('Kakao token exchange error', { error: error.message });
      throw new OAuthError('Kakao token exchange failed', 'TOKEN_EXCHANGE_FAILED');
    }
  }

  /**
   * Kakao 사용자 정보
   */
  private async getKakaoUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new OAuthError('Failed to get Kakao user info', 'USER_INFO_FAILED');
      }

      const data = await response.json();
      const account = data.kakao_account || {};
      const profile = account.profile || {};

      this.logger.debug('Kakao user info retrieved', { userId: data.id, email: account.email });

      return {
        id: data.id.toString(),
        email: account.email,
        name: profile.nickname || null,
        image: profile.profile_image_url || null,
        emailVerified: account.is_email_verified || false,
      };
    } catch (error: any) {
      this.logger.error('Kakao user info error', { error: error.message });
      throw new OAuthError('Failed to retrieve Kakao user info', 'USER_INFO_FAILED');
    }
  }

  /**
   * 사용자 정보 가져오기
   */
  async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<OAuthUserInfo> {
    if (provider === OAuthProvider.GOOGLE) {
      return this.getGoogleUserInfo(accessToken);
    } else if (provider === OAuthProvider.GITHUB) {
      return this.getGitHubUserInfo(accessToken);
    } else if (provider === OAuthProvider.KAKAO) {
      return this.getKakaoUserInfo(accessToken);
    }
    throw new OAuthError(`Unsupported OAuth provider: ${provider}`, 'UNSUPPORTED_PROVIDER');
  }

  /**
   * Google 사용자 정보
   */
  private async getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new OAuthError('Failed to get Google user info', 'USER_INFO_FAILED');
      }

      const data = await response.json();
      this.logger.debug('Google user info retrieved', { userId: data.id, email: data.email });

      return {
        id: data.id,
        email: data.email,
        name: data.name || null,
        image: data.picture || null,
        emailVerified: data.verified_email || false,
      };
    } catch (error: any) {
      this.logger.error('Google user info error', { error: error.message });
      throw new OAuthError('Failed to retrieve Google user info', 'USER_INFO_FAILED');
    }
  }

  /**
   * GitHub 사용자 정보
   */
  private async getGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
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
      this.logger.debug('GitHub user info retrieved', { userId: data.id, login: data.login });

      return {
        id: data.id.toString(),
        email: data.email,
        name: data.name || null,
        image: data.avatar_url || null,
        emailVerified: !!data.email,
      };
    } catch (error: any) {
      this.logger.error('GitHub user info error', { error: error.message });
      throw new OAuthError('Failed to retrieve GitHub user info', 'USER_INFO_FAILED');
    }
  }
}

// Export types
export type { OAuthConfig, OAuthUserInfo, OAuthTokenResponse } from '@withwiz/auth/types';
