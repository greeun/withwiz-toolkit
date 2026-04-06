import { ConfigurationError } from './errors';
import { configWarn } from './warn';

export interface CommonConfig {
  nodeEnv?: 'development' | 'production' | 'test';
}

export interface ResolvedCommonConfig {
  nodeEnv: 'development' | 'production' | 'test';
}

const GLOBAL_KEY = '__withwiz_common_config' as const;

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_common_config: ResolvedCommonConfig | undefined;
}

function getConfig(): ResolvedCommonConfig | null {
  return globalThis[GLOBAL_KEY] ?? null;
}

function setConfig(config: ResolvedCommonConfig): void {
  globalThis[GLOBAL_KEY] = config;
}

export function initializeCommon(config: CommonConfig): void {
  if (getConfig()) return;
  if (!config.nodeEnv) {
    configWarn('Common', 'nodeEnv not provided, using default: development');
  }
  setConfig({ nodeEnv: config.nodeEnv ?? 'development' });
}

export function getCommonConfig(): ResolvedCommonConfig {
  const config = getConfig();
  if (!config) {
    throw new ConfigurationError('Common', 'Not initialized. Call initializeCommon() first.');
  }
  return config;
}

export function resetCommon(): void { globalThis[GLOBAL_KEY] = undefined; }
