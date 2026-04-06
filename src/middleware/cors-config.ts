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

const GLOBAL_KEY = '__withwiz_cors_config' as const;

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_cors_config: ResolvedCorsConfig | undefined;
}

function getConfig(): ResolvedCorsConfig | null {
  return globalThis[GLOBAL_KEY] ?? null;
}

function setConfig(config: ResolvedCorsConfig): void {
  globalThis[GLOBAL_KEY] = config;
}

export function initializeCors(config: CorsConfig): void {
  if (getConfig()) return;
  if (!config.allowedOrigins) {
    throw new ConfigurationError('CORS', 'allowedOrigins is required');
  }
  if (config.allowedOrigins.length === 0) {
    throw new ConfigurationError('CORS', 'allowedOrigins must not be empty');
  }
  if (config.baseUrl === undefined) {
    configWarn('CORS', 'baseUrl not provided');
  }
  setConfig({
    allowedOrigins: [...config.allowedOrigins],
    baseUrl: config.baseUrl,
  });
}

export function getCorsConfig(): ResolvedCorsConfig {
  const config = getConfig();
  if (!config) {
    throw new ConfigurationError('CORS', 'Not initialized. Call initializeCors() first.');
  }
  return config;
}

export function resetCors(): void { globalThis[GLOBAL_KEY] = undefined; }
