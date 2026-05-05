/**
 * Health Check Tests
 *
 * src/system/health-check.ts 유닛 테스트
 * 서비스 헬스 체크 로직 검증
 */

vi.mock('@withwiz/cache/config', () => ({
  getResolvedCacheConfig: vi.fn(() => ({
    enabled: true,
    redis: { url: 'https://redis.test', token: 'token123', enabled: true },
  })),
}));

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@withwiz/utils/error-message-formatter', () => ({
  formatRedisError: vi.fn((msg: string) => msg),
  formatDatabaseError: vi.fn((msg: string) => msg),
}));

vi.mock('@withwiz/system/utils', () => ({
  getPlatform: vi.fn(() => 'darwin'),
}));

vi.mock('@withwiz/cache/cache', () => ({
  checkRedisConnection: vi.fn(),
}));

import { getResolvedCacheConfig } from '@withwiz/cache/config';
import { getPlatform } from '@withwiz/system/utils';

describe('Health Check - checkServiceHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      enabled: true,
      redis: { url: 'https://redis.test', token: 'token123', enabled: true },
    });
    (getPlatform as ReturnType<typeof vi.fn>).mockReturnValue('darwin');
  });

  describe('Database check', () => {
    it('should return warning status when prismaClient is not provided', async () => {
      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const dbService = services.find((s) => s.name === 'Database');

      expect(dbService).toBeDefined();
      expect(dbService!.status).toBe('warning');
      expect(dbService!.message).toContain('데이터베이스 클라이언트가 제공되지 않음');
    });

    it('should return ok status when prismaClient query succeeds', async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      };

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth(mockPrisma);
      const dbService = services.find((s) => s.name === 'Database');

      expect(dbService).toBeDefined();
      expect(dbService!.status).toBe('ok');
      expect(dbService!.message).toContain('데이터베이스 연결 정상');
      expect(dbService!.metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Response Time' }),
          expect.objectContaining({ label: 'Platform', value: 'macOS' }),
        ])
      );
    });

    it('should return error status when prismaClient query fails', async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth(mockPrisma);
      const dbService = services.find((s) => s.name === 'Database');

      expect(dbService).toBeDefined();
      expect(dbService!.status).toBe('error');
      expect(dbService!.message).toContain('데이터베이스 연결 실패');
      expect(dbService!.message).toContain('Connection refused');
    });

    it('should show Linux platform when not darwin', async () => {
      (getPlatform as ReturnType<typeof vi.fn>).mockReturnValue('linux');

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const dbService = services.find((s) => s.name === 'Database');

      expect(dbService!.metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Platform', value: 'Linux' }),
        ])
      );
    });
  });

  describe('Redis check', () => {
    it('should return warning when cache is disabled', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        enabled: false,
        redis: { url: 'https://redis.test', token: 'token123', enabled: true },
      });

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const redisService = services.find((s) => s.name === 'Redis');

      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('warning');
      expect(redisService!.message).toContain('CACHE_ENABLED=false');
    });

    it('should return warning when Redis URL is not configured', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        enabled: true,
        redis: { url: '', token: '', enabled: true },
      });

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const redisService = services.find((s) => s.name === 'Redis');

      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('warning');
      expect(redisService!.message).toContain('Redis 환경 변수가 설정되지 않음');
    });

    it('should return warning when Redis URL is missing (undefined)', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        enabled: true,
        redis: { url: undefined, token: undefined, enabled: true },
      });

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const redisService = services.find((s) => s.name === 'Redis');

      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('warning');
      expect(redisService!.message).toContain('Redis 환경 변수가 설정되지 않음');
    });

    it('should return ok when checkRedisConnection succeeds', async () => {
      const { checkRedisConnection } = await import('@withwiz/cache/cache');
      (checkRedisConnection as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        details: { responseTime: 5 },
      });

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const redisService = services.find((s) => s.name === 'Redis');

      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('ok');
      expect(redisService!.message).toContain('Redis 연결 정상');
    });

    it('should return error when checkRedisConnection fails', async () => {
      const { checkRedisConnection } = await import('@withwiz/cache/cache');
      (checkRedisConnection as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Connection timeout',
      });

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const redisService = services.find((s) => s.name === 'Redis');

      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('error');
      expect(redisService!.message).toContain('Redis 연결 실패');
    });

    it('should return error when Redis module import throws', async () => {
      const { checkRedisConnection } = await import('@withwiz/cache/cache');
      (checkRedisConnection as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Module not found')
      );

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const redisService = services.find((s) => s.name === 'Redis');

      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('error');
      expect(redisService!.message).toContain('Redis 연결 실패');
    });

    it('should return warning when getResolvedCacheConfig throws (cache disabled path)', async () => {
      (getResolvedCacheConfig as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Config not initialized');
      });

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth();
      const redisService = services.find((s) => s.name === 'Redis');

      expect(redisService).toBeDefined();
      expect(redisService!.status).toBe('warning');
      expect(redisService!.message).toContain('CACHE_ENABLED=false');
    });
  });

  describe('Combined results', () => {
    it('should return both Database and Redis service info', async () => {
      const { checkRedisConnection } = await import('@withwiz/cache/cache');
      (checkRedisConnection as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        details: { responseTime: 5 },
      });

      const mockPrisma = {
        $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      };

      const { checkServiceHealth } = await import('@withwiz/system/health-check');

      const services = await checkServiceHealth(mockPrisma);

      expect(services.length).toBeGreaterThanOrEqual(2);
      expect(services.find((s) => s.name === 'Database')).toBeDefined();
      expect(services.find((s) => s.name === 'Redis')).toBeDefined();
    });
  });
});
