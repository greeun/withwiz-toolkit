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

let _config: ResolvedGeolocationConfig | null = null;

export function initializeGeolocation(config: GeolocationConfig): void {
  if (_config) return;
  if (!config.ipgeolocationApiKey) configWarn('Geolocation', 'ipgeolocationApiKey not provided, IPGeolocation provider will be unavailable');
  if (!config.maxmindLicenseKey) configWarn('Geolocation', 'maxmindLicenseKey not provided, MaxMind provider will be unavailable');
  _config = {
    ipgeolocationApiKey: config.ipgeolocationApiKey,
    maxmindLicenseKey: config.maxmindLicenseKey,
  };
}

export function getGeolocationConfig(): ResolvedGeolocationConfig {
  if (!_config) throw new ConfigurationError('Geolocation', 'Not initialized. Call initializeGeolocation() first.');
  return _config;
}

export function resetGeolocation(): void {
  _config = null;
}
