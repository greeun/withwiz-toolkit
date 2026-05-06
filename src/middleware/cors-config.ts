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

export function initializeCors(config: CorsConfig): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.cors) return;
  if (!config.allowedOrigins) {
    throw new ConfigurationError('CORS', 'allowedOrigins is required');
  }
  if (config.allowedOrigins.length === 0) {
    throw new ConfigurationError('CORS', 'allowedOrigins must not be empty');
  }
  if (config.baseUrl === undefined) {
    configWarn('CORS', 'baseUrl not provided');
  }
  globalThis.__withwiz_config.cors = {
    allowedOrigins: [...config.allowedOrigins],
    baseUrl: config.baseUrl,
  };
}

export function getCorsConfig(): ResolvedCorsConfig {
  const cors = globalThis.__withwiz_config?.cors;
  if (!cors) {
    throw new ConfigurationError('CORS', 'Not initialized. Call initializeCors() first.');
  }
  return cors;
}

export function resetCors(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.cors;
}
