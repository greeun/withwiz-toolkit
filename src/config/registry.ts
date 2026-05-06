/**
 * Unified Config Registry
 *
 * Live read-only view over individual module stores
 * (`globalThis.__withwiz_*_config`).
 *
 * `config.auth` and `getAuthConfig()` return the same object —
 * there is only one source of truth per module.
 */

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
// Module → globalThis key mapping
// ============================================================================

const MODULE_KEYS: Record<string, string> = {
  common: '__withwiz_common_config',
  auth: '__withwiz_auth_config',
  logger: '__withwiz_logger_config',
  cache: '__withwiz_cache_config',
  storage: '__withwiz_storage_config',
  geolocation: '__withwiz_geolocation_config',
  cors: '__withwiz_cors_config',
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Read-only Proxy that delegates to each module's globalThis store.
 * Returns `undefined` for optional modules that haven't been initialized.
 * Throws `TypeError` on any setter attempt.
 */
export const config: ConfigRegistry = new Proxy({} as ConfigRegistry, {
  get(_target, prop: string) {
    const globalKey = MODULE_KEYS[prop];
    if (!globalKey) return undefined;
    return (globalThis as Record<string, unknown>)[globalKey];
  },
  set() {
    throw new TypeError('config is read-only');
  },
});

/**
 * Reset all module stores. For test cleanup only.
 */
export function resetConfig(): void {
  for (const globalKey of Object.values(MODULE_KEYS)) {
    (globalThis as Record<string, unknown>)[globalKey] = undefined;
  }
}
