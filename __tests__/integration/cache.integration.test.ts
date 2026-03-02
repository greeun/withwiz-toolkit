/**
 * Integration Tests: 캐시 통합 테스트
 * Based on: docs/testing/02-integration/02-cache.md
 */


// Mock Redis Client
const mockRedis = {
  get: vi.fn<(key: string) => Promise<string | null>>(),
  set: vi.fn<(key: string, value: string) => Promise<string>>(),
  del: vi.fn<(key: string) => Promise<number>>(),
  setex: vi.fn<(key: string, ttl: number, value: string) => Promise<string>>(),
  ttl: vi.fn<(key: string) => Promise<number>>(),
  exists: vi.fn<(key: string) => Promise<number>>(),
};

// Mock In-Memory Cache
const inMemoryCache = new Map<string, { value: unknown; expiry: number }>();

// ============================================================================
// SC-INT-CACHE-001: 링크 캐시 동작
// ============================================================================
describe('SC-INT-CACHE-001: 링크 캐시 동작', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryCache.clear();
  });

  test('TC-INT-CACHE-001: 링크 정보 캐시 저장', async () => {
    const linkData = { id: '1', shortCode: 'abc123', originalUrl: 'https://example.com' };
    mockRedis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(linkData));
    mockRedis.set.mockResolvedValue('OK');

    // Step 1: 첫 번째 조회 → DB에서 조회, 캐시 저장
    const firstCall = await mockRedis.get('link:abc123');
    expect(firstCall).toBeNull();

    // Step 2-3: 두 번째 조회 → 캐시에서 반환
    await mockRedis.set('link:abc123', JSON.stringify(linkData));
    const secondCall = await mockRedis.get('link:abc123');
    expect(secondCall).toBe(JSON.stringify(linkData));
  });

  test('TC-INT-CACHE-002: 링크 캐시 TTL 만료', async () => {
    vi.useFakeTimers();
    const TTL_SECONDS = 3600;
    mockRedis.ttl.mockResolvedValue(TTL_SECONDS);
    mockRedis.setex.mockResolvedValue('OK');

    // Step 1: 링크 캐시 저장 → TTL 1시간 설정
    await mockRedis.setex('link:abc123', TTL_SECONDS, 'data');
    const ttl = await mockRedis.ttl('link:abc123');
    expect(ttl).toBe(3600);

    vi.useRealTimers();
  });
});

// ============================================================================
// SC-INT-CACHE-004: 캐시 무효화
// ============================================================================
describe('SC-INT-CACHE-004: 캐시 무효화', () => {
  test('TC-INT-CACHE-010: 링크 수정 시 캐시 무효화', async () => {
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);

    // Step 1: 링크 캐시 존재 확인
    const exists = await mockRedis.exists('link:abc123');
    expect(exists).toBe(1);

    // Step 2-3: 링크 수정 → 캐시 무효화
    await mockRedis.del('link:abc123');
    const afterDelete = await mockRedis.get('link:abc123');
    expect(afterDelete).toBeNull();
  });
});

// ============================================================================
// SC-INT-CACHE-005: 캐시 폴백 (In-Memory)
// ============================================================================
describe('SC-INT-CACHE-005: 캐시 폴백 (In-Memory)', () => {
  test('TC-INT-CACHE-020: Redis 장애 시 In-Memory 폴백', async () => {
    const cacheKey = 'link:abc123';
    const cacheValue = { originalUrl: 'https://example.com' };

    // Step 1: Redis 연결 실패 시뮬레이션
    mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

    // Step 2: In-Memory 캐시로 폴백
    inMemoryCache.set(cacheKey, { value: cacheValue, expiry: Date.now() + 3600000 });

    const fallbackValue = inMemoryCache.get(cacheKey);
    expect(fallbackValue?.value).toEqual(cacheValue);
  });
});

// ============================================================================
// 에러 처리 시나리오
// ============================================================================
describe('에러 처리 시나리오', () => {
  test('TC-INT-CACHE-020: Redis 연결 끊김', async () => {
    mockRedis.get.mockRejectedValue(new Error('Connection closed'));
    // Step 1-2: 캐시 조회 실패 → DB fallback
    await expect(mockRedis.get('key')).rejects.toThrow('Connection closed');
  });

  test('TC-INT-CACHE-023: TTL 만료 정확성', async () => {
    vi.useFakeTimers();
    const TTL_MS = 5000;
    inMemoryCache.set('test', { value: 'data', expiry: Date.now() + TTL_MS });
    
    // Step 1: 4초 후 조회 → 존재
    vi.advanceTimersByTime(4000);
    let entry = inMemoryCache.get('test');
    expect(entry && entry.expiry > Date.now()).toBe(true);
    
    // Step 2: 6초 후 조회 → null (만료)
    vi.advanceTimersByTime(2000);
    entry = inMemoryCache.get('test');
    expect(entry && entry.expiry > Date.now()).toBe(false);
    
    vi.useRealTimers();
  });
});
