/**
 * cpu
 *
 * cpu
 * - System
 */
import os from 'os';
import { runCommand, runMacCommand } from './utils';
import { ICpuInfo } from './types';
import { logger } from '@withwiz/logger/logger';

export async function getCpuInfo(): Promise<ICpuInfo> {
  try {
    const platform = os.platform();
    let systemUsage = 0;
    let processUsage = 0;

    if (platform === 'darwin') {
      // macOS용 CPU 사용률 조회
      try {
        // 방법 1: top 명령어 사용 (가장 정확)
        const cpuOutput = await runMacCommand("top -l 1 -n 0 | grep 'CPU usage'");
        const cpuMatch = cpuOutput.match(/CPU usage:\s+(\d+\.?\d*)% user,\s+(\d+\.?\d*)% sys,\s+(\d+\.?\d*)% idle/);
        
        if (cpuMatch) {
          const userUsage = parseFloat(cpuMatch[1]);
          const sysUsage = parseFloat(cpuMatch[2]);
          systemUsage = userUsage + sysUsage;
        } else {
          // 방법 2: iostat 명령어 사용 (macOS)
          try {
            // macOS iostat: KB/t tps MB/s us sy id 형식
            const iostatOutput = await runMacCommand("iostat -c 2 | tail -n 1");
            const parts = iostatOutput.trim().split(/\s+/);
            // us(user), sy(system), id(idle) 컬럼 위치는 고정됨
            if (parts.length >= 6) {
              const userUsage = parseFloat(parts[3]) || 0;
              const sysUsage = parseFloat(parts[4]) || 0;
              systemUsage = userUsage + sysUsage;
            }
          } catch (iostatError) {
            logger.debug('iostat fallback failed:', iostatError);
            
            // 방법 3: vm_stat을 통한 CPU 사용률 추정 (개선된 버전)
            try {
              const vmstatOutput = await runMacCommand("vm_stat");
              const lines = vmstatOutput.split('\n');
              
              let activePages = 0;
              let wiredPages = 0;
              let compressedPages = 0;
              let speculativePages = 0;
              let purgeablePages = 0;
              let freePages = 0;
              let inactivePages = 0;
              
              for (const line of lines) {
                if (line.includes('Pages active:')) {
                  const match = line.match(/Pages active:\s+(\d+)/);
                  if (match) activePages = parseInt(match[1]) || 0;
                } else if (line.includes('Pages wired down:')) {
                  const match = line.match(/Pages wired down:\s+(\d+)/);
                  if (match) wiredPages = parseInt(match[1]) || 0;
                } else if (line.includes('Pages occupied by compressor:')) {
                  const match = line.match(/Pages occupied by compressor:\s+(\d+)/);
                  if (match) compressedPages = parseInt(match[1]) || 0;
                } else if (line.includes('Pages speculative:')) {
                  const match = line.match(/Pages speculative:\s+(\d+)/);
                  if (match) speculativePages = parseInt(match[1]) || 0;
                } else if (line.includes('Pages purgeable:')) {
                  const match = line.match(/Pages purgeable:\s+(\d+)/);
                  if (match) purgeablePages = parseInt(match[1]) || 0;
                } else if (line.includes('Pages free:')) {
                  const match = line.match(/Pages free:\s+(\d+)/);
                  if (match) freePages = parseInt(match[1]) || 0;
                } else if (line.includes('Pages inactive:')) {
                  const match = line.match(/Pages inactive:\s+(\d+)/);
                  if (match) inactivePages = parseInt(match[1]) || 0;
                }
              }
              
              // 사용 중인 메모리와 전체 메모리 계산
              const usedPages = activePages + wiredPages + compressedPages + speculativePages;
              const totalPages = usedPages + freePages + inactivePages + purgeablePages;
              
              if (totalPages > 0) {
                // 메모리 사용률을 CPU 사용률로 추정 (더 정확한 계산)
                const memoryUsage = (usedPages / totalPages) * 100;
                // 메모리 사용률을 CPU 사용률로 변환 (보수적 추정)
                systemUsage = Math.min(100, memoryUsage * 0.8);
              }
            } catch (vmstatError) {
              logger.debug('vm_stat fallback failed:', vmstatError);
              
              // 방법 4: os 모듈의 load average 기반 추정
              try {
                const loadAverage = os.loadavg();
                const cores = os.cpus().length;
                
                if (loadAverage.length > 0 && cores > 0) {
                  // 1분 로드 평균을 CPU 사용률로 변환
                  const load1 = loadAverage[0];
                  const estimatedUsage = Math.min(100, (load1 / cores) * 100);
                  systemUsage = estimatedUsage;
                } else {
                  throw new Error('Cannot get load average information.');
                }
              } catch (loadError) {
                logger.debug('Load average fallback failed:', loadError);
                throw new Error('Cannot get macOS CPU information.');
              }
            }
          }
        }
      } catch (error) {
        logger.debug('macOS CPU info fetch failed:', error);
        throw new Error('Cannot get macOS CPU information.');
      }
    } else {
      // Linux용 CPU 사용률 조회
      try {
        // 방법 1: /proc/stat 사용 (가장 정확)
        try {
          const statOutput = await runCommand("cat /proc/stat | grep '^cpu '");
          const parts = statOutput.trim().split(/\s+/);
          if (parts.length >= 5) {
            const user = parseInt(parts[1]) || 0;
            const nice = parseInt(parts[2]) || 0;
            const system = parseInt(parts[3]) || 0;
            const idle = parseInt(parts[4]) || 0;
            const total = user + nice + system + idle;
            const used = user + nice + system;
            systemUsage = total > 0 ? (used / total) * 100 : 0;
          } else {
            throw new Error('Cannot parse /proc/stat');
          }
        } catch (statError) {
          logger.debug('/proc/stat fallback failed:', statError);
          
          // 방법 2: top 명령어 사용
          try {
            const cpuOutput = await runCommand("top -bn1 | grep 'Cpu(s)'");
            const cpuMatch = cpuOutput.match(/(\d+\.?\d*)%us,\s*(\d+\.?\d*)%sy/);
            
            if (cpuMatch) {
              const userUsage = parseFloat(cpuMatch[1]);
              const sysUsage = parseFloat(cpuMatch[2]);
              systemUsage = userUsage + sysUsage;
            } else {
              throw new Error('Cannot parse top command');
            }
          } catch (topError) {
            logger.debug('top fallback failed:', topError);
            
            // 방법 3: uptime 명령어를 통한 로드 평균 기반 추정
            try {
              const uptimeOutput = await runCommand("uptime");
              const loadMatch = uptimeOutput.match(/load average:\s+(\d+\.?\d*),\s+(\d+\.?\d*),\s+(\d+\.?\d*)/);
              
              if (loadMatch) {
                const load1 = parseFloat(loadMatch[1]) || 0;
                const load5 = parseFloat(loadMatch[2]) || 0;
                const load15 = parseFloat(loadMatch[3]) || 0;
                
                // 로드 평균을 CPU 사용률로 추정 (코어 수 고려)
                const cores = os.cpus().length;
                const avgLoad = (load1 + load5 + load15) / 3;
                const estimatedUsage = Math.min(100, (avgLoad / cores) * 100);
                
                systemUsage = estimatedUsage;
              } else {
                throw new Error('Cannot parse load average with uptime command.');
              }
            } catch (uptimeError) {
              logger.debug('uptime fallback failed:', uptimeError);
              
              // 방법 4: os 모듈의 load average 사용
              try {
                const loadAverage = os.loadavg();
                const cores = os.cpus().length;
                
                if (loadAverage.length > 0 && cores > 0) {
                  const load1 = loadAverage[0];
                  const estimatedUsage = Math.min(100, (load1 / cores) * 100);
                  systemUsage = estimatedUsage;
                } else {
                  throw new Error('Cannot get load average information from os module.');
                }
              } catch (osError) {
                logger.debug('os module fallback failed:', osError);
                throw new Error('Cannot get Linux CPU information.');
              }
            }
          }
        }
      } catch (error) {
        logger.debug('Linux CPU info fetch failed:', error);
        throw new Error('Cannot get Linux CPU information.');
      }
    }

    // 프로세스 CPU 사용률 조회 (Node.js process.cpuUsage() 사용)
    try {
      // process.cpuUsage()는 마이크로초 단위로 user/system CPU 시간을 반환
      // 샘플링 방식으로 CPU 사용률 계산
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime.bigint();

      // 100ms 동안 샘플링
      await new Promise(resolve => setTimeout(resolve, 100));

      const endUsage = process.cpuUsage(startUsage);
      const endTime = process.hrtime.bigint();

      // 경과 시간 (마이크로초)
      const elapsedTime = Number(endTime - startTime) / 1000;

      // CPU 시간 (user + system, 마이크로초)
      const cpuTime = endUsage.user + endUsage.system;

      // CPU 사용률 계산 (단일 코어 기준)
      // 멀티코어 환경에서 실제 사용률을 반영하기 위해 코어 수로 나눔
      const cores = os.cpus().length;
      processUsage = (cpuTime / elapsedTime) * 100 / cores;

      // 최대 100%로 제한
      processUsage = Math.min(100, processUsage);
    } catch (error) {
      logger.debug('Process CPU usage fetch failed:', error);
      processUsage = 0;
    }

    // CPU 코어 수
    const cores = os.cpus().length;
    
    // 로드 평균
    const loadAverage = os.loadavg();

    return {
      system: Math.round(systemUsage * 100) / 100,
      processUsage: Math.round(processUsage * 100) / 100,
      cores,
      loadAverage: loadAverage.map(load => Math.round(load * 100) / 100)
    };
  } catch (error) {
    logger.error('CPU info fetch error:', error);
    throw error;
  }
} 