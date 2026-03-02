/**
 * memory
 *
 * memory
 * - System
 */
import os from 'os';
import { runCommand, runMacCommand } from './utils';
import { IMemoryInfo } from './types';
import { logger } from '@withwiz/logger/logger';

// bytes를 MB로 변환하는 헬퍼 함수
function bytesToMB(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

export async function getMemoryInfo(): Promise<IMemoryInfo> {
  try {
    const platform = os.platform();
    let total = 0;
    let free = 0;
    let used = 0;
    let percent = 0;
    let processUsed = 0;

    if (platform === 'darwin') {
      // macOS용 메모리 정보 조회
      try {
        // 방법 1: sysctl로 총 메모리 조회
        const memsizeOutput = await runMacCommand("sysctl -n hw.memsize");
        total = parseInt(memsizeOutput.trim()) || 0;
        
        if (total > 0) {
          // 방법 2: vm_stat으로 상세 메모리 상태 조회
          const vmstatOutput = await runMacCommand("vm_stat");
          const lines = vmstatOutput.split('\n');
          
          let freePages = 0;
          let activePages = 0;
          let inactivePages = 0;
          let wiredPages = 0;
          let compressedPages = 0;
          let speculativePages = 0;
          let purgeablePages = 0;
          
          for (const line of lines) {
            if (line.includes('Pages free:')) {
              const match = line.match(/Pages free:\s+(\d+)/);
              if (match) freePages = parseInt(match[1]) || 0;
            } else if (line.includes('Pages active:')) {
              const match = line.match(/Pages active:\s+(\d+)/);
              if (match) activePages = parseInt(match[1]) || 0;
            } else if (line.includes('Pages inactive:')) {
              const match = line.match(/Pages inactive:\s+(\d+)/);
              if (match) inactivePages = parseInt(match[1]) || 0;
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
            }
          }
          
          // macOS 페이지 크기 동적 감지 (기본값 16384 bytes)
          let pageSize = 16384;
          try {
            const pageSizeOutput = await runMacCommand("sysctl -n hw.pagesize");
            pageSize = parseInt(pageSizeOutput.trim()) || 16384;
          } catch {
            // 기본값 사용
          }
          const usedMemory = (activePages + wiredPages + compressedPages + speculativePages) * pageSize;
          const availableMemory = (freePages + inactivePages + purgeablePages) * pageSize;
          
          free = availableMemory;
          used = usedMemory;
          percent = total > 0 ? (used / total) * 100 : 0;
          
        } else {
          throw new Error('Cannot get memory size with sysctl.');
        }
        
      } catch (error) {
        logger.debug('macOS memory info fetch failed:', error);
        
        // 방법 3: top 명령어로 메모리 정보 조회
        try {
          const topOutput = await runMacCommand("top -l 1 -n 0 | grep 'PhysMem'");
          const memMatch = topOutput.match(/PhysMem:\s+(\d+)G used\s+\((\d+)M wired,\s+(\d+)M compressor\),\s+(\d+)M unused/);
          
          if (memMatch) {
            // GB 단위로 표시되는 경우
            const usedGB = parseInt(memMatch[1]) || 0;
            const wiredMB = parseInt(memMatch[2]) || 0;
            const compressorMB = parseInt(memMatch[3]) || 0;
            const unusedMB = parseInt(memMatch[4]) || 0;
            
            total = (usedGB * 1024 + unusedMB) * 1024 * 1024; // GB + MB to bytes
            used = usedGB * 1024 * 1024 * 1024; // GB to bytes
            free = unusedMB * 1024 * 1024; // MB to bytes
            percent = total > 0 ? (used / total) * 100 : 0;
            
          } else {
            // MB 단위로 표시되는 경우 (구형 macOS)
            const memMatchMB = topOutput.match(/PhysMem:\s+(\d+)M used,\s+(\d+)M wired,\s+(\d+)M unused/);
            if (memMatchMB) {
              const usedMB = parseInt(memMatchMB[1]) || 0;
              const wiredMB = parseInt(memMatchMB[2]) || 0;
              const unusedMB = parseInt(memMatchMB[3]) || 0;
              
              total = (usedMB + wiredMB + unusedMB) * 1024 * 1024; // MB to bytes
              used = (usedMB + wiredMB) * 1024 * 1024;
              free = unusedMB * 1024 * 1024;
              percent = total > 0 ? (used / total) * 100 : 0;
            } else {
              throw new Error('Cannot parse memory info with top command.');
            }
          }
        } catch (topError) {
          logger.debug('top fallback failed:', topError);
          
          // 방법 4: system_profiler 사용
          try {
            const profilerOutput = await runMacCommand("system_profiler SPHardwareDataType | grep 'Memory:'");
            const memMatch = profilerOutput.match(/Memory:\s+(\d+)\s+GB/);
            
            if (memMatch) {
              const totalGB = parseInt(memMatch[1]) || 0;
              total = totalGB * 1024 * 1024 * 1024; // GB to bytes
              
              // 사용 가능한 메모리를 20%로 추정 (보수적)
              free = total * 0.2;
              used = total * 0.8;
              percent = 80;
            } else {
              throw new Error('Cannot parse memory info with system_profiler.');
            }
          } catch (profilerError) {
            logger.debug('system_profiler fallback failed:', profilerError);
            
            // 마지막 fallback: os 모듈 사용
            try {
              const osTotal = os.totalmem();
              if (osTotal > 0) {
                total = osTotal;
                const osFree = os.freemem();
                free = osFree;
                used = total - free;
                percent = total > 0 ? (used / total) * 100 : 0;
              } else {
                throw new Error('Cannot get memory info with os module.');
              }
            } catch (osError) {
              logger.debug('os module fallback failed:', osError);
              throw new Error('All memory info retrieval methods failed.');
            }
          }
        }
      }
    } else {
      // Linux용 메모리 정보 조회
      try {
        const meminfoOutput = await runCommand("cat /proc/meminfo");
        const lines = meminfoOutput.split('\n');
        
        let memTotal = 0;
        let memAvailable = 0;
        let memFree = 0;
        let buffers = 0;
        let cached = 0;
        let slab = 0;
        
        for (const line of lines) {
          if (line.includes('MemTotal:')) {
            const match = line.match(/MemTotal:\s+(\d+)/);
            if (match) memTotal = parseInt(match[1]) * 1024; // KB to bytes
          } else if (line.includes('MemAvailable:')) {
            const match = line.match(/MemAvailable:\s+(\d+)/);
            if (match) memAvailable = parseInt(match[1]) * 1024; // KB to bytes
          } else if (line.includes('MemFree:')) {
            const match = line.match(/MemFree:\s+(\d+)/);
            if (match) memFree = parseInt(match[1]) * 1024; // KB to bytes
          } else if (line.includes('Buffers:')) {
            const match = line.match(/Buffers:\s+(\d+)/);
            if (match) buffers = parseInt(match[1]) * 1024; // KB to bytes
          } else if (line.includes('Cached:')) {
            const match = line.match(/Cached:\s+(\d+)/);
            if (match) cached = parseInt(match[1]) * 1024; // KB to bytes
          } else if (line.includes('Slab:')) {
            const match = line.match(/Slab:\s+(\d+)/);
            if (match) slab = parseInt(match[1]) * 1024; // KB to bytes
          }
        }
        
        total = memTotal;
        
        if (memAvailable > 0) {
          // MemAvailable이 있으면 사용 (더 정확함)
          free = memAvailable;
          used = total - free;
        } else {
          // MemAvailable이 없으면 계산
          const reclaimable = buffers + cached + slab;
          free = memFree + reclaimable;
          used = total - free;
        }
        
        percent = total > 0 ? (used / total) * 100 : 0;
        
      } catch (error) {
        logger.debug('Linux memory info fetch failed:', error);
        
        // 방법 2: free 명령어 사용
        try {
          const freeOutput = await runCommand("free -b | grep '^Mem:'");
          const parts = freeOutput.trim().split(/\s+/);
          if (parts.length >= 4) {
            total = parseInt(parts[1]) || 0;
            used = parseInt(parts[2]) || 0;
            free = parseInt(parts[3]) || 0;
            percent = total > 0 ? (used / total) * 100 : 0;
          } else {
            throw new Error('Cannot parse free command output.');
          }
        } catch (freeError) {
          logger.debug('free fallback failed:', freeError);
          
          // 방법 3: vmstat을 통한 메모리 정보 조회
          try {
            const vmstatOutput = await runCommand("vmstat -s | head -10");
            const lines = vmstatOutput.split('\n');
            let totalKB = 0;
            let freeKB = 0;
            
            for (const line of lines) {
              if (line.includes('total memory')) {
                const match = line.match(/(\d+)\s+total memory/);
                if (match) totalKB = parseInt(match[1]) || 0;
              } else if (line.includes('free memory')) {
                const match = line.match(/(\d+)\s+free memory/);
                if (match) freeKB = parseInt(match[1]) || 0;
              }
            }
            
            if (totalKB > 0) {
              total = totalKB * 1024; // KB to bytes
              free = freeKB * 1024;
              used = total - free;
              percent = total > 0 ? (used / total) * 100 : 0;
            } else {
              throw new Error('Cannot parse memory info with vmstat.');
            }
          } catch (vmstatError) {
            logger.debug('vmstat fallback failed:', vmstatError);
            
            // 마지막 fallback: os 모듈 사용
            try {
              const osTotal = os.totalmem();
              if (osTotal > 0) {
                total = osTotal;
                const osFree = os.freemem();
                free = osFree;
                used = total - free;
                percent = total > 0 ? (used / total) * 100 : 0;
              } else {
                throw new Error('Cannot get memory info with os module.');
              }
            } catch (osError) {
              logger.debug('os module fallback failed:', osError);
              throw new Error('All memory info retrieval methods failed.');
            }
          }
        }
      }
    }

    // 프로세스 메모리 사용량 조회 (Node.js process.memoryUsage() 사용)
    try {
      const memUsage = process.memoryUsage();
      // heapUsed: V8 힙에서 실제 사용 중인 메모리
      // rss (Resident Set Size): 프로세스가 사용하는 총 메모리
      processUsed = memUsage.rss; // RSS를 사용하여 전체 프로세스 메모리 표시
    } catch (error) {
      logger.debug('Process memory usage fetch failed:', error);
      processUsed = 0;
    }

    return {
      total: bytesToMB(total),
      free: bytesToMB(free),
      used: bytesToMB(used),
      percent: Math.round(percent * 100) / 100,
      processUsed: bytesToMB(processUsed)
    };
  } catch (error) {
    logger.error('Memory info fetch error:', error);
    throw error;
  }
} 