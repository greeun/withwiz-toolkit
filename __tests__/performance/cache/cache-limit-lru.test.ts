/**
 * InMemory Cache Limit & LRU Eviction Tests
 *
 * 테스트 대상 수치는 .env.test 환경설정에서 관리
 * - TEST_INMEMORY_CACHE_MAX_SIZE: 최대 캐시 항목 수 (default: 500000)
 * - TEST_INMEMORY_CACHE_MAX_MEMORY_MB: 최대 메모리 MB (default: 2000)
 * - TEST_INMEMORY_CACHE_OVERFLOW_COUNT: eviction 테스트용 초과 항목 수 (default: 100)
 * - TEST_INMEMORY_CACHE_EXTRA_COUNT: 메트릭 테스트용 추가 항목 수 (default: 1000)
 * - TEST_INMEMORY_CACHE_SAMPLE_SIZE: 무결성 검증 샘플 수 (default: 100)
 * - TEST_INMEMORY_CACHE_HIT_MISS_COUNT: 히트율 테스트 조회 수 (default: 1000)
 *
 * 테스트 범위:
 * - TC-UNIT-MEMLRU-001: maxSize 도달 시 LRU eviction 동작
 * - TC-UNIT-MEMLRU-002: 접근한 항목은 eviction에서 보호
 * - TC-UNIT-MEMLRU-003: 연속 eviction 시 순서대로 제거
 * - TC-UNIT-MEMLRU-004: 대량 eviction 후 캐시 크기 일관성
 * - TC-UNIT-MEMLRU-005: eviction 메트릭 정확성
 * - TC-UNIT-MEMLRU-006: 히트율 계산 정확성
 * - TC-UNIT-MEMLRU-007: 통계 정확성
 * - TC-UNIT-MEMLRU-008: 데이터 무결성 (샘플링)
 * - TC-UNIT-MEMLRU-009: FIFO eviction 정책
 * - TC-UNIT-MEMLRU-010: TTL eviction 정책
 */

import * as dotenv from "dotenv";
import * as path from "path";

// .env.test 로드
dotenv.config({
  path: path.resolve(__dirname, "../../../../../.env.test"),
});

import { InMemoryCacheManager } from "@withwiz/cache/inmemory-cache-manager";

