// __tests__/unit/config/common.test.ts
import { initializeCommon, getCommonConfig, resetCommon } from '../../../src/config/common';
import { ConfigurationError } from '../../../src/config/errors';

describe('Common Config', () => {
  beforeEach(() => { resetCommon(); });

  describe('getCommonConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getCommonConfig()).toThrow(ConfigurationError);
      expect(() => getCommonConfig()).toThrow('[Common] Not initialized. Call initializeCommon() first.');
    });
  });

  describe('initializeCommon', () => {
    it('should set nodeEnv from config', () => {
      initializeCommon({ nodeEnv: 'production' });
      expect(getCommonConfig().nodeEnv).toBe('production');
    });
    it('should warn and use default when nodeEnv not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeCommon({});
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('nodeEnv not provided'));
      expect(getCommonConfig().nodeEnv).toBe('development');
      spy.mockRestore();
    });
    it('should accept test environment', () => {
      initializeCommon({ nodeEnv: 'test' });
      expect(getCommonConfig().nodeEnv).toBe('test');
    });
  });

  describe('resetCommon', () => {
    it('should reset config so getCommonConfig throws again', () => {
      initializeCommon({ nodeEnv: 'production' });
      expect(getCommonConfig().nodeEnv).toBe('production');
      resetCommon();
      expect(() => getCommonConfig()).toThrow(ConfigurationError);
    });
  });
});
