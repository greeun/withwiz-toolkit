/**
 * Slack Transport
 *
 * Slack Webhook으로 알림 전송
 */

import { BaseTransport } from './base';
import type { ILogEntry, ELogLevel } from '@withwiz/error/logging/types';
import { ELogLevel as LogLevel } from '@withwiz/error/logging/types';

/**
 * SlackTransport 옵션
 */
export interface ISlackTransportOptions {
  enabled?: boolean;
  webhookUrl?: string;
  minLevel?: ELogLevel;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

/**
 * 로그 레벨별 색상
 */
const LEVEL_COLORS: Record<ELogLevel, string> = {
  [LogLevel.DEBUG]: '#36a64f', // Green
  [LogLevel.INFO]: '#2196F3', // Blue
  [LogLevel.WARN]: '#FFC107', // Amber
  [LogLevel.ERROR]: '#F44336', // Red
  [LogLevel.CRITICAL]: '#9C27B0', // Purple
};

/**
 * SlackTransport 클래스
 *
 * @example
 * ```typescript
 * const transport = new SlackTransport({
 *   webhookUrl: process.env.SLACK_WEBHOOK_URL,
 *   minLevel: ELogLevel.CRITICAL,
 *   channel: '#errors',
 * });
 * ```
 */
export class SlackTransport extends BaseTransport {
  private webhookUrl: string | undefined;
  private minLevel: ELogLevel;
  private channel?: string;
  private username: string;
  private iconEmoji: string;

  constructor(options: ISlackTransportOptions = {}) {
    const webhookUrl = options.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    super('slack', Boolean(webhookUrl) && options.enabled !== false);

    this.webhookUrl = webhookUrl;
    this.minLevel = options.minLevel || LogLevel.CRITICAL;
    this.channel = options.channel;
    this.username = options.username || 'Error Logger';
    this.iconEmoji = options.iconEmoji || ':rotating_light:';
  }

  async log(entry: ILogEntry): Promise<void> {
    // Webhook URL이 없으면 return
    if (!this.webhookUrl) {
      return;
    }

    // 최소 레벨 체크
    if (!this.shouldLog(entry.level)) {
      return;
    }

    try {
      // Slack 메시지 생성
      const payload = this.buildPayload(entry);

      // Webhook 전송
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[SlackTransport] Failed to send to Slack:', error);
    }
  }

  /**
   * Slack 메시지 페이로드 생성
   */
  private buildPayload(entry: ILogEntry): any {
    const payload: any = {
      username: this.username,
      icon_emoji: this.iconEmoji,
    };

    if (this.channel) {
      payload.channel = this.channel;
    }

    // Attachment 생성
    const attachment: any = {
      color: LEVEL_COLORS[entry.level],
      title: `${entry.level.toUpperCase()}: ${entry.message}`,
      timestamp: Math.floor(entry.timestamp.getTime() / 1000),
      fields: [],
    };

    // 컨텍스트 필드 추가
    if (entry.context.requestId) {
      attachment.fields.push({
        title: 'Request ID',
        value: entry.context.requestId,
        short: true,
      });
    }

    if (entry.context.errorCode) {
      attachment.fields.push({
        title: 'Error Code',
        value: entry.context.errorCode,
        short: true,
      });
    }

    if (entry.context.userId) {
      attachment.fields.push({
        title: 'User ID',
        value: entry.context.userId,
        short: true,
      });
    }

    if (entry.context.environment) {
      attachment.fields.push({
        title: 'Environment',
        value: entry.context.environment,
        short: true,
      });
    }

    if (entry.context.path) {
      attachment.fields.push({
        title: 'Path',
        value: entry.context.path,
        short: false,
      });
    }

    // 에러 스택 추가 (접힌 형태로)
    if (entry.error && entry.error.stack) {
      attachment.fields.push({
        title: 'Stack Trace',
        value: `\`\`\`${this.truncate(entry.error.stack, 1000)}\`\`\``,
        short: false,
      });
    }

    payload.attachments = [attachment];

    return payload;
  }

  /**
   * 문자열 자르기
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength) + '...';
  }

  /**
   * 로그 레벨 체크
   */
  private shouldLog(level: ELogLevel): boolean {
    const LOG_LEVEL_PRIORITY: Record<ELogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.CRITICAL]: 4,
    };

    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }
}
