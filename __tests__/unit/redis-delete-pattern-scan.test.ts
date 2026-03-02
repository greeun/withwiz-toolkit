/**
 * Unit Tests: Redis deletePattern - scan 기반 구현
 * Target: packages/@withwiz/toolkit/cache/redis-cache-manager.ts - deletePattern()
 *
 * 테스트 범위:
 * - keys() 대신 scan() 사용 확인
 * - cursor 기반 루프 동작 검증
 * - 빈 결과, 다중 배치, 에러 처리
 *
 * 관련 커밋: 8dc88431 - perf: Redis 명령 과다 사용 최적화 (월 500K 제한 대응)
 */

// Mock Logger
vi.mock("@withwiz/logger/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Redis Client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
  keys: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
};

vi.mock("@withwiz/cache/cache-redis", () => ({
  getRedisClient: vi.fn(() => mockRedis),
  CacheMetrics: vi.fn().mockImplementation(() => ({
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  })),
  RedisConnectionStatus: vi.fn().mockImplementation(() => ({
    isConnected: true,
    connectionErrors: 0,
    lastPingTime: null,
    lastConnectionError: null,
    lastConnectionErrorTime: null,
  })),
  notifyRedisError: vi.fn(),
  resetRedisGlobalState: vi.fn(),
  isRedisGloballyDisabled: vi.fn().mockReturnValue(false),
}));

vi.mock("@withwiz/cache/cache-env", () => ({
  getENV: vi.fn().mockReturnValue({
    CACHE_ENABLED: true,
    CACHE_REDIS_ENABLED: true,
    CACHE_DEFAULT_TTL: 3600,
  }),
  isCacheEnabled: vi.fn().mockReturnValue(true),
}));

import { RedisCacheManager } from "@withwiz/cache/redis-cache-manager";
import { getRedisClient } from "@withwiz/cache/cache-redis";
import { logger } from "@withwiz/logger/logger";

describe("SC-UNIT-REDIS-OPT-003: deletePattern scan 기반 구현", () => {
  let cacheManager: RedisCacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    RedisCacheManager.clearInstances();
    cacheManager = RedisCacheManager.getInstance("test");
  });

  describe("scan() 사용 확인", () => {
    test("TC-INT-REDIS-OPT-020: redis.scan() 호출 및 redis.keys() 미사용", async () => {
      // scan이 cursor=0을 반환하여 루프 종료
      mockRedis.scan.mockResolvedValue([0, ["test:key1", "test:key2"]]);
      mockRedis.del.mockResolvedValue(2);

      await cacheManager.deletePattern("user:*");

      // scan 호출 확인
      expect(mockRedis.scan).toHaveBeenCalled();
      // keys 미사용 확인
      expect(mockRedis.keys).not.toHaveBeenCalled();
      // scan 파라미터 확인 - match 패턴과 count
      expect(mockRedis.scan).toHaveBeenCalledWith(0, {
        match: expect.stringContaining("user:*"),
        count: 100,
      });
    });

    test("TC-INT-REDIS-OPT-021: cursor 루프 정상 동작 (다중 배치)", async () => {
      // 첫 번째 scan: cursor 100 반환 (더 있음)
      mockRedis.scan
        .mockResolvedValueOnce([100, ["test:key1", "test:key2"]])
        // 두 번째 scan: cursor 200 반환 (더 있음)
        .mockResolvedValueOnce([200, ["test:key3", "test:key4"]])
        // 세 번째 scan: cursor 0 반환 (완료)
        .mockResolvedValueOnce([0, ["test:key5"]]);

      mockRedis.del.mockResolvedValue(1);

      await cacheManager.deletePattern("test:*");

      // scan이 3회 호출됨
      expect(mockRedis.scan).toHaveBeenCalledTimes(3);
      // del이 3회 호출됨 (각 배치마다)
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
      // 각 배치의 키 삭제 확인
      expect(mockRedis.del).toHaveBeenCalledWith("test:key1", "test:key2");
      expect(mockRedis.del).toHaveBeenCalledWith("test:key3", "test:key4");
      expect(mockRedis.del).toHaveBeenCalledWith("test:key5");
    });

    test("TC-INT-REDIS-OPT-021b: cursor가 문자열로 반환되는 경우 parseInt 처리", async () => {
      // Upstash REST API는 cursor를 문자열로 반환할 수 있음
      mockRedis.scan
        .mockResolvedValueOnce(["150", ["test:key1"]])
        .mockResolvedValueOnce(["0", []]);

      mockRedis.del.mockResolvedValue(1);

      await cacheManager.deletePattern("test:*");

      // 문자열 cursor도 정상 처리
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
    });
  });

  describe("빈 결과 처리", () => {
    test("TC-INT-REDIS-OPT-022: 매칭 키가 없는 경우 del 미호출", async () => {
      // scan이 빈 배열 반환
      mockRedis.scan.mockResolvedValue([0, []]);

      await cacheManager.deletePattern("nonexistent:*");

      expect(mockRedis.scan).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("에러 처리", () => {
    test("TC-INT-REDIS-OPT-023: Redis 연결 실패 시 에러 로깅", async () => {
      mockRedis.scan.mockRejectedValue(new Error("Connection refused"));

      await cacheManager.deletePattern("test:*");

      // 에러가 catch되고 로깅됨
      expect(logger.error).toHaveBeenCalledWith(
        "Cache delete pattern error:",
        expect.any(Error),
      );
      // 함수가 에러를 throw하지 않음 (graceful)
    });
  });

  describe("Redis 클라이언트 미사용 시", () => {
    test("TC-INT-REDIS-OPT-024: Redis 클라이언트가 null이면 조용히 반환", async () => {
      (getRedisClient as Mock).mockReturnValueOnce(null);

      await cacheManager.deletePattern("test:*");

      expect(mockRedis.scan).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
