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

export interface ToolkitConfig {
  nodeEnv?: CommonConfig['nodeEnv'];
  auth?: AuthConfig;
  logger?: LoggerConfig;
  cache?: CacheConfigInput;
  storage?: StorageConfig;
  geolocation?: GeolocationConfig;
  cors?: CorsConfig;
}

export function initialize(config: ToolkitConfig): void {
  // 1. Common first
  initializeCommon({ nodeEnv: config.nodeEnv });

  // 2. Logger second (so other modules' warns can use it)
  if (config.logger) {
    initializeLogger(config.logger);
  }

  // 3. Rest
  if (config.auth) initializeAuth(config.auth);
  if (config.cache) initializeCache(config.cache);
  if (config.storage) initializeStorage(config.storage);
  if (config.geolocation) initializeGeolocation(config.geolocation);
  if (config.cors) initializeCors(config.cors);
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
