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

let _config: ResolvedAuthConfig | null = null;

export function initializeAuth(config: AuthConfig): void {
  if (!config.jwtSecret) {
    throw new ConfigurationError('Auth', 'jwtSecret is required');
  }
  if (!config.accessTokenExpiry) {
    configWarn('Auth', 'accessTokenExpiry not provided, using default: 7d');
  }
  if (!config.refreshTokenExpiry) {
    configWarn('Auth', 'refreshTokenExpiry not provided, using default: 30d');
  }
  _config = {
    jwtSecret: config.jwtSecret,
    accessTokenExpiry: config.accessTokenExpiry ?? '7d',
    refreshTokenExpiry: config.refreshTokenExpiry ?? '30d',
  };
}

export function getAuthConfig(): ResolvedAuthConfig {
  if (!_config) {
    throw new ConfigurationError('Auth', 'Not initialized. Call initializeAuth() first.');
  }
  return _config;
}

export function resetAuth(): void {
  _config = null;
}
