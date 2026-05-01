/**
 * Shared Auth Module
 *
 * 프레임워크 독립적인 인증 라이브러리
 * Next.js, Express, Fastify, NestJS 등 어디서나 사용 가능
 *
 * @version 1.0.0
 * @description 범용 공유 라이브러리 - Tier 3
 */

// ============================================================================
// Types & Errors
// ============================================================================

export * from './types';
export * from './errors';

// ============================================================================
// Core Modules
// ============================================================================

// JWT
export { JWTManager, JWTService } from './core/jwt';
export type { JWTConfig, JWTPayload, TokenPair } from './types';

// JWT Client (Browser)
export {
  JWTClientManager,
  getStoredTokens,
  storeTokens,
  clearStoredTokens,
  clearTokens,
  decodeJWTPayload,
  isTokenExpired,
  getTokenRemainingTime,
  extractUserFromToken,
  createAuthHeader,
  createApiHeaders,
  isTokenExpiringSoon,
  getTokenExpirationString,
  getTokenIssuedAtString,
} from './core/jwt/client';

// Password
export {
  PasswordValidator,
  PasswordHasher,
  defaultPasswordSchema,
  strongPasswordSchema,
} from './core/password';
export type { PasswordValidationResult, PasswordConfig } from './core/password';

// Password Client Helper
export {
  DEFAULT_PASSWORD_CONFIG,
  createPasswordValidator,
  validatePassword,
  getPasswordStrength,
  createPasswordSchema,
  passwordValidator,
  createPasswordHasher,
} from './core/password/client-helper';

// OAuth
export { OAuthManager, GoogleOAuthProvider, GitHubOAuthProvider, KakaoOAuthProvider } from './core/oauth';

// Email
export { TokenGenerator } from './core/email/token-generator';

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export { PasswordStrength, OAUTH_PROVIDERS, TokenType } from './types';
