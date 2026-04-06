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

const GLOBAL_KEY = '__withwiz_logger_config' as const;

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_logger_config: ResolvedLoggerConfig | undefined;
}

function getConfig(): ResolvedLoggerConfig | null {
  return globalThis[GLOBAL_KEY] ?? null;
}

function setConfig(config: ResolvedLoggerConfig): void {
  globalThis[GLOBAL_KEY] = config;
}

export function initializeLogger(config: LoggerConfig): void {
  if (getConfig()) return;
  if (config.level === undefined) configWarn('Logger', 'level not provided, using default: info');
  if (config.dir === undefined) configWarn('Logger', 'dir not provided, using default: ./logs');
  if (config.file === undefined) configWarn('Logger', 'file not provided, using default: app.log');
  if (config.fileEnabled === undefined) configWarn('Logger', 'fileEnabled not provided, using default: true');
  if (config.consoleEnabled === undefined) configWarn('Logger', 'consoleEnabled not provided, using default: true');

  setConfig({
    level: config.level ?? 'info',
    dir: config.dir ?? './logs',
    file: config.file ?? 'app.log',
    fileEnabled: config.fileEnabled ?? true,
    consoleEnabled: config.consoleEnabled ?? true,
  });
}

export function getLoggerConfig(): ResolvedLoggerConfig {
  const config = getConfig();
  if (!config) throw new ConfigurationError('Logger', 'Not initialized. Call initializeLogger() first.');
  return config;
}

export function resetLogger(): void { globalThis[GLOBAL_KEY] = undefined; }
