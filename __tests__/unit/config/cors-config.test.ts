import { initializeCors, getCorsConfig, resetCors } from '../../../src/middleware/cors-config';
import { ConfigurationError } from '../../../src/config/errors';

describe('CORS Config', () => {
  beforeEach(() => { resetCors(); });

  describe('getCorsConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getCorsConfig()).toThrow(ConfigurationError);
    });
  });

  describe('initializeCors', () => {
    it('should throw when allowedOrigins is missing', () => {
      expect(() => initializeCors({} as any)).toThrow('allowedOrigins is required');
    });
    it('should throw when allowedOrigins is empty array', () => {
      expect(() => initializeCors({ allowedOrigins: [] })).toThrow('allowedOrigins must not be empty');
    });
    it('should set allowedOrigins', () => {
      initializeCors({ allowedOrigins: ['https://example.com'] });
      expect(getCorsConfig().allowedOrigins).toEqual(['https://example.com']);
    });
    it('should handle optional baseUrl', () => {
      initializeCors({ allowedOrigins: ['https://example.com'], baseUrl: 'https://api.example.com' });
      expect(getCorsConfig().baseUrl).toBe('https://api.example.com');
    });
    it('should warn when baseUrl not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeCors({ allowedOrigins: ['https://example.com'] });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('baseUrl not provided'));
      spy.mockRestore();
    });
  });

  describe('resetCors', () => {
    it('should reset config', () => {
      initializeCors({ allowedOrigins: ['https://example.com'] });
      resetCors();
      expect(() => getCorsConfig()).toThrow(ConfigurationError);
    });
  });
});
