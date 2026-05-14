import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';
import { JWT_DEFAULTS } from '../constants/security';

export interface AuthConfig {
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  cookieSecure?: boolean;
}

export interface ResolvedAuthConfig {
  jwtSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  cookieSecure: boolean;
}

export function initializeAuth(config: AuthConfig): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.auth) return;
  if (!config.jwtSecret) {
    throw new ConfigurationError('Auth', 'jwtSecret is required');
  }
  if (!config.accessTokenExpiry) {
    configWarn('Auth', `accessTokenExpiry not provided, using default: ${JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES}`);
  }
  if (!config.refreshTokenExpiry) {
    configWarn('Auth', `refreshTokenExpiry not provided, using default: ${JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES}`);
  }
  globalThis.__withwiz_config.auth = {
    jwtSecret: config.jwtSecret,
    accessTokenExpiry: config.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
    refreshTokenExpiry: config.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
    cookieSecure: config.cookieSecure ?? false,
  };
}

export function getAuthConfig(): ResolvedAuthConfig {
  const auth = globalThis.__withwiz_config?.auth;
  if (!auth) {
    throw new ConfigurationError('Auth', 'Not initialized. Call initializeAuth() first.');
  }
  return auth;
}

export function resetAuth(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.auth;
}
