/**
 * disk
 *
 * disk
 * - System
 */
import { runCommand, runMacCommand } from './utils';
import { IDiskInfo } from './types';
import { logger } from '@withwiz/logger/logger';

export async function getDiskInfo(): Promise<IDiskInfo> {
  try {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      return await getMacDiskInfo();
    } else {
      return await getLinuxDiskInfo();
    }
  } catch (error) {
    logger.error('Disk info fetch error:', error);
    throw error;
  }
}

// 디스크 용량 문자열을 GB 단위로 정규화하는 헬퍼 함수
function normalizeToGB(sizeStr: string): string {
  // 예: "11Gi", "500Mi", "1.5Ti", "100G", "50M" 등을 처리
  const match = sizeStr.match(/^([\d.]+)\s*([KMGTP])?i?[Bb]?$/i);
  if (!match) return sizeStr;

  const value = parseFloat(match[1]);
  const unit = (match[2] || '').toUpperCase();

  let gbValue: number;
  switch (unit) {
    case 'K':
      gbValue = value / (1024 * 1024);
      break;
    case 'M':
      gbValue = value / 1024;
      break;
    case 'G':
      gbValue = value;
      break;
    case 'T':
      gbValue = value * 1024;
      break;
    case 'P':
      gbValue = value * 1024 * 1024;
      break;
    default:
      // 단위가 없으면 바이트로 가정
      gbValue = value / (1024 * 1024 * 1024);
  }

  // 소수점 1자리까지 표시
  if (gbValue >= 1000) {
    return `${(gbValue / 1024).toFixed(1)} TB`;
  }
  return `${gbValue.toFixed(1)} GB`;
}

async function getMacDiskInfo(): Promise<IDiskInfo> {
  try {
    // 방법 1: diskutil apfs list로 APFS 컨테이너 정보 조회 (가장 정확)
    // macOS APFS는 여러 볼륨이 컨테이너를 공유하므로 컨테이너 기준으로 조회해야 함
    try {
      const apfsOutput = await runMacCommand("diskutil apfs list 2>/dev/null");

      // 첫 번째 APFS 컨테이너의 정보 파싱
      const capacityCeilingMatch = apfsOutput.match(/Size \(Capacity Ceiling\):\s+([\d.]+)\s+B\s+\(([\d.]+)\s+GB\)/);
      const capacityInUseMatch = apfsOutput.match(/Capacity In Use By Volumes:\s+([\d.]+)\s+B\s+\(([\d.]+)\s+GB\)\s+\(([\d.]+)% used\)/);
      const capacityFreeMatch = apfsOutput.match(/Capacity Not Allocated:\s+([\d.]+)\s+B\s+\(([\d.]+)\s+GB\)/);

      if (capacityCeilingMatch && capacityInUseMatch && capacityFreeMatch) {
        const totalGB = parseFloat(capacityCeilingMatch[2]);
        const usedGB = parseFloat(capacityInUseMatch[2]);
        const availableGB = parseFloat(capacityFreeMatch[2]);
        const percent = parseFloat(capacityInUseMatch[3]);

        return {
          total: `${totalGB.toFixed(1)} GB`,
          used: `${usedGB.toFixed(1)} GB`,
          available: `${availableGB.toFixed(1)} GB`,
          percent: Math.round(percent)
        };
      }
    } catch (apfsError) {
      logger.debug('diskutil apfs list failed:', apfsError);
    }

    // 방법 2: df로 Data 볼륨 정보 조회 (APFS가 아닌 경우 또는 apfs list 실패 시)
    try {
      const dfOutput = await runMacCommand("df -h /System/Volumes/Data 2>/dev/null || df -h /");
      const lines = dfOutput.split('\n');

      for (const line of lines) {
        if (line.includes('/dev/')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 5) {
            const total = normalizeToGB(parts[1]);
            const used = normalizeToGB(parts[2]);
            const available = normalizeToGB(parts[3]);
            const percentStr = parts[4].replace('%', '');
            const percent = parseInt(percentStr) || 0;

            return { total, used, available, percent };
          }
        }
      }
    } catch (dfError) {
      logger.debug('df fallback failed:', dfError);
    }

    // 방법 3: diskutil info 사용
    try {
      const diskutilOutput = await runMacCommand("diskutil info / | grep -E 'Total Size|Container Total Space'");
      const totalMatch = diskutilOutput.match(/(\d+(?:\.\d+)?)\s+(B|KB|MB|GB|TB)/);

      if (totalMatch) {
        const size = parseFloat(totalMatch[1]);
        const unit = totalMatch[2];

        // 단위를 GB로 통일
        let totalGB = size;
        switch (unit) {
          case 'B': totalGB = size / (1024 * 1024 * 1024); break;
          case 'KB': totalGB = size / (1024 * 1024); break;
          case 'MB': totalGB = size / 1024; break;
          case 'GB': totalGB = size; break;
          case 'TB': totalGB = size * 1024; break;
        }

        // 사용률 추정 (기본값)
        const percent = 70;
        const usedGB = Math.round(totalGB * (percent / 100));
        const availableGB = Math.round(totalGB - usedGB);

        return {
          total: `${Math.round(totalGB)} GB`,
          used: `${usedGB} GB`,
          available: `${availableGB} GB`,
          percent
        };
      }
    } catch (diskutilError) {
      logger.debug('diskutil info fallback failed:', diskutilError);
    }

    throw new Error('Disk info parsing failed');
  } catch (error) {
    logger.debug('macOS disk info fetch failed:', error);
    throw error;
  }
}