vi.mock("@withwiz/logger/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.useFakeTimers();

// ============================================================================
// .env.test 환경변수에서 테스트 수치 로드
// ============================================================================
const MAX_SIZE = parseInt(
  process.env.TEST_INMEMORY_CACHE_MAX_SIZE || "100000",
  10
);
const MAX_MEMORY_MB = parseInt(
  process.env.TEST_INMEMORY_CACHE_MAX_MEMORY_MB || "2000",
  10
);
const OVERFLOW_COUNT = parseInt(
  process.env.TEST_INMEMORY_CACHE_OVERFLOW_COUNT || "100",
  10
);
const EXTRA_COUNT = parseInt(
  process.env.TEST_INMEMORY_CACHE_EXTRA_COUNT || "1000",
  10
);
const SAMPLE_SIZE = parseInt(
  process.env.TEST_INMEMORY_CACHE_SAMPLE_SIZE || "100",
  10
);
const HIT_MISS_COUNT = parseInt(
  process.env.TEST_INMEMORY_CACHE_HIT_MISS_COUNT || "1000",
  10
);

/**
 * 헬퍼: 캐시에 N개 항목을 일괄 삽입
 */
async function fillCache(
  cache: InMemoryCacheManager,
  count: number,
  startIndex: number = 0,
  ttl?: number
): Promise<void> {
  for (let i = startIndex; i < startIndex + count; i++) {
    await cache.set(`item:${i}`, i, ttl);
  }
}

/**
 * 헬퍼: 공통 캐시 설정 생성
 */
function createCacheConfig(
  overrides?: Partial<{
    evictionPolicy: "lru" | "fifo" | "ttl";
  }>
) {
  return {
    maxSize: MAX_SIZE,
    maxMemoryMB: MAX_MEMORY_MB,
    evictionPolicy: overrides?.evictionPolicy || ("lru" as const),
    cleanupInterval: 999_999_999,
    defaultTTL: 86400,
  };
}

describe(`InMemory Cache Limit & LRU (maxSize: ${MAX_SIZE.toLocaleString()})`, () => {
  // 테스트 타임아웃 확장 (대량 데이터 처리)
  // timeout configured in vitest.config.ts;

  afterEach(() => {
    InMemoryCacheManager.clearInstances();
    vi.clearAllTimers();
  });

  // 환경변수 로드 확인
  it("환경변수 로드 확인", () => {
    expect(MAX_SIZE).toBeGreaterThan(0);
    expect(MAX_MEMORY_MB).toBeGreaterThan(0);
    expect(OVERFLOW_COUNT).toBeGreaterThan(0);
    expect(EXTRA_COUNT).toBeGreaterThan(0);
    expect(SAMPLE_SIZE).toBeGreaterThan(0);
    expect(HIT_MISS_COUNT).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`[Test Config] MAX_SIZE=${MAX_SIZE}, MAX_MEMORY_MB=${MAX_MEMORY_MB}, OVERFLOW=${OVERFLOW_COUNT}, EXTRA=${EXTRA_COUNT}`);
  });

  describe("SC-UNIT-MEMLRU-001: maxSize 도달 시 LRU eviction", () => {
    it("TC-UNIT-MEMLRU-001: maxSize 한계 도달 시 가장 오래된 미접근 항목 제거", async () => {
      const cache = new InMemoryCacheManager(
        "lru-limit-001",
        createCacheConfig()
      );

      // 1. MAX_SIZE개 삽입
      await fillCache(cache, MAX_SIZE);
      expect(cache.getStats().itemCount).toBe(MAX_SIZE);

      // 2. MAX_SIZE+1번째 항목 삽입 → eviction 발생
      await cache.set(`item:${MAX_SIZE}`, MAX_SIZE);

      // 3. 캐시 크기 유지
      expect(cache.getStats().itemCount).toBe(MAX_SIZE);

      // 4. 최초 삽입 항목(index=0) 제거 확인
      expect(await cache.get("item:0")).toBeNull();

      // 5. 마지막 삽입 항목 존재 확인
      expect(await cache.get(`item:${MAX_SIZE}`)).toBe(MAX_SIZE);

      cache.destroy();
    });

    it("TC-UNIT-MEMLRU-002: 접근한 항목은 eviction에서 보호", async () => {
      const cache = new InMemoryCacheManager(
        "lru-limit-002",
        createCacheConfig()
      );

      // 1. MAX_SIZE개 삽입
      await fillCache(cache, MAX_SIZE);

      // 2. index=0 접근 (LRU 순서 갱신)
      const val = await cache.get<number>("item:0");
      expect(val).toBe(0);

      // 3. MAX_SIZE+1번째 삽입 → index=1이 제거되어야 함
      await cache.set(`item:${MAX_SIZE}`, MAX_SIZE);

      // 4. index=0은 보호됨
      expect(await cache.get("item:0")).toBe(0);

      // 5. index=1은 제거됨 (접근 안 한 가장 오래된 항목)
      expect(await cache.get("item:1")).toBeNull();

      cache.destroy();
    });
  });

  describe("SC-UNIT-MEMLRU-002: 접근 패턴별 eviction", () => {
    it(`TC-UNIT-MEMLRU-003: 연속 ${OVERFLOW_COUNT}회 eviction 시 순서대로 제거`, async () => {
      const cache = new InMemoryCacheManager(
        "lru-limit-003",
        createCacheConfig()
      );

      // 1. MAX_SIZE개 삽입
      await fillCache(cache, MAX_SIZE);

      // 2. 추가 OVERFLOW_COUNT개 삽입 (OVERFLOW_COUNT회 eviction)
      await fillCache(cache, OVERFLOW_COUNT, MAX_SIZE);

      // 3. index=0~(OVERFLOW_COUNT-1) 제거 확인
      for (let i = 0; i < OVERFLOW_COUNT; i++) {
        expect(await cache.get(`item:${i}`)).toBeNull();
      }

      // 4. index=OVERFLOW_COUNT 존재 확인
      expect(await cache.get(`item:${OVERFLOW_COUNT}`)).toBe(OVERFLOW_COUNT);

      // 5. 새로 추가된 마지막 항목 존재 확인
      const lastNewIndex = MAX_SIZE + OVERFLOW_COUNT - 1;
      expect(await cache.get(`item:${lastNewIndex}`)).toBe(lastNewIndex);

      // 6. 캐시 크기 유지
      expect(cache.getStats().itemCount).toBe(MAX_SIZE);

      cache.destroy();
    });

    it("TC-UNIT-MEMLRU-004: 대량 eviction 후 캐시 크기 일관성", async () => {
      const cache = new InMemoryCacheManager(
        "lru-limit-004",
        createCacheConfig()
      );

      // MAX_SIZE 채운 후 EXTRA_COUNT개 초과 삽입
      await fillCache(cache, MAX_SIZE);
      await fillCache(cache, EXTRA_COUNT, MAX_SIZE);

      const stats = cache.getStats();

      // 캐시 크기 = maxSize
      expect(stats.itemCount).toBe(MAX_SIZE);

      // 사용률 = 100%
      expect(stats.utilizationPercent).toBe(100);

      cache.destroy();
    });
  });

  describe("SC-UNIT-MEMLRU-003: 메트릭 정확성", () => {
    it(`TC-UNIT-MEMLRU-005: ${EXTRA_COUNT.toLocaleString()}회 eviction 메트릭 정확성`, async () => {
      const cache = new InMemoryCacheManager(
        "lru-limit-005",
        createCacheConfig()
      );

      // MAX_SIZE개 삽입 → eviction 없음
      await fillCache(cache, MAX_SIZE);
      expect(cache.getMetrics().evictions).toBe(0);

      // 추가 EXTRA_COUNT개 삽입 → EXTRA_COUNT회 eviction
      await fillCache(cache, EXTRA_COUNT, MAX_SIZE);

      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBeGreaterThanOrEqual(EXTRA_COUNT);

      cache.destroy();
    });

    it(`TC-UNIT-MEMLRU-006: 히트율 계산 정확성 (${HIT_MISS_COUNT.toLocaleString()} hits + ${HIT_MISS_COUNT.toLocaleString()} misses)`, async () => {
      const cache = new InMemoryCacheManager(
        "lru-limit-006",
        createCacheConfig()
      );

      await fillCache(cache, MAX_SIZE);

      // 존재하는 키 HIT_MISS_COUNT개 조회 (hits)
      for (let i = 0; i < HIT_MISS_COUNT; i++) {
        await cache.get(`item:${i}`);
      }

      // 존재하지 않는 키 HIT_MISS_COUNT개 조회 (misses)
      for (let i = MAX_SIZE; i < MAX_SIZE + HIT_MISS_COUNT; i++) {
        await cache.get(`item:${i}`);
      }

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(HIT_MISS_COUNT);
      expect(metrics.misses).toBe(HIT_MISS_COUNT);
      expect(metrics.totalRequests).toBe(HIT_MISS_COUNT * 2);
      expect(metrics.hitRate).toBe(50);

      cache.destroy();
    });
  });

  describe("SC-UNIT-MEMLRU-004: 통계 정확성", () => {
    it(`TC-UNIT-MEMLRU-007: ${MAX_SIZE.toLocaleString()}개 채움 시 통계 값 정확성`, async () => {
      const cache = new InMemoryCacheManager(
        "lru-limit-007",
        createCacheConfig()
      );

      await fillCache(cache, MAX_SIZE);

      const stats = cache.getStats();

      expect(stats.itemCount).toBe(MAX_SIZE);
      expect(stats.maxSize).toBe(MAX_SIZE);
      expect(stats.utilizationPercent).toBe(100);
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
      expect(stats.memoryUtilizationPercent).toBeGreaterThan(0);

      cache.destroy();
    });
  });

  describe("SC-UNIT-MEMLRU-005: 데이터 무결성", () => {
    it(`TC-UNIT-MEMLRU-008: ${MAX_SIZE.toLocaleString()}개 삽입 후 랜덤 ${SAMPLE_SIZE}개 샘플링 무결성 확인`, async () => {
      const cache = new InMemoryCacheManager(
        "lru-limit-008",
        createCacheConfig()
      );

      await fillCache(cache, MAX_SIZE);

      // 랜덤 SAMPLE_SIZE개 키 샘플링 검증
      for (let s = 0; s < SAMPLE_SIZE; s++) {
        const idx = Math.floor(Math.random() * MAX_SIZE);
        const val = await cache.get<number>(`item:${idx}`);
        expect(val).toBe(idx);
      }

      // exists 확인 (10개)
      for (let s = 0; s < 10; s++) {
        const idx = Math.floor(Math.random() * MAX_SIZE);
        expect(await cache.exists(`item:${idx}`)).toBe(true);
      }

      cache.destroy();
    });
  });

  describe("SC-UNIT-MEMLRU-006: FIFO eviction 정책", () => {
    it("TC-UNIT-MEMLRU-009: FIFO 정책 - 접근 여부 무관하게 최초 삽입 항목 제거", async () => {
      const cache = new InMemoryCacheManager(
        "fifo-limit-009",
        createCacheConfig({ evictionPolicy: "fifo" })
      );

      // MAX_SIZE개 삽입
      await fillCache(cache, MAX_SIZE);

      // index=0 접근 (FIFO에서는 접근해도 보호 안 됨)
      expect(await cache.get("item:0")).toBe(0);

      // MAX_SIZE+1번째 삽입 → index=0 제거 (가장 먼저 삽입됨)
      await cache.set(`item:${MAX_SIZE}`, MAX_SIZE);

      // FIFO: 접근 여부 무관하게 가장 먼저 삽입된 항목 제거
      expect(await cache.get("item:0")).toBeNull();
      expect(await cache.get(`item:${MAX_SIZE}`)).toBe(MAX_SIZE);

      cache.destroy();
    });
  });

  describe("SC-UNIT-MEMLRU-007: TTL eviction 정책", () => {
    it("TC-UNIT-MEMLRU-010: TTL 정책 - 가장 빨리 만료될 항목 제거", async () => {
      const cache = new InMemoryCacheManager(
        "ttl-limit-010",
        createCacheConfig({ evictionPolicy: "ttl" })
      );

      // 1개 항목 TTL=10초로 삽입 (가장 빨리 만료)
      await cache.set("short-ttl", "will-be-evicted", 10);

      // 나머지 (MAX_SIZE-1)개 항목 TTL=3600초로 삽입
      await fillCache(cache, MAX_SIZE - 1, 0);

      expect(cache.getStats().itemCount).toBe(MAX_SIZE);

      // MAX_SIZE+1번째 삽입 → TTL=10초인 항목이 제거됨
      await cache.set("item:overflow", "new-value");

      // short-ttl 제거 확인 (가장 빨리 만료될 항목)
      expect(await cache.get("short-ttl")).toBeNull();

      // 새 항목 존재 확인
      expect(await cache.get("item:overflow")).toBe("new-value");

      cache.destroy();
    });
  });
});
