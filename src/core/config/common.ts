import { configWarn } from './warn';
import { ConfigurationError } from './errors';

export interface CommonConfig {
  nodeEnv?: 'development' | 'production' | 'test';
}

export interface ResolvedCommonConfig {
  nodeEnv: 'development' | 'production' | 'test';
}

export function initializeCommon(config: CommonConfig): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.common) return;
  if (!config.nodeEnv) {
    configWarn('Common', 'nodeEnv not provided, using default: development');
  }
  globalThis.__withwiz_config.common = { nodeEnv: config.nodeEnv ?? 'development' };
}

export function getCommonConfig(): ResolvedCommonConfig {
  const common = globalThis.__withwiz_config?.common;
  if (!common) {
    throw new ConfigurationError('Common', 'Not initialized. Call initializeCommon() first.');
  }
  return common;
}

export function resetCommon(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.common;
}
