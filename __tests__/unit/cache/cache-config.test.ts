/**
 * Cache Config Tests
 *
 * src/cache/cache-config.ts 유닛 테스트
 * getCacheConfig 및 getCacheTTL 유틸리티 검증
 */

vi.mock('@withwiz/cache/cache-env', () => ({
  getENV: vi.fn(() => ({
    CACHE: {
      ANALYTICS: { ENABLED: true, DURATION: 300 },
      USER: { ENABLED: true, DURATION: 600 },
      GEOIP: { ENABLED: true, DURATION: 86400 },
      SETTINGS: { ENABLED: true, DURATION: 3600 },
      RATE_LIMIT: { ENABLED: true, DURATION: 60 },
    },
  })),
  isCacheEnabled: vi.fn(() => true),
}));

import { getENV, isCacheEnabled } from '@withwiz/cache/cache-env';

describe('Cache Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getENV as ReturnType<typeof vi.fn>).mockReturnValue({
      CACHE: {
        ANALYTICS: { ENABLED: true, DURATION: 300 },
        USER: { ENABLED: true, DURATION: 600 },
        GEOIP: { ENABLED: true, DURATION: 86400 },
        SETTINGS: { ENABLED: true, DURATION: 3600 },
        RATE_LIMIT: { ENABLED: true, DURATION: 60 },
      },
    });
  });

  describe('getCacheConfig.analytics', () => {
    it('should return true when both cache and analytics are enabled', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.analytics.enabled()).toBe(true);
    });

    it('should return false when cache is disabled globally', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.analytics.enabled()).toBe(false);
    });

    it('should return false when analytics ENABLED is false', async () => {
      (getENV as ReturnType<typeof vi.fn>).mockReturnValue({
        CACHE: {
          ANALYTICS: { ENABLED: false, DURATION: 300 },
          USER: { ENABLED: true, DURATION: 600 },
          GEOIP: { ENABLED: true, DURATION: 86400 },
          SETTINGS: { ENABLED: true, DURATION: 3600 },
          RATE_LIMIT: { ENABLED: true, DURATION: 60 },
        },
      });
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.analytics.enabled()).toBe(false);
    });

    it('should return configured duration value', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.analytics.duration()).toBe(300);
    });
  });

  describe('getCacheConfig.user', () => {
    it('should return true when both cache and user are enabled', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.user.enabled()).toBe(true);
    });

    it('should return false when cache is disabled globally', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.user.enabled()).toBe(false);
    });

    it('should return false when user ENABLED is false', async () => {
      (getENV as ReturnType<typeof vi.fn>).mockReturnValue({
        CACHE: {
          ANALYTICS: { ENABLED: true, DURATION: 300 },
          USER: { ENABLED: false, DURATION: 600 },
          GEOIP: { ENABLED: true, DURATION: 86400 },
          SETTINGS: { ENABLED: true, DURATION: 3600 },
          RATE_LIMIT: { ENABLED: true, DURATION: 60 },
        },
      });
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.user.enabled()).toBe(false);
    });

    it('should return configured duration value', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.user.duration()).toBe(600);
    });
  });

  describe('getCacheConfig.geoip', () => {
    it('should return true when both cache and geoip are enabled', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.geoip.enabled()).toBe(true);
    });

    it('should return false when cache is disabled globally', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.geoip.enabled()).toBe(false);
    });

    it('should return configured duration value', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.geoip.duration()).toBe(86400);
    });
  });

  describe('getCacheConfig.settings', () => {
    it('should return true when both cache and settings are enabled', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.settings.enabled()).toBe(true);
    });

    it('should return false when cache is disabled globally', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.settings.enabled()).toBe(false);
    });

    it('should return configured duration value', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.settings.duration()).toBe(3600);
    });
  });

  describe('getCacheConfig.rateLimit', () => {
    it('should return true when both cache and rateLimit are enabled', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.rateLimit.enabled()).toBe(true);
    });

    it('should return false when cache is disabled globally', async () => {
      (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.rateLimit.enabled()).toBe(false);
    });

    it('should return configured duration value', async () => {
      const { getCacheConfig } = await import('@withwiz/cache/cache-config');
      expect(getCacheConfig.rateLimit.duration()).toBe(60);
    });
  });

  describe('getCacheTTL (deprecated aliases)', () => {
    it('should return settings duration', async () => {
      const { getCacheTTL } = await import('@withwiz/cache/cache-config');
      expect(getCacheTTL.settings()).toBe(3600);
    });

    it('should return user duration', async () => {
      const { getCacheTTL } = await import('@withwiz/cache/cache-config');
      expect(getCacheTTL.user()).toBe(600);
    });

    it('should return analytics duration', async () => {
      const { getCacheTTL } = await import('@withwiz/cache/cache-config');
      expect(getCacheTTL.analytics()).toBe(300);
    });

    it('should return geoip duration', async () => {
      const { getCacheTTL } = await import('@withwiz/cache/cache-config');
      expect(getCacheTTL.geoip()).toBe(86400);
    });

    it('should return default (analytics) duration', async () => {
      const { getCacheTTL } = await import('@withwiz/cache/cache-config');
      expect(getCacheTTL.default()).toBe(300);
    });
  });
});
