import { ConfigurationError } from './errors';
import { configWarn } from './warn';

export interface CommonConfig {
  nodeEnv?: 'development' | 'production' | 'test';
}

export interface ResolvedCommonConfig {
  nodeEnv: 'development' | 'production' | 'test';
}

let _config: ResolvedCommonConfig | null = null;

export function initializeCommon(config: CommonConfig): void {
  if (!config.nodeEnv) {
    configWarn('Common', 'nodeEnv not provided, using default: development');
  }
  _config = { nodeEnv: config.nodeEnv ?? 'development' };
}

export function getCommonConfig(): ResolvedCommonConfig {
  if (!_config) {
    throw new ConfigurationError('Common', 'Not initialized. Call initializeCommon() first.');
  }
  return _config;
}

export function resetCommon(): void { _config = null; }
