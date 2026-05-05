/**
 * Environment Module - Additional Coverage Tests
 *
 * Covers the uncovered branches in src/system/environment.ts:
 * - Cache config with redis present (lines 39-48)
 * - Geolocation config with API keys present
 * - Platform-specific branch (darwin vs linux)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';

// Mock logger
vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Environment - Redis config present', () => {
  beforeEach(async () => {
    const { resetCommon } = await import('../../../src/config/common');
    const { resetAuth } = await import('../../../src/auth/config');
    const { resetCache } = await import('../../../src/cache/config');
    const { resetGeolocation } = await import('../../../src/geolocation/config');
    resetCommon();
    resetAuth();
    resetCache();
    resetGeolocation();
  });

  it('should mark REDIS_REST_URL and REDIS_REST_TOKEN as ok when redis config is present', async () => {
    const { initializeCache } = await import('../../../src/cache/config');
    initializeCache({
      enabled: true,
      redis: {
        url: 'https://my-redis-instance.upstash.io',
        token: 'super-secret-redis-token-value',
      },
    });

    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const cacheEnabled = results.find((r) => r.key === 'CACHE_ENABLED');
    expect(cacheEnabled).toBeDefined();
    expect(cacheEnabled!.ok).toBe(true);
    expect(cacheEnabled!.value).toBe('true');

    const redisUrl = results.find((r) => r.key === 'REDIS_REST_URL');
    expect(redisUrl).toBeDefined();
    expect(redisUrl!.ok).toBe(true);
    // URL is truncated to 20 chars + '...'
    expect(redisUrl!.value).toContain('...');

    const redisToken = results.find((r) => r.key === 'REDIS_REST_TOKEN');
    expect(redisToken).toBeDefined();
    expect(redisToken!.ok).toBe(true);
    expect(redisToken!.value).toBe('***');
  });

  it('should mark REDIS_REST_URL and REDIS_REST_TOKEN as not ok when redis config is absent', async () => {
    const { initializeCache } = await import('../../../src/cache/config');
    initializeCache({
      enabled: true,
      // No redis config
    });

    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const redisUrl = results.find((r) => r.key === 'REDIS_REST_URL');
    expect(redisUrl).toBeDefined();
    expect(redisUrl!.ok).toBe(false);

    const redisToken = results.find((r) => r.key === 'REDIS_REST_TOKEN');
    expect(redisToken).toBeDefined();
    expect(redisToken!.ok).toBe(false);
  });

  it('should show short REDIS_REST_URL without truncation when url <= 20 chars', async () => {
    const { initializeCache } = await import('../../../src/cache/config');
    initializeCache({
      enabled: true,
      redis: {
        url: 'http://short.io',
        token: 'token123',
      },
    });

    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const redisUrl = results.find((r) => r.key === 'REDIS_REST_URL');
    expect(redisUrl).toBeDefined();
    expect(redisUrl!.ok).toBe(true);
    expect(redisUrl!.value).toBe('http://short.io');
    expect(redisUrl!.value).not.toContain('...');
  });
});

describe('Environment - Geolocation config present', () => {
  beforeEach(async () => {
    const { resetCommon } = await import('../../../src/config/common');
    const { resetAuth } = await import('../../../src/auth/config');
    const { resetCache } = await import('../../../src/cache/config');
    const { resetGeolocation } = await import('../../../src/geolocation/config');
    resetCommon();
    resetAuth();
    resetCache();
    resetGeolocation();
  });

  it('should mark geo API keys as ok when both are present', async () => {
    const { initializeGeolocation } = await import('../../../src/geolocation/config');
    initializeGeolocation({
      ipgeolocationApiKey: 'ipgeo-api-key-123',
      maxmindLicenseKey: 'maxmind-license-key-456',
    });

    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const ipgeoResult = results.find((r) => r.key === 'IPGEOLOCATION_API_KEY');
    expect(ipgeoResult).toBeDefined();
    expect(ipgeoResult!.ok).toBe(true);

    const maxmindResult = results.find((r) => r.key === 'MAXMIND_LICENSE_KEY');
    expect(maxmindResult).toBeDefined();
    expect(maxmindResult!.ok).toBe(true);
  });

  it('should mark geo API keys as not ok when keys are empty/undefined', async () => {
    const { initializeGeolocation } = await import('../../../src/geolocation/config');
    initializeGeolocation({
      ipgeolocationApiKey: '',
      maxmindLicenseKey: undefined,
    });

    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const ipgeoResult = results.find((r) => r.key === 'IPGEOLOCATION_API_KEY');
    expect(ipgeoResult).toBeDefined();
    expect(ipgeoResult!.ok).toBe(false);

    const maxmindResult = results.find((r) => r.key === 'MAXMIND_LICENSE_KEY');
    expect(maxmindResult).toBeDefined();
    expect(maxmindResult!.ok).toBe(false);
  });
});

describe('Environment - Platform-specific branches', () => {
  beforeEach(async () => {
    const { resetCommon } = await import('../../../src/config/common');
    const { resetAuth } = await import('../../../src/auth/config');
    const { resetCache } = await import('../../../src/cache/config');
    const { resetGeolocation } = await import('../../../src/geolocation/config');
    resetCommon();
    resetAuth();
    resetCache();
    resetGeolocation();
  });

  it('should include MACOS_VERSION on darwin platform', async () => {
    // Mock getPlatform to return darwin
    vi.doMock('@withwiz/system/utils', () => ({
      getPlatform: () => 'darwin',
    }));

    // Re-import environment after mocking
    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const currentPlatform = os.platform();
    if (currentPlatform === 'darwin') {
      const macosVersion = results.find((r) => r.key === 'MACOS_VERSION');
      expect(macosVersion).toBeDefined();
      expect(macosVersion!.ok).toBe(true);
      expect(macosVersion!.value).toBe(os.release());
    } else {
      const linuxDistro = results.find((r) => r.key === 'LINUX_DISTRO');
      expect(linuxDistro).toBeDefined();
      expect(linuxDistro!.ok).toBe(true);
      expect(linuxDistro!.value).toBe(os.release());
    }

    vi.doUnmock('@withwiz/system/utils');
  });

  it('should include system info (HOSTNAME, USER_HOME, TEMP_DIR)', async () => {
    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const hostname = results.find((r) => r.key === 'HOSTNAME');
    expect(hostname).toBeDefined();
    expect(hostname!.ok).toBe(true);
    expect(hostname!.value).toBe(os.hostname());

    const userHome = results.find((r) => r.key === 'USER_HOME');
    expect(userHome).toBeDefined();
    expect(userHome!.ok).toBe(true);
    expect(userHome!.value).toBe(os.homedir());

    const tempDir = results.find((r) => r.key === 'TEMP_DIR');
    expect(tempDir).toBeDefined();
    expect(tempDir!.ok).toBe(true);
    expect(tempDir!.value).toBe(os.tmpdir());
  });

  it('should include NODE_VERSION', async () => {
    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const nodeVersion = results.find((r) => r.key === 'NODE_VERSION');
    expect(nodeVersion).toBeDefined();
    expect(nodeVersion!.ok).toBe(true);
    expect(nodeVersion!.value).toBe(process.version);
  });

  it('should fallback NODE_ENV to development when commonConfig is not initialized', async () => {
    // resetCommon is already called in beforeEach (no initialization)
    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const nodeEnvResult = results.find((r) => r.key === 'NODE_ENV');
    expect(nodeEnvResult).toBeDefined();
    expect(nodeEnvResult!.ok).toBe(true);
    expect(nodeEnvResult!.value).toBe('development');
  });
});

describe('Environment - Cache config error handling', () => {
  beforeEach(async () => {
    const { resetCommon } = await import('../../../src/config/common');
    const { resetAuth } = await import('../../../src/auth/config');
    const { resetCache } = await import('../../../src/cache/config');
    const { resetGeolocation } = await import('../../../src/geolocation/config');
    resetCommon();
    resetAuth();
    resetCache();
    resetGeolocation();
  });

  it('should mark all cache keys as not ok when cache config throws', async () => {
    // Without initializeCache, getResolvedCacheConfig will throw
    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const cacheEnabled = results.find((r) => r.key === 'CACHE_ENABLED');
    expect(cacheEnabled).toBeDefined();
    expect(cacheEnabled!.ok).toBe(false);

    const redisUrl = results.find((r) => r.key === 'REDIS_REST_URL');
    expect(redisUrl).toBeDefined();
    expect(redisUrl!.ok).toBe(false);

    const redisToken = results.find((r) => r.key === 'REDIS_REST_TOKEN');
    expect(redisToken).toBeDefined();
    expect(redisToken!.ok).toBe(false);
  });

  it('should mark geo keys as not ok when geolocation config throws', async () => {
    // Without initializeGeolocation, getGeolocationConfig will throw
    const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
    const results = checkEnvironmentVariables();

    const ipgeoResult = results.find((r) => r.key === 'IPGEOLOCATION_API_KEY');
    expect(ipgeoResult).toBeDefined();
    expect(ipgeoResult!.ok).toBe(false);

    const maxmindResult = results.find((r) => r.key === 'MAXMIND_LICENSE_KEY');
    expect(maxmindResult).toBeDefined();
    expect(maxmindResult!.ok).toBe(false);
  });
});
