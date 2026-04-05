import { ConfigurationError } from '../../../src/config/errors';

describe('ConfigurationError', () => {
  it('should format message with module name prefix', () => {
    const error = new ConfigurationError('Auth', 'jwtSecret is required');
    expect(error.message).toBe('[Auth] jwtSecret is required');
  });

  it('should set name to ConfigurationError', () => {
    const error = new ConfigurationError('Cache', 'not initialized');
    expect(error.name).toBe('ConfigurationError');
  });

  it('should be instanceof Error', () => {
    const error = new ConfigurationError('Logger', 'test');
    expect(error).toBeInstanceOf(Error);
  });

  it('should include module in message for different modules', () => {
    const error = new ConfigurationError('Storage', 'accountId is required');
    expect(error.message).toContain('[Storage]');
    expect(error.message).toContain('accountId is required');
  });
});
