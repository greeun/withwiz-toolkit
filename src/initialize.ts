import { initializeCommon } from '@withwiz/toolkit/core/config/common';
import type { CommonConfig } from '@withwiz/toolkit/core/config/common';
import { initializeAuth } from '@withwiz/toolkit/core/auth/config';
import type { AuthConfig } from '@withwiz/toolkit/core/auth/config';
import { initializeLogger } from '@withwiz/toolkit/core/logger/config';
import type { LoggerConfig } from '@withwiz/toolkit/core/logger/config';
import { initializeCache } from '@withwiz/toolkit/core/cache/config';
import type { CacheConfigInput } from '@withwiz/toolkit/core/cache/config';
import { initializeStorage } from '@withwiz/toolkit/core/storage/config';
import type { StorageConfig } from '@withwiz/toolkit/core/storage/config';
import { initializeGeolocation } from '@withwiz/toolkit/core/geolocation/config';
import type { GeolocationConfig } from '@withwiz/toolkit/core/geolocation/config';
import { initializeCors } from '@withwiz/toolkit/core/cors';
import type { CorsConfig } from '@withwiz/toolkit/core/cors';
import { config } from '@withwiz/toolkit/core/config/registry';
import type { ConfigRegistry } from '@withwiz/toolkit/core/config/registry';

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
export { config, resetConfig } from '@withwiz/toolkit/core/config/registry';
export type { ConfigRegistry } from '@withwiz/toolkit/core/config/registry';
