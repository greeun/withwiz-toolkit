/**
 * 인메모리 Rate Limit 저장소·Limiter 테스트
 *
 * 테스트 범위:
 * - 고정 윈도 카운트와 한도 초과 판정, 윈도 만료 후 재시작
 * - 항목 상한 초과 시 만료가 가장 이른 항목 제거
 * - status·delete·clear·destroy·메트릭
 * - createInMemoryRateLimiter 의 IRateLimiter 계약과 키 접두사 분리
 */
import { InMemoryRateLimitStore } from '@withwiz/toolkit/core/rate-limit/in-memory-rate-limit-store';
import { createInMemoryRateLimiter } from '@withwiz/toolkit/next/middleware/in-memory-rate-limiter';

describe('InMemoryRateLimitStore', () => {
  let store: InMemoryRateLimitStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    store = new InMemoryRateLimitStore({ cleanupIntervalMs: 1_000 });
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
  });

  it('한도까지는 통과하고 넘으면 거부한다', () => {
    expect(store.check('ip', 2, 60_000)).toEqual({ success: true, remaining: 1, current: 1, resetIn: 60 });
    expect(store.check('ip', 2, 60_000)).toMatchObject({ success: true, remaining: 0, current: 2 });
    expect(store.check('ip', 2, 60_000)).toMatchObject({ success: false, remaining: 0, current: 3 });
  });

  it('윈도가 지나면 카운트를 새로 시작한다', () => {
    store.check('ip', 1, 10_000);
    expect(store.check('ip', 1, 10_000).success).toBe(false);
    vi.advanceTimersByTime(10_001);
    expect(store.check('ip', 1, 10_000)).toMatchObject({ success: true, current: 1 });
  });

  it('남은 시간(resetIn)을 초 단위로 올림한다', () => {
    store.check('ip', 5, 10_000);
    vi.advanceTimersByTime(2_500);
    expect(store.check('ip', 5, 10_000).resetIn).toBe(8);
  });

  it('항목 상한을 넘으면 만료가 가장 이른 항목을 제거한다', () => {
    const small = new InMemoryRateLimitStore({ maxEntries: 2, cleanupIntervalMs: 60_000 });
    small.check('a', 5, 1_000);
    small.check('b', 5, 5_000);
    small.check('c', 5, 5_000);
    expect(small.status('a', 5, 1).current).toBe(0);
    expect(small.status('b', 5, 5).current).toBe(1);
    expect(small.getMetrics()).toMatchObject({ size: 2, evictions: 1, maxEntries: 2 });
    small.destroy();
  });

  it('정리 타이머가 만료 항목을 지운다', () => {
    store.check('ip', 5, 500);
    vi.advanceTimersByTime(1_000);
    expect(store.getMetrics()).toMatchObject({ size: 0, cleanups: 1 });
  });

  it('status 는 카운트를 올리지 않는다', () => {
    store.check('ip', 5, 60_000);
    expect(store.status('ip', 5, 60)).toEqual({ remaining: 4, current: 1, resetIn: 60 });
    expect(store.status('ip', 5, 60).current).toBe(1);
    expect(store.status('other', 5, 60)).toEqual({ remaining: 5, current: 0, resetIn: 60 });
  });

  it('delete·clear 로 항목을 지운다', () => {
    store.check('a', 5, 60_000);
    store.check('b', 5, 60_000);
    store.delete('a');
    expect(store.getMetrics().size).toBe(1);
    store.clear();
    expect(store.getMetrics().size).toBe(0);
  });
});

describe('createInMemoryRateLimiter', () => {
  it('IRateLimiter 계약(config.limit, check)을 구현한다', async () => {
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.config.limit).toBe(1);
    await expect(limiter.check('1.1.1.1')).resolves.toEqual({ success: true, remaining: 0, resetIn: 60 });
    await expect(limiter.check('1.1.1.1')).resolves.toMatchObject({ success: false });
  });

  it('저장소를 공유해도 keyPrefix 로 한도를 분리한다', async () => {
    const store = new InMemoryRateLimitStore();
    const api = createInMemoryRateLimiter({ limit: 1, windowMs: 60_000, keyPrefix: 'api', store });
    const auth = createInMemoryRateLimiter({ limit: 1, windowMs: 60_000, keyPrefix: 'auth', store });
    await api.check('ip');
    await expect(auth.check('ip')).resolves.toMatchObject({ success: true });
    await expect(api.check('ip')).resolves.toMatchObject({ success: false });
    store.destroy();
  });
});
