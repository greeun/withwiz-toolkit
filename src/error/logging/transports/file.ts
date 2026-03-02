/**
 * File Transport
 *
 * 파일에 로그 기록 (서버 전용)
 */

import { BaseTransport } from './base';
import type { ILogEntry } from '@withwiz/error/logging/types';

/**
 * FileTransport 옵션
 */
export interface IFileTransportOptions {
  enabled?: boolean;
  filePath?: string;
  maxSize?: number; // bytes
  maxFiles?: number; // rotation
}

/**
 * FileTransport 클래스
 *
 * @example
 * ```typescript
 * const transport = new FileTransport({
 *   filePath: './logs/error.log',
 *   maxSize: 10 * 1024 * 1024, // 10MB
 *   maxFiles: 5,
 * });
 * ```
 */
export class FileTransport extends BaseTransport {
  private filePath: string;
  private maxSize: number;
  private maxFiles: number;
  private fs: typeof import('fs') | null = null;
  private path: typeof import('path') | null = null;

  constructor(options: IFileTransportOptions = {}) {
    // 브라우저 환경에서는 비활성화
    const isServer = typeof window === 'undefined';
    super('file', isServer && options.enabled !== false);

    this.filePath = options.filePath || './logs/error.log';
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;

    // 서버 환경에서만 fs, path 모듈 로드
    if (isServer) {
      this.loadModules();
    }
  }

  /**
   * 모듈 로드 (동적 import)
   */
  private async loadModules(): Promise<void> {
    try {
      this.fs = await import('fs');
      this.path = await import('path');
    } catch (error) {
      console.error('[FileTransport] Failed to load fs/path modules:', error);
      this.disable();
    }
  }

  async log(entry: ILogEntry): Promise<void> {
    if (!this.fs || !this.path) {
      return;
    }

    try {
      // 로그 디렉토리 생성
      const dir = this.path.dirname(this.filePath);
      if (!this.fs.existsSync(dir)) {
        this.fs.mkdirSync(dir, { recursive: true });
      }

      // 로그 포맷팅
      const logLine = this.format(entry);

      // 파일 크기 체크 및 rotation
      await this.rotateIfNeeded();

      // 파일에 append
      this.fs.appendFileSync(this.filePath, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('[FileTransport] Failed to write log:', error);
    }
  }

  /**
   * 로그 포맷팅 (JSON Lines)
   */
  private format(entry: ILogEntry): string {
    const logObject = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      context: entry.context,
      error: entry.error
        ? {
            message: entry.error.message,
            stack: entry.error.stack,
          }
        : undefined,
    };

    return JSON.stringify(logObject);
  }

  /**
   * 파일 rotation
   */
  private async rotateIfNeeded(): Promise<void> {
    if (!this.fs || !this.path) {
      return;
    }

    try {
      // 파일이 없으면 return
      if (!this.fs.existsSync(this.filePath)) {
        return;
      }

      // 파일 크기 체크
      const stats = this.fs.statSync(this.filePath);
      if (stats.size < this.maxSize) {
        return;
      }

      // Rotation 수행
      const ext = this.path.extname(this.filePath);
      const base = this.filePath.slice(0, -ext.length);

      // 기존 파일들 shift
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldPath = `${base}.${i}${ext}`;
        const newPath = `${base}.${i + 1}${ext}`;

        if (this.fs.existsSync(oldPath)) {
          if (i === this.maxFiles - 1) {
            // 마지막 파일 삭제
            this.fs.unlinkSync(oldPath);
          } else {
            // 파일 이동
            this.fs.renameSync(oldPath, newPath);
          }
        }
      }

      // 현재 파일을 .1로 이동
      this.fs.renameSync(this.filePath, `${base}.1${ext}`);
    } catch (error) {
      console.error('[FileTransport] Failed to rotate log file:', error);
    }
  }
}
