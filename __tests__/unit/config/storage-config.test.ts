import { initializeStorage, getStorageConfig, resetStorage } from '../../../src/storage/config';
import { ConfigurationError } from '../../../src/config/errors';

describe('Storage Config', () => {
  beforeEach(() => { resetStorage(); });
  const validConfig = { accountId: 'acc-123', accessKeyId: 'key-123', secretAccessKey: 'secret-123', bucketName: 'my-bucket' };

  it('should throw ConfigurationError when not initialized', () => {
    expect(() => getStorageConfig()).toThrow(ConfigurationError);
  });
  it('should throw when accountId is missing', () => {
    const { accountId, ...rest } = validConfig;
    expect(() => initializeStorage(rest as any)).toThrow('accountId is required');
  });
  it('should throw when accessKeyId is missing', () => {
    const { accessKeyId, ...rest } = validConfig;
    expect(() => initializeStorage(rest as any)).toThrow('accessKeyId is required');
  });
  it('should throw when secretAccessKey is missing', () => {
    const { secretAccessKey, ...rest } = validConfig;
    expect(() => initializeStorage(rest as any)).toThrow('secretAccessKey is required');
  });
  it('should throw when bucketName is missing', () => {
    const { bucketName, ...rest } = validConfig;
    expect(() => initializeStorage(rest as any)).toThrow('bucketName is required');
  });
  it('should set all required values', () => {
    initializeStorage(validConfig);
    const config = getStorageConfig();
    expect(config.accountId).toBe('acc-123');
    expect(config.bucketName).toBe('my-bucket');
  });
  it('should handle optional publicUrl', () => {
    initializeStorage({ ...validConfig, publicUrl: 'https://cdn.example.com' });
    expect(getStorageConfig().publicUrl).toBe('https://cdn.example.com');
  });
  it('should set publicUrl to undefined when not provided', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initializeStorage(validConfig);
    expect(getStorageConfig().publicUrl).toBeUndefined();
    spy.mockRestore();
  });
  it('should reset config', () => {
    initializeStorage(validConfig);
    resetStorage();
    expect(() => getStorageConfig()).toThrow(ConfigurationError);
  });
});
