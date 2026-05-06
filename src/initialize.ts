import { initializeCommon } from './config/common';
import type { CommonConfig } from './config/common';
import { initializeAuth } from './auth/config';
import type { AuthConfig } from './auth/config';
import { initializeLogger } from './logger/config';
import type { LoggerConfig } from './logger/config';
import { initializeCache } from './cache/config';
import type { CacheConfigInput } from './cache/config';
import { initializeStorage } from './storage/config';
import type { StorageConfig } from './storage/config';
import { initializeGeolocation } from './geolocation/config';
import type { GeolocationConfig } from './geolocation/config';
import { initializeCors } from './middleware/cors-config';
import type { CorsConfig } from './middleware/cors-config';
import { config } from './config/registry';
import type { ConfigRegistry } from './config/registry';

export interface ToolkitConfig {
  nodeEnv?: CommonConfig['nodeEnv'];
  auth?: AuthConfig;
  logger?: LoggerConfig;
  cache?: CacheConfigInput;
  storage?: StorageConfig;
  geolocation?: GeolocationConfig;
  cors?: CorsConfig;
}

export function initialize(toolkitConfig: ToolkitConfig): ConfigRegistry {
  // 1. Common first
  initializeCommon({ nodeEnv: toolkitConfig.nodeEnv });

  // 2. Logger second (so other modules' warns can use it)
  if (toolkitConfig.logger) {
    initializeLogger(toolkitConfig.logger);
  }

  // 3. Rest
  if (toolkitConfig.auth) initializeAuth(toolkitConfig.auth);
  if (toolkitConfig.cache) initializeCache(toolkitConfig.cache);
  if (toolkitConfig.storage) initializeStorage(toolkitConfig.storage);
  if (toolkitConfig.geolocation) initializeGeolocation(toolkitConfig.geolocation);
  if (toolkitConfig.cors) initializeCors(toolkitConfig.cors);

  return config;
}

// Re-export types for consumer convenience
export type {
  AuthConfig,
  LoggerConfig,
  CacheConfigInput as CacheConfig,
  StorageConfig,
  GeolocationConfig,
  CorsConfig,
};

// Unified config registry
export { config, resetConfig } from './config/registry';
export type { ConfigRegistry } from './config/registry';
