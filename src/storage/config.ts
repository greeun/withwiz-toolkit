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

export function initializeStorage(config: StorageConfig): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.storage) return;
  if (!config.accountId) throw new ConfigurationError('Storage', 'accountId is required');
  if (!config.accessKeyId) throw new ConfigurationError('Storage', 'accessKeyId is required');
  if (!config.secretAccessKey) throw new ConfigurationError('Storage', 'secretAccessKey is required');
  if (!config.bucketName) throw new ConfigurationError('Storage', 'bucketName is required');
  if (config.publicUrl === undefined) configWarn('Storage', 'publicUrl not provided');
  globalThis.__withwiz_config.storage = {
    accountId: config.accountId,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucketName: config.bucketName,
    publicUrl: config.publicUrl,
  };
}

export function getStorageConfig(): ResolvedStorageConfig {
  const storage = globalThis.__withwiz_config?.storage;
  if (!storage) throw new ConfigurationError('Storage', 'Not initialized. Call initializeStorage() first.');
  return storage;
}

export function resetStorage(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.storage;
}
