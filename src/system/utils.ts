/**
 * utils
 *
 * utils
 * - System
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { logger } from '@withwiz/logger/logger';

const execAsync = promisify(exec);

// 플랫폼 감지 함수
export function getPlatform(): string {
  return os.platform();
}

// 시스템별 명령어 실행 함수 (Linux/Unix)
export async function runCommand(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command);
    return stdout;
  } catch (error) {
    logger.error(`Linux command execution failed: ${command}`, error);
    throw error;
  }
}

// macOS 전용 명령어 실행 함수
export async function runMacCommand(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command);
    return stdout;
  } catch (error) {
    logger.error(`macOS command execution failed: ${command}`, error);
    throw error;
  }
}

// 플랫폼별 명령어 실행 함수 (자동 감지)
export async function runPlatformCommand(command: string): Promise<string> {
  const platform = getPlatform();
  
  if (platform === 'darwin') {
    return runMacCommand(command);
  } else {
    return runCommand(command);
  }
}

// 바이트/초를 읽기 쉬운 형태로 변환하는 헬퍼 함수
export function formatBytesPerSec(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 단위 변환 헬퍼 함수
export function convertToBytes(value: number, unit: string): number {
  switch (unit) {
    case 'B': return value;
    case 'KiB': return value * 1024;
    case 'MiB': return value * 1024 * 1024;
    case 'GiB': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

// 명령어 실행 타임아웃 설정
export async function runCommandWithTimeout(command: string, timeoutMs: number = 10000): Promise<string> {
  try {
    const { stdout } = await Promise.race([
      execAsync(command),
      new Promise<{ stdout: string; stderr: string }>((_, reject) => 
        setTimeout(() => reject(new Error('Command timeout')), timeoutMs)
      )
    ]);
    return stdout;
  } catch (error) {
    logger.error(`Command execution failed with timeout: ${command}`, error);
    throw error;
  }
}

// 플랫폼별 안전한 명령어 실행 함수
export async function runSafeCommand(command: string, fallbackCommand?: string): Promise<string> {
  try {
    const platform = getPlatform();
    
    if (platform === 'darwin') {
      return await runMacCommand(command);
    } else {
      return await runCommand(command);
    }
  } catch (error) {
    if (fallbackCommand) {
      try {
        logger.debug(`Primary command failed, trying fallback: ${fallbackCommand}`);
        const fallbackPlatform = getPlatform();
        if (fallbackPlatform === 'darwin') {
          return await runMacCommand(fallbackCommand);
        } else {
          return await runCommand(fallbackCommand);
        }
      } catch (fallbackError) {
        logger.error(`Both primary and fallback commands failed:`, { primary: command, fallback: fallbackCommand, error: fallbackError });
        throw fallbackError;
      }
    }
    throw error;
  }
}

// 명령어 존재 여부 확인 함수
export async function commandExists(command: string): Promise<boolean> {
  try {
    const platform = getPlatform();
    let checkCommand: string;
    
    if (platform === 'darwin') {
      checkCommand = `which ${command}`;
    } else {
      checkCommand = `command -v ${command}`;
    }
    
    await execAsync(checkCommand);
    return true;
  } catch {
    return false;
  }
}

// 플랫폼별 권장 명령어 목록
export function getRecommendedCommands(): { [key: string]: string[] } {
  const currentPlatform = getPlatform();
  
  if (currentPlatform === 'darwin') {
    return {
      cpu: ['top', 'iostat', 'vm_stat'] as const,
      memory: ['vm_stat', 'top', 'system_profiler'] as const,
      disk: ['df', 'diskutil'] as const,
      network: ['nettop', 'ifconfig', 'netstat']
    };
  } else {
    return {
      cpu: ['cat /proc/stat', 'top', 'uptime'] as const,
      memory: ['cat /proc/meminfo', 'free', 'vmstat'] as const,
      disk: ['df', 'lsblk', 'cat /proc/mounts'] as const,
      network: ['cat /proc/net/dev', 'netstat', 'ss']
    };
  }
} 
