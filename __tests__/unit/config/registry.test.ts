// __tests__/unit/config/registry.test.ts
import { config, resetConfig } from '../../../src/config/registry';
import { initialize } from '../../../src/initialize';
import { initializeCommon, getCommonConfig, resetCommon } from '../../../src/config/common';
import { initializeAuth, getAuthConfig, resetAuth } from '../../../src/auth/config';
import { initializeLogger, getLoggerConfig, resetLogger } from '../../../src/logger/config';
import { initializeCache, getResolvedCacheConfig, resetCache } from '../../../src/cache/config';
import { initializeStorage, getStorageConfig, resetStorage } from '../../../src/storage/config';
import { initializeGeolocation, getGeolocationConfig, resetGeolocation } from '../../../src/geolocation/config';
import { initializeCors, getCorsConfig, resetCors } from '../../../src/middleware/cors-config';

const FULL_CONFIG = {
  nodeEnv: 'test' as const,
  auth: { jwtSecret: 'test-secret-32-chars-xxxxxxxxxx' },
  logger: { level: 'warn' },
  cache: { enabled: true },
  storage: {
    accountId: 'acc',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    bucketName: 'bucket',
  },
  geolocation: { ipgeolocationApiKey: 'geo-key' },
  cors: { allowedOrigins: ['https://example.com'] },
};

function resetAll() {
  resetCommon();
  resetAuth();
  resetLogger();
  resetCache();
  resetStorage();
  resetGeolocation();
  resetCors();
}

