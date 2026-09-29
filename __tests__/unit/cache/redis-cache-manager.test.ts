/**
 * RedisCacheManager.setIfNotExists — Upstash `SET key value NX [EX ttl]` 원자 연산
 *
 * - 저장했으면('OK') true, 키가 이미 있으면(null) false
 * - 키 prefix·ttl(초) 규칙은 set 과 같다
 * - 원자성을 보장할 수 없는 경우(클라이언트 없음, 전역 비활성, 명령 오류)는 예외를 던진다.
 *   true 는 토큰 재사용을 허용하고, false 는 재사용으로 오판해 family 를 무효화하기 때문이다.
 * - 캐시 자체가 꺼져 있으면(isCacheEnabled false) NoopCacheManager 와 같게 true 를 반환한다.
 */

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
};

vi.mock('@withwiz/toolkit/core/cache/cache-redis', () => ({
  getRedisClient: vi.fn(() => mockRedis),
  notifyRedisError: vi.fn(),
  resetRedisGlobalState: vi.fn(),
  isRedisGloballyDisabled: vi.fn(() => false),
}));

vi.mock('@withwiz/toolkit/core/cache/cache-env', () => ({
  getENV: vi.fn(() => ({ CACHE: { ENABLED: true }, REDIS: { URL: 'u', TOKEN: 't' } })),
  isCacheEnabled: vi.fn(() => true),
}));

import { RedisCacheManager } from '@withwiz/toolkit/core/cache/redis-cache-manager';
import {
  getRedisClient,
  isRedisGloballyDisabled,
  notifyRedisError,
  resetRedisGlobalState,
} from '@withwiz/toolkit/core/cache/cache-redis';
import { isCacheEnabled } from '@withwiz/toolkit/core/cache/cache-env';

describe('RedisCacheManager.setIfNotExists', () => {
  let manager: RedisCacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValue(mockRedis);
    (isRedisGloballyDisabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    RedisCacheManager.clearInstances();
    manager = RedisCacheManager.getInstance('sinx');
  });

  it("ttl 이 있으면 prefix 를 붙인 키로 { nx: true, ex: ttl } 을 보내고 'OK' 면 true 를 반환한다", async () => {
    mockRedis.set.mockResolvedValue('OK');

    await expect(manager.setIfNotExists('rt:used:jti-1', 1, 120)).resolves.toBe(true);

    expect(mockRedis.set).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledWith('sinx:rt:used:jti-1', 1, { nx: true, ex: 120 });
    expect(resetRedisGlobalState).toHaveBeenCalled();
  });

  it('ttl 이 없으면 { nx: true } 만 보낸다 (set 과 같이 만료 없이 저장)', async () => {
    mockRedis.set.mockResolvedValue('OK');

    await expect(manager.setIfNotExists('k', 'v')).resolves.toBe(true);

    expect(mockRedis.set).toHaveBeenCalledWith('sinx:k', 'v', { nx: true });
  });

  it('키가 이미 있어 Redis 가 null 을 반환하면 false 를 반환한다', async () => {
    mockRedis.set.mockResolvedValue(null);

    await expect(manager.setIfNotExists('k', 'v', 60)).resolves.toBe(false);
  });

  it('Redis 명령 오류는 오류 메트릭·전역 상태에 반영하고 예외를 다시 던진다 (true/false 로 삼키지 않음)', async () => {
    const error = new Error('redis down');
    mockRedis.set.mockRejectedValue(error);

    await expect(manager.setIfNotExists('k', 'v', 60)).rejects.toThrow('redis down');

    expect(notifyRedisError).toHaveBeenCalledWith(error, 'CacheManager.setIfNotExists:sinx');
    expect(manager.getMetrics().errors).toBe(1);
    expect(manager.getConnectionStatus().connectionErrors).toBe(1);
  });

  it('Redis 클라이언트가 없으면 원자성을 보장할 수 없으므로 예외를 던진다', async () => {
    (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValue(null);

    await expect(manager.setIfNotExists('k', 'v', 60)).rejects.toThrow(/Redis/);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('Redis 가 전역 비활성 상태이면 명령을 보내지 않고 예외를 던진다', async () => {
    (isRedisGloballyDisabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await expect(manager.setIfNotExists('k', 'v', 60)).rejects.toThrow(/Redis/);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('캐시가 비활성화되어 있으면 NoopCacheManager 와 같게 저장 없이 true 를 반환한다', async () => {
    (isCacheEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(manager.setIfNotExists('k', 'v', 60)).resolves.toBe(true);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('undefined 값은 set 과 같이 저장하지 않으며, 저장 여부를 true/false 로 꾸미지 않고 예외를 던진다', async () => {
    await expect(manager.setIfNotExists('k', undefined, 60)).rejects.toThrow(TypeError);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });
});
