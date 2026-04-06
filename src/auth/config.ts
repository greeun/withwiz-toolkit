import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface AuthConfig {
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
}

export interface ResolvedAuthConfig {
  jwtSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
}

const GLOBAL_KEY = '__withwiz_auth_config' as const;

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_auth_config: ResolvedAuthConfig | undefined;
}

function getConfig(): ResolvedAuthConfig | null {
  return globalThis[GLOBAL_KEY] ?? null;
}

function setConfig(config: ResolvedAuthConfig): void {
  globalThis[GLOBAL_KEY] = config;
}

export function initializeAuth(config: AuthConfig): void {
  if (getConfig()) return;
  if (!config.jwtSecret) {
    throw new ConfigurationError('Auth', 'jwtSecret is required');
  }
  if (!config.accessTokenExpiry) {
    configWarn('Auth', 'accessTokenExpiry not provided, using default: 7d');
  }
  if (!config.refreshTokenExpiry) {
    configWarn('Auth', 'refreshTokenExpiry not provided, using default: 30d');
  }
  setConfig({
    jwtSecret: config.jwtSecret,
    accessTokenExpiry: config.accessTokenExpiry ?? '7d',
    refreshTokenExpiry: config.refreshTokenExpiry ?? '30d',
  });
}

export function getAuthConfig(): ResolvedAuthConfig {
  const config = getConfig();
  if (!config) {
    throw new ConfigurationError('Auth', 'Not initialized. Call initializeAuth() first.');
  }
  return config;
}

export function resetAuth(): void {
  globalThis[GLOBAL_KEY] = undefined;
}