describe('Config Registry — 단일 저장소 보장', () => {
  beforeEach(() => {
    resetAll();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. 미초기화 상태
  // ==========================================================================

  describe('미초기화 상태', () => {
    it('모든 모듈이 undefined를 반환해야 한다', () => {
      expect(config.common).toBeUndefined();
      expect(config.auth).toBeUndefined();
      expect(config.logger).toBeUndefined();
      expect(config.cache).toBeUndefined();
      expect(config.storage).toBeUndefined();
      expect(config.geolocation).toBeUndefined();
      expect(config.cors).toBeUndefined();
    });
  });

  // ==========================================================================
  // 2. initialize()로 초기화 → config.* === get*Config() 동일 참조
  // ==========================================================================

  describe('initialize()로 초기화한 경우', () => {
    beforeEach(() => {
      initialize(FULL_CONFIG);
    });

    it('config.common과 getCommonConfig()이 동일 객체여야 한다', () => {
      expect(config.common).toBe(getCommonConfig());
    });

    it('config.auth와 getAuthConfig()이 동일 객체여야 한다', () => {
      expect(config.auth).toBe(getAuthConfig());
    });

    it('config.logger와 getLoggerConfig()이 동일 객체여야 한다', () => {
      expect(config.logger).toBe(getLoggerConfig());
    });

    it('config.cache와 getResolvedCacheConfig()이 동일 객체여야 한다', () => {
      expect(config.cache).toBe(getResolvedCacheConfig());
    });

    it('config.storage와 getStorageConfig()이 동일 객체여야 한다', () => {
      expect(config.storage).toBe(getStorageConfig());
    });

    it('config.geolocation과 getGeolocationConfig()이 동일 객체여야 한다', () => {
      expect(config.geolocation).toBe(getGeolocationConfig());
    });

    it('config.cors와 getCorsConfig()이 동일 객체여야 한다', () => {
      expect(config.cors).toBe(getCorsConfig());
    });

    it('config.auth.jwtSecret과 getAuthConfig().jwtSecret 값이 같아야 한다', () => {
      expect(config.auth.jwtSecret).toBe(getAuthConfig().jwtSecret);
      expect(config.auth.jwtSecret).toBe('test-secret-32-chars-xxxxxxxxxx');
    });

    it('config.logger.level과 getLoggerConfig().level 값이 같아야 한다', () => {
      expect(config.logger.level).toBe(getLoggerConfig().level);
      expect(config.logger.level).toBe('warn');
    });
  });

  // ==========================================================================
  // 3. 개별 initialize[Module]()로 초기화 → config.* === get*Config() 동일 참조
  // ==========================================================================

  describe('개별 initialize[Module]()로 초기화한 경우', () => {
    it('initializeCommon → config.common === getCommonConfig()', () => {
      initializeCommon({ nodeEnv: 'production' });
      expect(config.common).toBe(getCommonConfig());
      expect(config.common.nodeEnv).toBe('production');
    });

    it('initializeAuth → config.auth === getAuthConfig()', () => {
      initializeAuth({ jwtSecret: 'individual-secret' });
      expect(config.auth).toBe(getAuthConfig());
      expect(config.auth.jwtSecret).toBe('individual-secret');
    });

    it('initializeLogger → config.logger === getLoggerConfig()', () => {
      initializeLogger({ level: 'debug', dir: '/tmp/logs' });
      expect(config.logger).toBe(getLoggerConfig());
      expect(config.logger.level).toBe('debug');
      expect(config.logger.dir).toBe('/tmp/logs');
    });

    it('initializeCache → config.cache === getResolvedCacheConfig()', () => {
      initializeCache({ enabled: false });
      expect(config.cache).toBe(getResolvedCacheConfig());
      expect(config.cache!.enabled).toBe(false);
    });

    it('initializeStorage → config.storage === getStorageConfig()', () => {
      initializeStorage(FULL_CONFIG.storage);
      expect(config.storage).toBe(getStorageConfig());
      expect(config.storage!.bucketName).toBe('bucket');
    });

    it('initializeGeolocation → config.geolocation === getGeolocationConfig()', () => {
      initializeGeolocation({ ipgeolocationApiKey: 'key-123' });
      expect(config.geolocation).toBe(getGeolocationConfig());
      expect(config.geolocation!.ipgeolocationApiKey).toBe('key-123');
    });

    it('initializeCors → config.cors === getCorsConfig()', () => {
      initializeCors({ allowedOrigins: ['https://a.com'] });
      expect(config.cors).toBe(getCorsConfig());
      expect(config.cors!.allowedOrigins).toEqual(['https://a.com']);
    });
  });

  // ==========================================================================
  // 4. 선택적 모듈 미초기화 → config.*는 undefined
  // ==========================================================================

  describe('선택적 모듈 미초기화', () => {
    it('필수 모듈만 초기화하면 선택적 모듈은 undefined', () => {
      initialize({ nodeEnv: 'test', auth: FULL_CONFIG.auth, logger: FULL_CONFIG.logger });

      expect(config.common).toBeDefined();
      expect(config.auth).toBeDefined();
      expect(config.logger).toBeDefined();

      expect(config.cache).toBeUndefined();
      expect(config.storage).toBeUndefined();
      expect(config.geolocation).toBeUndefined();
      expect(config.cors).toBeUndefined();
    });
  });

  // ==========================================================================
  // 5. resetConfig → 모든 모듈 스토어 초기화
  // ==========================================================================

  describe('resetConfig', () => {
    it('모든 모듈 스토어를 초기화해야 한다', () => {
      initialize(FULL_CONFIG);

      expect(config.auth).toBeDefined();
      expect(config.cache).toBeDefined();

      resetConfig();

      expect(config.common).toBeUndefined();
      expect(config.auth).toBeUndefined();
      expect(config.logger).toBeUndefined();
      expect(config.cache).toBeUndefined();
      expect(config.storage).toBeUndefined();
      expect(config.geolocation).toBeUndefined();
      expect(config.cors).toBeUndefined();
    });

    it('resetConfig 후 개별 getter도 에러를 던져야 한다', () => {
      initialize(FULL_CONFIG);
      resetConfig();

      expect(() => getAuthConfig()).toThrow();
      expect(() => getLoggerConfig()).toThrow();
      expect(() => getResolvedCacheConfig()).toThrow();
      expect(() => getStorageConfig()).toThrow();
      expect(() => getGeolocationConfig()).toThrow();
      expect(() => getCorsConfig()).toThrow();
    });
  });

  // ==========================================================================
  // 6. 읽기 전용 보호
  // ==========================================================================

  describe('읽기 전용 보호', () => {
    it('config 프록시에 직접 할당하면 TypeError', () => {
      expect(() => {
        (config as any).auth = { jwtSecret: 'hacked' };
      }).toThrow(TypeError);
      expect(() => {
        (config as any).auth = {};
      }).toThrow('config is read-only');
    });
  });
});
