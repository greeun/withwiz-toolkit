/**
 * Health Check
 *
 * 외부 서비스 연결 상태 확인
 * - Database (Prisma)
 * - Redis (Cache)
 *
 * ⚠️ CONDITIONAL: prismaClient가 제공되지 않으면 DB 체크 스킵
 */
import { IServiceInfo } from './types';
import { getPlatform } from './utils';
import { formatRedisError, formatDatabaseError } from '@withwiz/utils/error-message-formatter';
import { logger } from '@withwiz/logger/logger';

/**
 * 서비스 헬스 체크
 *
 * @param prismaClient - Prisma 클라이언트 (선택사항)
 * @returns 서비스 상태 정보 배열
 *
 * @example
 * ```typescript
 * // From your project
 * import { checkServiceHealth } from '@withwiz/system/health-check';
 * import { prisma } from '<your-project>/prisma';
 *
 * const status = await checkServiceHealth(prisma);
 * ```
 */
export async function checkServiceHealth(prismaClient?: any): Promise<IServiceInfo[]> {
  const platform = getPlatform();
  const services: IServiceInfo[] = [];

  // 데이터베이스 연결 체크
  if (prismaClient) {
    try {
      const dbStart = Date.now();

      // Prisma 클라이언트로 연결 테스트
      await prismaClient.$queryRaw`SELECT 1`;

      const dbResponseTime = Date.now() - dbStart;

      services.push({
        name: 'Database',
        status: 'ok',
        message: '데이터베이스 연결 정상',
        metrics: [
          { label: 'Response Time', value: `${dbResponseTime}ms` },
          { label: 'Platform', value: platform === 'darwin' ? 'macOS' : 'Linux' }
        ]
      });
    } catch (dbError) {
      const dbResponseTime = Date.now();
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      services.push({
        name: 'Database',
        status: 'error',
        message: `데이터베이스 연결 실패: ${formatDatabaseError(errorMessage)}`,
        metrics: [
          { label: 'Response Time', value: `${dbResponseTime}ms` },
          { label: 'Platform', value: platform === 'darwin' ? 'macOS' : 'Linux' }
        ]
      });
    }
  } else {
    logger.debug('[Health Check] Prisma client not provided, skipping database check');
    services.push({
      name: 'Database',
      status: 'warning',
      message: '데이터베이스 클라이언트가 제공되지 않음',
      metrics: [
        { label: 'Platform', value: platform === 'darwin' ? 'macOS' : 'Linux' }
      ]
    });
  }

  // Redis 연결 체크
  try {
    const redisStart = Date.now();

    // CACHE_ENABLED 환경 변수 확인 (기본값: true)
    const cacheEnabled = process.env.CACHE_ENABLED !== 'false';

    // Redis 연결 테스트 (환경 변수 확인)
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    // 캐시가 비활성화되어 있으면 Redis 연결 체크 건너뛰기
    if (!cacheEnabled) {
      services.push({
        name: 'Redis',
        status: 'warning',
        message: 'Redis 캐시 비활성화됨 (CACHE_ENABLED=false)',
        metrics: [
          { label: 'Platform', value: platform === 'darwin' ? 'macOS' : 'Linux' }
        ]
      });
    } else if (redisUrl && redisToken && redisUrl.trim() !== '' && redisToken.trim() !== '') {
      try {
        // Redis 연결 테스트 (checkRedisConnection 함수 사용)
        const { checkRedisConnection } = await import('@withwiz/cache/cache');
        const redisStatus = await checkRedisConnection();

        if (redisStatus.success) {
          const redisResponseTime = Date.now() - redisStart;
          services.push({
            name: 'Redis',
            status: 'ok',
            message: 'Redis 연결 정상',
            metrics: [
              { label: 'Response Time', value: `${redisResponseTime}ms` },
              { label: 'Platform', value: platform === 'darwin' ? 'macOS' : 'Linux' }
            ]
          });
        } else {
          const errorMessage = redisStatus.error || 'Redis 연결 실패';
          throw new Error(formatRedisError(errorMessage));
        }
      } catch (redisError) {
        const redisResponseTime = Date.now() - redisStart;
        const errorMessage = redisError instanceof Error ? redisError.message : 'Unknown error';
        services.push({
          name: 'Redis',
          status: 'error',
          message: `Redis 연결 실패: ${formatRedisError(errorMessage)}`,
          metrics: [
            { label: 'Response Time', value: `${redisResponseTime}ms` },
            { label: 'Platform', value: platform === 'darwin' ? 'macOS' : 'Linux' }
          ]
        });
      }
    } else {
      services.push({
        name: 'Redis',
        status: 'warning',
        message: 'Redis 환경 변수가 설정되지 않음',
        metrics: [
          { label: 'Platform', value: platform === 'darwin' ? 'macOS' : 'Linux' }
        ]
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    services.push({
      name: 'Redis',
      status: 'error',
      message: `Redis 모듈 로드 실패: ${formatRedisError(errorMessage)}`,
      metrics: [
        { label: 'Platform', value: platform === 'darwin' ? 'macOS' : 'Linux' }
      ]
    });
  }

  // 플랫폼별 서비스 체크 - 제거됨
  // macOS Services와 System Monitor 서비스는 System Basic Infos 카드로 통합됨

  return services;
} 
