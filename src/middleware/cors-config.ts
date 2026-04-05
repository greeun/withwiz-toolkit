import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface CorsConfig {
  allowedOrigins: string[];
  baseUrl?: string;
}

export interface ResolvedCorsConfig {
  allowedOrigins: string[];
  baseUrl?: string;
}

let _config: ResolvedCorsConfig | null = null;

export function initializeCors(config: CorsConfig): void {
  if (_config) return;
  if (!config.allowedOrigins) {
    throw new ConfigurationError('CORS', 'allowedOrigins is required');
  }
  if (config.allowedOrigins.length === 0) {
    throw new ConfigurationError('CORS', 'allowedOrigins must not be empty');
  }
  if (config.baseUrl === undefined) {
    configWarn('CORS', 'baseUrl not provided');
  }
  _config = {
    allowedOrigins: [...config.allowedOrigins],
    baseUrl: config.baseUrl,
  };
}

export function getCorsConfig(): ResolvedCorsConfig {
  if (!_config) {
    throw new ConfigurationError('CORS', 'Not initialized. Call initializeCors() first.');
  }
  return _config;
}

export function resetCors(): void { _config = null; }
