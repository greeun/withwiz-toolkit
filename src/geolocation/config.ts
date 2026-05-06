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

export function initializeGeolocation(config: GeolocationConfig): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.geolocation) return;
  if (!config.ipgeolocationApiKey) configWarn('Geolocation', 'ipgeolocationApiKey not provided, IPGeolocation provider will be unavailable');
  if (!config.maxmindLicenseKey) configWarn('Geolocation', 'maxmindLicenseKey not provided, MaxMind provider will be unavailable');
  globalThis.__withwiz_config.geolocation = {
    ipgeolocationApiKey: config.ipgeolocationApiKey,
    maxmindLicenseKey: config.maxmindLicenseKey,
  };
}

export function getGeolocationConfig(): ResolvedGeolocationConfig {
  const geo = globalThis.__withwiz_config?.geolocation;
  if (!geo) throw new ConfigurationError('Geolocation', 'Not initialized. Call initializeGeolocation() first.');
  return geo;
}

export function resetGeolocation(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.geolocation;
}
