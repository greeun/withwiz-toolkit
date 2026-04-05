import { initializeGeolocation, getGeolocationConfig, resetGeolocation } from '../../../src/geolocation/config';
import { ConfigurationError } from '../../../src/config/errors';

describe('Geolocation Config', () => {
  beforeEach(() => { resetGeolocation(); });

  it('should throw ConfigurationError when not initialized', () => {
    expect(() => getGeolocationConfig()).toThrow(ConfigurationError);
  });
  it('should accept empty config (all optional)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initializeGeolocation({});
    expect(getGeolocationConfig().ipgeolocationApiKey).toBeUndefined();
    expect(getGeolocationConfig().maxmindLicenseKey).toBeUndefined();
    spy.mockRestore();
  });
  it('should warn when no API keys provided', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initializeGeolocation({});
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('ipgeolocationApiKey not provided'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('maxmindLicenseKey not provided'));
    spy.mockRestore();
  });
  it('should set API keys when provided', () => {
    initializeGeolocation({ ipgeolocationApiKey: 'geo-key', maxmindLicenseKey: 'maxmind-key' });
    expect(getGeolocationConfig().ipgeolocationApiKey).toBe('geo-key');
    expect(getGeolocationConfig().maxmindLicenseKey).toBe('maxmind-key');
  });
  it('should reset config', () => {
    initializeGeolocation({});
    resetGeolocation();
    expect(() => getGeolocationConfig()).toThrow(ConfigurationError);
  });
});
