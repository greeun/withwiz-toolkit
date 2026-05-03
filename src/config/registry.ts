/**
 * Unified Config Registry
 *
 * Single entry point for all withwiz configuration.
 * Stores resolved configs in globalThis.__withwiz_config and exposes
 * them via a read-only Proxy (`config`).
 */

import { ConfigurationError } from './errors';
import type { ResolvedCommonConfig } from './common';
import type { ResolvedAuthConfig } from '../auth/config';
import type { ResolvedLoggerConfig } from '../logger/config';
import type { ResolvedCacheConfig } from '../cache/config';
import type { ResolvedStorageConfig } from '../storage/config';
import type { ResolvedGeolocationConfig } from '../geolocation/config';
import type { ResolvedCorsConfig } from '../middleware/cors-config';

// ============================================================================
// Interface
// ============================================================================

export interface ConfigRegistry {
  common: ResolvedCommonConfig;
  auth: ResolvedAuthConfig;
  logger: ResolvedLoggerConfig;
  cache?: ResolvedCacheConfig;
  storage?: ResolvedStorageConfig;
  geolocation?: ResolvedGeolocationConfig;
  cors?: ResolvedCorsConfig;
}

// ============================================================================
// Global declaration
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_config: ConfigRegistry | undefined;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialise the unified config registry.
 * Idempotent — a second call is silently ignored.
 * The stored object is frozen to prevent mutation.
 */
export function initConfig(entries: ConfigRegistry): void {
  if (globalThis.__withwiz_config) return;
  globalThis.__withwiz_config = Object.freeze(entries);
}

/**
 * Read-only Proxy that delegates to `globalThis.__withwiz_config`.
 * Throws `ConfigurationError` if accessed before `initConfig()`.
 * Throws `TypeError` on any setter attempt.
 */
export const config: ConfigRegistry = new Proxy({} as ConfigRegistry, {
  get(_target, prop, _receiver) {
    const store = globalThis.__withwiz_config;
    if (!store) {
      throw new ConfigurationError('Config', 'Not initialized. Call initConfig() first.');
    }
    return store[prop as keyof ConfigRegistry];
  },
  set() {
    throw new TypeError('config is read-only');
  },
});

/**
 * Reset the registry to uninitialised state. For test cleanup only.
 */
export function resetConfig(): void {
  globalThis.__withwiz_config = undefined;
}
