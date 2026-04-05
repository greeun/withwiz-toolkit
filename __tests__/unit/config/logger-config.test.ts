// __tests__/unit/config/logger-config.test.ts
import { initializeLogger, getLoggerConfig, resetLogger } from '../../../src/logger/config';
import { ConfigurationError } from '../../../src/config/errors';

describe('Logger Config', () => {
  beforeEach(() => { resetLogger(); });

  describe('getLoggerConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getLoggerConfig()).toThrow(ConfigurationError);
    });
  });

  describe('initializeLogger', () => {
    it('should use all defaults when empty config provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeLogger({});
      const config = getLoggerConfig();
      expect(config.level).toBe('info');
      expect(config.dir).toBe('./logs');
      expect(config.file).toBe('app.log');
      expect(config.fileEnabled).toBe(true);
      expect(config.consoleEnabled).toBe(true);
      spy.mockRestore();
    });
    it('should warn for each missing optional field', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeLogger({});
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('level not provided'));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('dir not provided'));
      spy.mockRestore();
    });
    it('should use provided values without warning', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeLogger({ level: 'debug', dir: '/var/log', file: 'custom.log', fileEnabled: false, consoleEnabled: false });
      const config = getLoggerConfig();
      expect(config.level).toBe('debug');
      expect(config.dir).toBe('/var/log');
      expect(config.file).toBe('custom.log');
      expect(config.fileEnabled).toBe(false);
      expect(config.consoleEnabled).toBe(false);
      const warnCalls = spy.mock.calls.map(c => c[0]);
      expect(warnCalls.filter((c: string) => c.includes('level not provided'))).toHaveLength(0);
      spy.mockRestore();
    });
  });

  describe('resetLogger', () => {
    it('should reset config', () => {
      initializeLogger({});
      resetLogger();
      expect(() => getLoggerConfig()).toThrow(ConfigurationError);
    });
  });
});
