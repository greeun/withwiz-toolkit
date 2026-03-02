/**
 * index
 *
 * index
 * - System
 */
import { ISystemInfo } from './types';
import { getCpuInfo } from './cpu';
import { getMemoryInfo } from './memory';
import { getDiskInfo } from './disk';
import { getNetworkInfo } from './network';
import { checkEnvironmentVariables } from './environment';
import { checkServiceHealth } from './health-check';
import { getPlatform, getRecommendedCommands } from './utils';
import { logger } from '@withwiz/logger/logger';
import os from 'os';

        /**
         * 전체 시스템 정보를 수집하는 메인 함수
         * Linux와 macOS 플랫폼별로 최적화된 시스템 리소스 조회
         */
        export async function getSystemInfo(): Promise<ISystemInfo> {
          try {
            const platform = getPlatform();
            const startTime = Date.now();

            // 플랫폼별 권장 명령어 로깅
            const recommendedCommands = getRecommendedCommands();
            logger.debug(`[SYSTEM] Platform: ${platform}, Recommended commands:`, recommendedCommands);

            // 병렬로 모든 시스템 정보 수집 (타임아웃 설정)
            const timeoutMs = 10000; // 10초 타임아웃
            
            const [cpuInfo, memoryInfo, diskInfo, networkInfo, environmentInfo, servicesInfo] = await Promise.all([
              Promise.race([
                getCpuInfo(),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('CPU info timeout')), timeoutMs)
                )
              ]),
              Promise.race([
                getMemoryInfo(),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Memory info timeout')), timeoutMs)
                )
              ]),
              Promise.race([
                getDiskInfo(),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Disk info timeout')), timeoutMs)
                )
              ]),
              Promise.race([
                getNetworkInfo(),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Network info timeout')), timeoutMs)
                )
              ]),
              Promise.race([
                checkEnvironmentVariables(),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Environment info timeout')), timeoutMs)
                )
              ]),
              Promise.race([
                checkServiceHealth(),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Services info timeout')), timeoutMs)
                )
              ])
            ]);

            const endTime = Date.now();
            const collectionTime = endTime - startTime;

            // 시스템 정보 구성
            const systemInfo: ISystemInfo = {
              nodeVersion: process.version,
              osInfo: platform === 'darwin' ? 'macOS' : 'Linux',
              uptime: formatUptime(process.uptime()),
              cpu: cpuInfo,
              memory: memoryInfo,
              disk: diskInfo,
              network: networkInfo,
              environment: environmentInfo,
              services: servicesInfo
            };

            logger.debug(`[SYSTEM] System info collected in ${collectionTime}ms on ${platform}`);
            return systemInfo;

  } catch (error) {
    logger.error('[SYSTEM] Error collecting system info:', error);
    
    // 에러 시 기본 시스템 정보 반환
    return {
      nodeVersion: process.version,
      osInfo: getPlatform() === 'darwin' ? 'macOS' : 'Linux',
      uptime: formatUptime(process.uptime()),
      cpu: {
        system: 0,
        processUsage: 0,
        cores: os.cpus().length,
        loadAverage: [0, 0, 0]
      },
      memory: {
        total: 0,
        free: 0,
        used: 0,
        percent: 0,
        processUsed: 0
      },
      disk: {
        total: '0 GB',
        used: '0 GB',
        available: '0 GB',
        percent: 0
      },
      network: {
        rxRate: '0 B/s',
        txRate: '0 B/s',
        processRxRate: '0 B/s',
        processTxRate: '0 B/s',
        connections: 0,
        processConnections: 0
      },
      environment: [] as const,
      services: []
    };
  }
}

/**
 * 시스템 정보를 간단한 형태로 반환하는 함수
 */
export async function getSimpleSystemInfo() {
  try {
    const platform = getPlatform();
    const cpuInfo = await getCpuInfo();
    const memoryInfo = await getMemoryInfo();
    const diskInfo = await getDiskInfo();

    return {
      platform: platform === 'darwin' ? 'macOS' : 'Linux',
      cpu: {
        usage: `${cpuInfo.system}%`,
        cores: cpuInfo.cores,
        load: cpuInfo.loadAverage[0].toFixed(2)
      },
      memory: {
        total: formatBytes(memoryInfo.total),
        used: formatBytes(memoryInfo.used),
        percent: `${memoryInfo.percent}%`
      },
      disk: {
        total: diskInfo.total,
        used: diskInfo.used,
        percent: `${diskInfo.percent}%`
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('[SYSTEM] Error collecting simple system info:', error);
    return {
      platform: getPlatform() === 'darwin' ? 'macOS' : 'Linux',
      error: 'Failed to collect system info',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 특정 시스템 리소스만 조회하는 함수들
 */
export { getCpuInfo } from './cpu';
export { getMemoryInfo } from './memory';
export { getDiskInfo } from './disk';
export { getNetworkInfo } from './network';
export { checkEnvironmentVariables } from './environment';
export { checkServiceHealth } from './health-check';

// 헬퍼 함수들
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 
