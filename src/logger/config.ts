import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface LoggerConfig {
  level?: string;
  dir?: string;
  file?: string;
  fileEnabled?: boolean;
  consoleEnabled?: boolean;
}

export interface ResolvedLoggerConfig {
  level: string;
  dir: string;
  file: string;
  fileEnabled: boolean;
  consoleEnabled: boolean;
}

export function initializeLogger(config: LoggerConfig): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.logger) return;
  if (config.level === undefined) configWarn('Logger', 'level not provided, using default: info');
  if (config.dir === undefined) configWarn('Logger', 'dir not provided, using default: ./logs');
  if (config.file === undefined) configWarn('Logger', 'file not provided, using default: app.log');
  if (config.fileEnabled === undefined) configWarn('Logger', 'fileEnabled not provided, using default: true');
  if (config.consoleEnabled === undefined) configWarn('Logger', 'consoleEnabled not provided, using default: true');

  globalThis.__withwiz_config.logger = {
    level: config.level ?? 'info',
    dir: config.dir ?? './logs',
    file: config.file ?? 'app.log',
    fileEnabled: config.fileEnabled ?? true,
    consoleEnabled: config.consoleEnabled ?? true,
  };
}

export function getLoggerConfig(): ResolvedLoggerConfig {
  const logger = globalThis.__withwiz_config?.logger;
  if (!logger) throw new ConfigurationError('Logger', 'Not initialized. Call initializeLogger() first.');
  return logger;
}

export function resetLogger(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.logger;
}
