import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

export interface ResolvedStorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

const GLOBAL_KEY = '__withwiz_storage_config' as const;

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_storage_config: ResolvedStorageConfig | undefined;
}

function getConfig(): ResolvedStorageConfig | null {
  return globalThis[GLOBAL_KEY] ?? null;
}

function setConfig(config: ResolvedStorageConfig): void {
  globalThis[GLOBAL_KEY] = config;
}

export function initializeStorage(config: StorageConfig): void {
  if (getConfig()) return;
  if (!config.accountId) throw new ConfigurationError('Storage', 'accountId is required');
  if (!config.accessKeyId) throw new ConfigurationError('Storage', 'accessKeyId is required');
  if (!config.secretAccessKey) throw new ConfigurationError('Storage', 'secretAccessKey is required');
  if (!config.bucketName) throw new ConfigurationError('Storage', 'bucketName is required');
  if (config.publicUrl === undefined) configWarn('Storage', 'publicUrl not provided');
  setConfig({
    accountId: config.accountId,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucketName: config.bucketName,
    publicUrl: config.publicUrl,
  });
}

export function getStorageConfig(): ResolvedStorageConfig {
  const config = getConfig();
  if (!config) throw new ConfigurationError('Storage', 'Not initialized. Call initializeStorage() first.');
  return config;
}

export function resetStorage(): void {
  globalThis[GLOBAL_KEY] = undefined;
}