async function getLinuxDiskInfo(): Promise<IDiskInfo> {
  try {
    // 방법 1: df 명령어로 루트 파티션 정보 조회
    const dfOutput = await runCommand("df -h /");
    const lines = dfOutput.split('\n');

    for (const line of lines) {
      if (line.includes('/dev/')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          const total = normalizeToGB(parts[1]);
          const used = normalizeToGB(parts[2]);
          const available = normalizeToGB(parts[3]);
          const percentStr = parts[4].replace('%', '');
          const percent = parseInt(percentStr) || 0;

          return { total, used, available, percent };
        }
      }
    }
    
    // 방법 2: /proc/mounts와 /proc/diskstats 사용
    try {
      const mountOutput = await runCommand("cat /proc/mounts | grep ' / '");
      const mountParts = mountOutput.trim().split(/\s+/);
      
      if (mountParts.length >= 2) {
        const device = mountParts[0];
        const deviceName = device.split('/').pop();
        
        if (deviceName) {
          const diskstatsOutput = await runCommand(`cat /proc/diskstats | grep '${deviceName}'`);
          const diskParts = diskstatsOutput.trim().split(/\s+/);
          
          if (diskParts.length >= 14) {
            // 블록 수를 바이트로 변환 (일반적으로 512바이트 블록)
            const totalBlocks = parseInt(diskParts[2]) || 0;
            const totalBytes = totalBlocks * 512;
            
            // 사용률 추정 (기본값)
            const percent = 60;
            const totalGB = Math.round(totalBytes / (1024 * 1024 * 1024));
            const usedGB = Math.round(totalGB * (percent / 100));
            const availableGB = Math.round(totalGB - usedGB);
            
            return {
              total: `${totalGB} GB`,
              used: `${usedGB} GB`,
              available: `${availableGB} GB`,
              percent
            };
          }
        }
      }
    } catch (procError) {
      logger.debug('/proc fallback failed:', procError);
    }
    
    throw new Error('Disk info parsing failed');
  } catch (error) {
    logger.debug('Linux disk info fetch failed:', error);
    
    // 방법 3: lsblk 명령어 사용
    try {
      // lsblk -b -o SIZE,MOUNTPOINT로 바이트 단위 출력 후 루트 파티션 찾기
      const lsblkOutput = await runCommand("lsblk -b -o SIZE,MOUNTPOINT 2>/dev/null | grep -E '\\s+/$' | head -1");
      const parts = lsblkOutput.trim().split(/\s+/);

      if (parts.length >= 1) {
        const sizeBytes = parseInt(parts[0]) || 0;
        const totalGB = Math.round(sizeBytes / (1024 * 1024 * 1024));

        if (totalGB > 0) {
          // 사용률 추정 (기본값)
          const percent = 60;
          const usedGB = Math.round(totalGB * (percent / 100));
          const availableGB = Math.round(totalGB - usedGB);

          return {
            total: `${totalGB} GB`,
            used: `${usedGB} GB`,
            available: `${availableGB} GB`,
            percent
          };
        }
      }
    } catch (lsblkError) {
      logger.debug('lsblk fallback failed:', lsblkError);
    }
    
    throw new Error('All disk info retrieval methods failed.');
  }
} 