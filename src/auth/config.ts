import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

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
    configWarn('Auth', 'accessTokenExpiry not provided, using default: 7d');
  }
  if (!config.refreshTokenExpiry) {
    configWarn('Auth', 'refreshTokenExpiry not provided, using default: 30d');
  }
  globalThis.__withwiz_config.auth = {
    jwtSecret: config.jwtSecret,
    accessTokenExpiry: config.accessTokenExpiry ?? '7d',
    refreshTokenExpiry: config.refreshTokenExpiry ?? '30d',
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
