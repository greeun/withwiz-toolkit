/**
 * System Module Unit Tests
 *
 * health-check, environment, utils의 순수 함수 테스트
 * CPU/Memory/Disk/Network는 OS 명령어 의존이라 utils 헬퍼만 테스트
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// logger mock
vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// error-message-formatter mock
vi.mock('@withwiz/utils/error-message-formatter', () => ({
  formatRedisError: vi.fn((msg: string) => `[Redis] ${msg}`),
  formatDatabaseError: vi.fn((msg: string) => `[DB] ${msg}`),
}));

// cache mock
vi.mock('@withwiz/cache/cache', () => ({
  checkRedisConnection: vi.fn(),
}));

describe('System Utils', () => {
  describe('getPlatform', () => {
    it('should return current platform string', async () => {
      const { getPlatform } = await import('@withwiz/system/utils');
      const platform = getPlatform();
      expect(typeof platform).toBe('string');
      expect(['darwin', 'linux', 'win32']).toContain(platform);
    });
  });

  describe('formatBytesPerSec', () => {
    it('should return "0 B/s" for zero or negative values', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      expect(formatBytesPerSec(0)).toBe('0 B/s');
      expect(formatBytesPerSec(-100)).toBe('0 B/s');
    });

    it('should format bytes per second', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      expect(formatBytesPerSec(500)).toBe('500 B/s');
    });

    it('should format KB per second', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      const result = formatBytesPerSec(1024);
      expect(result).toBe('1 KB/s');
    });

    it('should format MB per second', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      const result = formatBytesPerSec(1024 * 1024);
      expect(result).toBe('1 MB/s');
    });

    it('should format GB per second', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      const result = formatBytesPerSec(1024 * 1024 * 1024);
      expect(result).toBe('1 GB/s');
    });

    it('should handle fractional values', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      const result = formatBytesPerSec(1536); // 1.5 KB
      expect(result).toBe('1.5 KB/s');
    });
  });

  describe('convertToBytes', () => {
    it('should convert B correctly', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(100, 'B')).toBe(100);
    });

    it('should convert KiB correctly', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(1, 'KiB')).toBe(1024);
    });

    it('should convert MiB correctly', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(1, 'MiB')).toBe(1024 * 1024);
    });

    it('should convert GiB correctly', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(1, 'GiB')).toBe(1024 * 1024 * 1024);
    });

    it('should return raw value for unknown units', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(42, 'unknown')).toBe(42);
    });
  });

  describe('getRecommendedCommands', () => {
    it('should return commands for current platform', async () => {
      const { getRecommendedCommands } = await import('@withwiz/system/utils');
      const commands = getRecommendedCommands();

      expect(commands).toHaveProperty('cpu');
      expect(commands).toHaveProperty('memory');
      expect(commands).toHaveProperty('disk');
      expect(commands).toHaveProperty('network');

      expect(Array.isArray(commands.cpu)).toBe(true);
      expect(commands.cpu.length).toBeGreaterThan(0);
    });
  });
});

describe('Environment Check', () => {
  // checkEnvironmentVariables는 config 모듈들을 읽으므로
  // 각 테스트에서 config를 적절히 초기화/리셋합니다.
  beforeEach(async () => {
    // 각 테스트 전 config 리셋
    const { resetCommon } = await import('../../../src/config/common');
    const { resetAuth } = await import('../../../src/auth/config');
    const { resetCache } = await import('../../../src/cache/config');
    resetCommon();
    resetAuth();
    resetCache();
  });

  describe('checkEnvironmentVariables', () => {
    it('should check required env vars and return results', async () => {
      const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
      const results = checkEnvironmentVariables();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Each result should have key, ok properties
      for (const result of results) {
        expect(result).toHaveProperty('key');
        expect(result).toHaveProperty('ok');
        expect(typeof result.key).toBe('string');
        expect(typeof result.ok).toBe('boolean');
      }
    });

    it('should include platform info', async () => {
      const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
      const results = checkEnvironmentVariables();

      const platformResult = results.find((r) => r.key === 'PLATFORM');
      expect(platformResult).toBeDefined();
      expect(platformResult!.ok).toBe(true);
      expect(['macOS', 'Linux']).toContain(platformResult!.value);
    });

    it('should include NODE_ENV from common config', async () => {
      // common config를 'test'로 초기화
      const { initializeCommon } = await import('../../../src/config/common');
      initializeCommon({ nodeEnv: 'test' });

      const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
      const results = checkEnvironmentVariables();

      const nodeEnvResult = results.find((r) => r.key === 'NODE_ENV');
      expect(nodeEnvResult).toBeDefined();
      expect(nodeEnvResult!.value).toBe('test');
    });

    it('should include architecture info', async () => {
      const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
      const results = checkEnvironmentVariables();

      const archResult = results.find((r) => r.key === 'ARCHITECTURE');
      expect(archResult).toBeDefined();
      expect(archResult!.ok).toBe(true);
    });

    it('should mark JWT_SECRET as not ok when auth not initialized', async () => {
      // resetAuth()는 beforeEach에서 이미 호출됨
      const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
      const results = checkEnvironmentVariables();

      const jwtResult = results.find((r) => r.key === 'JWT_SECRET');
      expect(jwtResult).toBeDefined();
      expect(jwtResult!.ok).toBe(false);
      expect(jwtResult!.value).toBeUndefined();
    });

    it('should truncate long JWT_SECRET values', async () => {
      const { initializeAuth } = await import('../../../src/auth/config');
      const longSecret = 'a'.repeat(50); // 50자 JWT secret
      initializeAuth({ jwtSecret: longSecret });

      const { checkEnvironmentVariables } = await import('@withwiz/system/environment');
      const results = checkEnvironmentVariables();

      const jwtResult = results.find((r) => r.key === 'JWT_SECRET');
      expect(jwtResult).toBeDefined();
      expect(jwtResult!.ok).toBe(true);
      expect(jwtResult!.value!.endsWith('...')).toBe(true);
      expect(jwtResult!.value!.length).toBeLessThanOrEqual(23); // 20 + "..."
    });
  });
});

describe('Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkServiceHealth', () => {
    it('should return warning for Database when no prisma client provided', async () => {
      const { checkServiceHealth } = await import('@withwiz/system/health-check');
      const services = await checkServiceHealth();

      const dbService = services.find((s) => s.name === 'Database');
      expect(dbService).toBeDefined();
      expect(dbService!.status).toBe('warning');
      expect(dbService!.message).toContain('제공되지 않음');
    });

    it('should return ok for Database when prisma query succeeds', async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
      };
      const { checkServiceHealth } = await import('@withwiz/system/health-check');
      const services = await checkServiceHealth(mockPrisma);

      const dbService = services.find((s) => s.name === 'Database');
      expect(dbService).toBeDefined();
      expect(dbService!.status).toBe('ok');
      expect(dbService!.message).toContain('정상');
    });

    it('should return error for Database when prisma query fails', async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };
      const { checkServiceHealth } = await import('@withwiz/system/health-check');
      const services = await checkServiceHealth(mockPrisma);

      const dbService = services.find((s) => s.name === 'Database');
      expect(dbService).toBeDefined();
      expect(dbService!.status).toBe('error');
      expect(dbService!.message).toContain('실패');
    });

    it('should include metrics with response time', async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
      };
      const { checkServiceHealth } = await import('@withwiz/system/health-check');
      const services = await checkServiceHealth(mockPrisma);

      const dbService = services.find((s) => s.name === 'Database');
      expect(dbService!.metrics).toBeDefined();
      expect(dbService!.metrics.length).toBeGreaterThan(0);

      const responseTimeMetric = dbService!.metrics.find((m) => m.label === 'Response Time');
      expect(responseTimeMetric).toBeDefined();
      expect(responseTimeMetric!.value).toMatch(/\d+ms/);
    });

    it('should return Redis warning when CACHE_ENABLED is false', async () => {
      process.env.CACHE_ENABLED = 'false';
      const { checkServiceHealth } = await import('@withwiz/system/health-check');
      const services = await checkServiceHealth();

      const redisService = services.find((s) => s.name === 'Redis');
      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('warning');
      expect(redisService!.message).toContain('비활성화');
    });

    it('should return Redis warning when env vars are missing', async () => {
      delete process.env.REDIS_REST_URL;
      delete process.env.REDIS_REST_TOKEN;
      const { checkServiceHealth } = await import('@withwiz/system/health-check');
      const services = await checkServiceHealth();

      const redisService = services.find((s) => s.name === 'Redis');
      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('warning');
    });

    it('should always return at least Database and Redis services', async () => {
      const { checkServiceHealth } = await import('@withwiz/system/health-check');
      const services = await checkServiceHealth();

      expect(services.length).toBeGreaterThanOrEqual(2);
      expect(services.some((s) => s.name === 'Database')).toBe(true);
      expect(services.some((s) => s.name === 'Redis')).toBe(true);
    });

    it('should include platform info in metrics', async () => {
      const { checkServiceHealth } = await import('@withwiz/system/health-check');
      const services = await checkServiceHealth();

      for (const service of services) {
        const platformMetric = service.metrics.find((m) => m.label === 'Platform');
        expect(platformMetric).toBeDefined();
        expect(['macOS', 'Linux']).toContain(platformMetric!.value);
      }
    });
  });
});
