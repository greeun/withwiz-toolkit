/**
 * Console Transport
 *
 * 콘솔에 로그 출력
 */

import { BaseTransport } from './base';
import type { ILogEntry, ELogLevel } from '@withwiz/error/logging/types';
import { ELogLevel as LogLevel } from '@withwiz/error/logging/types';

/**
 * ConsoleTransport 옵션
 */
export interface IConsoleTransportOptions {
  enabled?: boolean;
  colorize?: boolean;
  includeTimestamp?: boolean;
}

/**
 * 로그 레벨별 색상
 */
const COLORS = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m', // Green
  [LogLevel.WARN]: '\x1b[33m', // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  [LogLevel.CRITICAL]: '\x1b[35m', // Magenta
  reset: '\x1b[0m',
};

/**
 * ConsoleTransport 클래스
 *
 * @example
 * ```typescript
 * const transport = new ConsoleTransport({
 *   colorize: true,
 *   includeTimestamp: true,
 * });
 * ```
 */
export class ConsoleTransport extends BaseTransport {
  private colorize: boolean;
  private includeTimestamp: boolean;

  constructor(options: IConsoleTransportOptions = {}) {
    super('console', options.enabled !== false);
    this.colorize = options.colorize !== false;
    this.includeTimestamp = options.includeTimestamp !== false;
  }

  async log(entry: ILogEntry): Promise<void> {
    const formatted = this.format(entry);
    this.output(entry.level, formatted);
  }

  /**
   * 로그 포맷팅
   */
  private format(entry: ILogEntry): string {
    const parts: string[] = [];

    // 타임스탬프
    if (this.includeTimestamp) {
      parts.push(`[${entry.timestamp.toISOString()}]`);
    }

    // 로그 레벨
    const levelText = this.colorize
      ? `${COLORS[entry.level]}${entry.level.toUpperCase()}${COLORS.reset}`
      : entry.level.toUpperCase();
    parts.push(`[${levelText}]`);

    // 메시지
    parts.push(entry.message);

    // 컨텍스트
    if (Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context, null, 2));
    }

    // 에러 스택
    if (entry.error && entry.error.stack) {
      parts.push(`\nStack: ${entry.error.stack}`);
    }

    return parts.join(' ');
  }

  /**
   * 콘솔 출력
   */
  private output(level: ELogLevel, message: string): void {
    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message);
        break;
    }
  }
}
