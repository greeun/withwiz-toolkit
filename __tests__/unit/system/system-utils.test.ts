/**
 * System Utils Tests
 *
 * src/system/utils.ts 유닛 테스트
 */

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn: any) => fn),
}));

vi.mock('os', () => ({
  default: { platform: vi.fn(() => 'darwin') },
  platform: vi.fn(() => 'darwin'),
}));

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { exec } from 'child_process';
import os from 'os';
import { logger } from '@withwiz/logger/logger';

const mockedExec = exec as unknown as ReturnType<typeof vi.fn>;
const mockedPlatform = os.platform as unknown as ReturnType<typeof vi.fn>;

describe('System Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPlatform.mockReturnValue('darwin');
  });

  describe('getPlatform', () => {
    it('should return the os.platform() value', async () => {
      mockedPlatform.mockReturnValue('linux');
      const { getPlatform } = await import('@withwiz/system/utils');
      // Since the module is already loaded, we need to call getPlatform which calls os.platform()
      const result = getPlatform();
      expect(result).toBe('linux');
    });

    it('should return darwin on macOS', async () => {
      mockedPlatform.mockReturnValue('darwin');
      const { getPlatform } = await import('@withwiz/system/utils');
      expect(getPlatform()).toBe('darwin');
    });
  });

  describe('runCommand', () => {
    it('should return stdout on successful command execution', async () => {
      mockedExec.mockResolvedValue({ stdout: 'hello world\n', stderr: '' });
      const { runCommand } = await import('@withwiz/system/utils');

      const result = await runCommand('echo hello world');
      expect(result).toBe('hello world\n');
    });

    it('should throw and log error on command failure', async () => {
      const error = new Error('command not found');
      mockedExec.mockRejectedValue(error);
      const { runCommand } = await import('@withwiz/system/utils');

      await expect(runCommand('invalid-cmd')).rejects.toThrow('command not found');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Linux command execution failed'),
        error
      );
    });
  });

  describe('runMacCommand', () => {
    it('should return stdout on successful command execution', async () => {
      mockedExec.mockResolvedValue({ stdout: 'mac output\n', stderr: '' });
      const { runMacCommand } = await import('@withwiz/system/utils');

      const result = await runMacCommand('sw_vers');
      expect(result).toBe('mac output\n');
    });

    it('should throw and log error on failure', async () => {
      const error = new Error('mac command failed');
      mockedExec.mockRejectedValue(error);
      const { runMacCommand } = await import('@withwiz/system/utils');

      await expect(runMacCommand('bad-cmd')).rejects.toThrow('mac command failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('macOS command execution failed'),
        error
      );
    });
  });

  describe('runPlatformCommand', () => {
    it('should use runMacCommand logic on darwin platform', async () => {
      mockedPlatform.mockReturnValue('darwin');
      mockedExec.mockResolvedValue({ stdout: 'darwin result', stderr: '' });
      const { runPlatformCommand } = await import('@withwiz/system/utils');

      const result = await runPlatformCommand('some-command');
      expect(result).toBe('darwin result');
    });

    it('should use runCommand logic on linux platform', async () => {
      mockedPlatform.mockReturnValue('linux');
      mockedExec.mockResolvedValue({ stdout: 'linux result', stderr: '' });
      const { runPlatformCommand } = await import('@withwiz/system/utils');

      const result = await runPlatformCommand('some-command');
      expect(result).toBe('linux result');
    });
  });

  describe('formatBytesPerSec', () => {
    it('should return "0 B/s" for 0', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      expect(formatBytesPerSec(0)).toBe('0 B/s');
    });

    it('should return "0 B/s" for negative values', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      expect(formatBytesPerSec(-100)).toBe('0 B/s');
    });

    it('should format 1024 as "1 KB/s"', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      expect(formatBytesPerSec(1024)).toBe('1 KB/s');
    });

    it('should format 1048576 as "1 MB/s"', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      expect(formatBytesPerSec(1048576)).toBe('1 MB/s');
    });

    it('should format 1073741824 as "1 GB/s"', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      expect(formatBytesPerSec(1073741824)).toBe('1 GB/s');
    });

    it('should format intermediate values correctly', async () => {
      const { formatBytesPerSec } = await import('@withwiz/system/utils');
      // 1.5 KB/s = 1536 bytes/sec
      expect(formatBytesPerSec(1536)).toBe('1.5 KB/s');
    });
  });

  describe('convertToBytes', () => {
    it('should convert B correctly', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(1, 'B')).toBe(1);
      expect(convertToBytes(100, 'B')).toBe(100);
    });

    it('should convert KiB correctly', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(1, 'KiB')).toBe(1024);
      expect(convertToBytes(2, 'KiB')).toBe(2048);
    });

    it('should convert MiB correctly', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(1, 'MiB')).toBe(1048576);
    });

    it('should convert GiB correctly', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(1, 'GiB')).toBe(1073741824);
    });

    it('should return value unchanged for unknown units', async () => {
      const { convertToBytes } = await import('@withwiz/system/utils');
      expect(convertToBytes(1, 'unknown')).toBe(1);
      expect(convertToBytes(42, 'TB')).toBe(42);
    });
  });

  describe('runCommandWithTimeout', () => {
    it('should return stdout on success within timeout', async () => {
      mockedExec.mockResolvedValue({ stdout: 'quick result', stderr: '' });
      const { runCommandWithTimeout } = await import('@withwiz/system/utils');

      const result = await runCommandWithTimeout('fast-cmd', 5000);
      expect(result).toBe('quick result');
    });

    it('should throw "Command timeout" when command exceeds timeout', async () => {
      // Mock exec to never resolve (simulate hanging command)
      mockedExec.mockImplementation(() => new Promise(() => {}));
      const { runCommandWithTimeout } = await import('@withwiz/system/utils');

      await expect(runCommandWithTimeout('slow-cmd', 10)).rejects.toThrow('Command timeout');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Command execution failed with timeout'),
        expect.any(Error)
      );
    });

    it('should use default timeout of 10000ms when not specified', async () => {
      mockedExec.mockResolvedValue({ stdout: 'default timeout result', stderr: '' });
      const { runCommandWithTimeout } = await import('@withwiz/system/utils');

      const result = await runCommandWithTimeout('cmd');
      expect(result).toBe('default timeout result');
    });
  });

  describe('runSafeCommand', () => {
    it('should return result when primary command succeeds', async () => {
      mockedPlatform.mockReturnValue('darwin');
      mockedExec.mockResolvedValue({ stdout: 'primary result', stderr: '' });
      const { runSafeCommand } = await import('@withwiz/system/utils');

      const result = await runSafeCommand('primary-cmd');
      expect(result).toBe('primary result');
    });

    it('should throw when primary fails and no fallback is provided', async () => {
      mockedPlatform.mockReturnValue('darwin');
      mockedExec.mockRejectedValue(new Error('primary failed'));
      const { runSafeCommand } = await import('@withwiz/system/utils');

      await expect(runSafeCommand('primary-cmd')).rejects.toThrow('primary failed');
    });

    it('should return fallback result when primary fails and fallback succeeds', async () => {
      mockedPlatform.mockReturnValue('darwin');
      let callCount = 0;
      mockedExec.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('primary failed'));
        }
        return Promise.resolve({ stdout: 'fallback result', stderr: '' });
      });
      const { runSafeCommand } = await import('@withwiz/system/utils');

      const result = await runSafeCommand('primary-cmd', 'fallback-cmd');
      expect(result).toBe('fallback result');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Primary command failed, trying fallback')
      );
    });

    it('should throw fallback error when both commands fail', async () => {
      mockedPlatform.mockReturnValue('linux');
      mockedExec.mockRejectedValue(new Error('all failed'));
      const { runSafeCommand } = await import('@withwiz/system/utils');

      await expect(runSafeCommand('primary-cmd', 'fallback-cmd')).rejects.toThrow('all failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Both primary and fallback commands failed'),
        expect.objectContaining({ primary: 'primary-cmd', fallback: 'fallback-cmd' })
      );
    });
  });

  describe('commandExists', () => {
    it('should return true when command is found (darwin)', async () => {
      mockedPlatform.mockReturnValue('darwin');
      mockedExec.mockResolvedValue({ stdout: '/usr/bin/node\n', stderr: '' });
      const { commandExists } = await import('@withwiz/system/utils');

      const result = await commandExists('node');
      expect(result).toBe(true);
    });

    it('should return false when command is not found', async () => {
      mockedPlatform.mockReturnValue('darwin');
      mockedExec.mockRejectedValue(new Error('not found'));
      const { commandExists } = await import('@withwiz/system/utils');

      const result = await commandExists('nonexistent-cmd');
      expect(result).toBe(false);
    });

    it('should use "which" on darwin platform', async () => {
      mockedPlatform.mockReturnValue('darwin');
      mockedExec.mockResolvedValue({ stdout: '/usr/bin/git', stderr: '' });
      const { commandExists } = await import('@withwiz/system/utils');

      await commandExists('git');
      expect(mockedExec).toHaveBeenCalledWith('which git');
    });

    it('should use "command -v" on linux platform', async () => {
      mockedPlatform.mockReturnValue('linux');
      mockedExec.mockResolvedValue({ stdout: '/usr/bin/git', stderr: '' });
      const { commandExists } = await import('@withwiz/system/utils');

      await commandExists('git');
      expect(mockedExec).toHaveBeenCalledWith('command -v git');
    });
  });

  describe('getRecommendedCommands', () => {
    it('should return mac-specific commands on darwin platform', async () => {
      mockedPlatform.mockReturnValue('darwin');
      const { getRecommendedCommands } = await import('@withwiz/system/utils');

      const commands = getRecommendedCommands();
      expect(commands.cpu).toContain('vm_stat');
      expect(commands.memory).toContain('system_profiler');
      expect(commands.disk).toContain('diskutil');
      expect(commands.network).toContain('nettop');
    });

    it('should return linux-specific commands on linux platform', async () => {
      mockedPlatform.mockReturnValue('linux');
      const { getRecommendedCommands } = await import('@withwiz/system/utils');

      const commands = getRecommendedCommands();
      expect(commands.cpu).toContain('cat /proc/stat');
      expect(commands.memory).toContain('cat /proc/meminfo');
      expect(commands.disk).toContain('lsblk');
      expect(commands.network).toContain('ss');
    });
  });
});
