import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface GeolocationConfig {
  ipgeolocationApiKey?: string;
  maxmindLicenseKey?: string;
}

export interface ResolvedGeolocationConfig {
  ipgeolocationApiKey?: string;
  maxmindLicenseKey?: string;
}

const GLOBAL_KEY = '__withwiz_geolocation_config' as const;

declare global {
  // eslint-disable-next-line no-var
  var __withwiz_geolocation_config: ResolvedGeolocationConfig | undefined;
}

function getConfig(): ResolvedGeolocationConfig | null {
  return globalThis[GLOBAL_KEY] ?? null;
}

function setConfig(config: ResolvedGeolocationConfig): void {
  globalThis[GLOBAL_KEY] = config;
}

export function initializeGeolocation(config: GeolocationConfig): void {
  if (getConfig()) return;
  if (!config.ipgeolocationApiKey) configWarn('Geolocation', 'ipgeolocationApiKey not provided, IPGeolocation provider will be unavailable');
  if (!config.maxmindLicenseKey) configWarn('Geolocation', 'maxmindLicenseKey not provided, MaxMind provider will be unavailable');
  setConfig({
    ipgeolocationApiKey: config.ipgeolocationApiKey,
    maxmindLicenseKey: config.maxmindLicenseKey,
  });
}

export function getGeolocationConfig(): ResolvedGeolocationConfig {
  const config = getConfig();
  if (!config) throw new ConfigurationError('Geolocation', 'Not initialized. Call initializeGeolocation() first.');
  return config;
}

export function resetGeolocation(): void {
  globalThis[GLOBAL_KEY] = undefined;
}
