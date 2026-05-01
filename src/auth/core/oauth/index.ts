/**
 * Shared Auth - OAuth Module
 *
 * OAuth 2.0 인증 모듈 (프레임워크 독립적)
 * 플러그인 기반 프로바이더 레지스트리 패턴
 */

import type { OAuthConfig, OAuthUserInfo, OAuthTokenResponse, Logger, IOAuthProviderAdapter, OAuthProviderConfig } from '@withwiz/auth/types';
import { OAUTH_PROVIDERS } from '@withwiz/auth/types';
import { OAuthError } from '@withwiz/auth/errors';
import { GoogleOAuthProvider } from './providers/google';
import { GitHubOAuthProvider } from './providers/github';
import { KakaoOAuthProvider } from './providers/kakao';

// Re-export OAUTH_PROVIDERS
export { OAUTH_PROVIDERS };

// Re-export provider adapters
export { GoogleOAuthProvider, GitHubOAuthProvider, KakaoOAuthProvider } from './providers';

// ============================================================================
// OAuth Manager Class
// ============================================================================

export class OAuthManager {
  private config: OAuthConfig;
  private logger: Logger;
  private providers = new Map<string, IOAuthProviderAdapter>();

  constructor(config: OAuthConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Auto-register built-in providers
    this.registerProvider(new GoogleOAuthProvider());
    this.registerProvider(new GitHubOAuthProvider());
    this.registerProvider(new KakaoOAuthProvider());
  }

  /**
   * 프로바이더 어댑터 등록
   */
  registerProvider(provider: IOAuthProviderAdapter): void {
    this.providers.set(provider.name, provider);
    this.logger.debug(`OAuth provider registered: ${provider.name}`);
  }

  /**
   * OAuth 로그인 URL 생성
   */
  getLoginUrl(providerName: string, state: string): string {
    const provider = this.getProvider(providerName);
    const config = this.getProviderConfig(providerName);
    return provider.getLoginUrl(config, state);
  }

  /**
   * 인증 코드를 액세스 토큰으로 교환
   */
  async exchangeCodeForToken(providerName: string, code: string): Promise<string> {
    const provider = this.getProvider(providerName);
    const config = this.getProviderConfig(providerName);

    try {
      const tokenResponse = await provider.exchangeCodeForToken(config, code);
      this.logger.debug(`${providerName} token exchange successful`);
      return tokenResponse.access_token;
    } catch (error: any) {
      this.logger.error(`${providerName} token exchange error`, { error: error.message });
      throw error instanceof OAuthError
        ? error
        : new OAuthError(`${providerName} token exchange failed`, 'TOKEN_EXCHANGE_FAILED');
    }
  }

  /**
   * 사용자 정보 가져오기
   */
  async getUserInfo(providerName: string, accessToken: string): Promise<OAuthUserInfo> {
    const provider = this.getProvider(providerName);

    try {
      const userInfo = await provider.getUserInfo(accessToken);
      this.logger.debug(`${providerName} user info retrieved`, { userId: userInfo.id, email: userInfo.email });
      return userInfo;
    } catch (error: any) {
      this.logger.error(`${providerName} user info error`, { error: error.message });
      throw error instanceof OAuthError
        ? error
        : new OAuthError(`Failed to retrieve ${providerName} user info`, 'USER_INFO_FAILED');
    }
  }

  /**
   * 프로바이더 어댑터 조회
   */
  private getProvider(name: string): IOAuthProviderAdapter {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new OAuthError(`Unsupported OAuth provider: ${name}`, 'UNSUPPORTED_PROVIDER');
    }
    return provider;
  }

  /**
   * 프로바이더 설정 조회
   */
  private getProviderConfig(providerName: string): OAuthProviderConfig {
    const config = this.config.providers[providerName];
    if (!config) {
      throw new OAuthError(`${providerName} OAuth not configured`, `${providerName.toUpperCase()}_NOT_CONFIGURED`);
    }
    return config;
  }
}

// Export types
export type { OAuthConfig, OAuthUserInfo, OAuthTokenResponse, IOAuthProviderAdapter, OAuthProviderConfig } from '@withwiz/auth/types';
