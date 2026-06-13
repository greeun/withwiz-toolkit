/**
 * Unified Config Registry
 *
 * 모든 모듈 설정을 단일 객체 `globalThis.__withwiz_config`에 저장.
 * `config.auth`와 `getAuthConfig()` 모두 같은 객체를 반환한다.
 */

import type { ResolvedCommonConfig } from '@withwiz/toolkit/core/config/common';
import type { ResolvedAuthConfig } from '@withwiz/toolkit/core/auth/config';
import type { ResolvedLoggerConfig } from '@withwiz/toolkit/core/logger/config';
import type { ResolvedCacheConfig } from '@withwiz/toolkit/core/cache/config';
import type { ResolvedStorageConfig } from '@withwiz/toolkit/core/storage/config';
import type { ResolvedGeolocationConfig } from '@withwiz/toolkit/core/geolocation/config';
import type { ResolvedCorsConfig } from '@withwiz/toolkit/core/cors';

export interface ConfigRegistry {
  common: ResolvedCommonConfig;
  auth: ResolvedAuthConfig;
  logger: ResolvedLoggerConfig;
  cache?: ResolvedCacheConfig;
  storage?: ResolvedStorageConfig;
  geolocation?: ResolvedGeolocationConfig;
  cors?: ResolvedCorsConfig;
}

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_config: Partial<ConfigRegistry> | undefined;
}

globalThis.__withwiz_config ??= {};

export const config = globalThis.__withwiz_config as ConfigRegistry;

export function resetConfig(): void {
  for (const key of Object.keys(globalThis.__withwiz_config!)) {
    delete (globalThis.__withwiz_config as Record<string, unknown>)[key];
  }
}
