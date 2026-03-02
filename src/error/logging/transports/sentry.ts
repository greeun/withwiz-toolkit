/**
 * Sentry Transport
 *
 * Sentry로 에러 전송
 */

import { BaseTransport } from './base';
import type { ILogEntry, ELogLevel } from '@withwiz/error/logging/types';
import { ELogLevel as LogLevel } from '@withwiz/error/logging/types';

/**
 * SentryTransport 옵션
 */
export interface ISentryTransportOptions {
  enabled?: boolean;
  dsn?: string;
  environment?: string;
  minLevel?: ELogLevel;
}

/**
 * Sentry Severity 매핑
 */
const SENTRY_SEVERITY_MAP: Record<ELogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warning',
  [LogLevel.ERROR]: 'error',
  [LogLevel.CRITICAL]: 'fatal',
};

/**
 * SentryTransport 클래스
 *
 * @example
 * ```typescript
 * const transport = new SentryTransport({
 *   dsn: process.env.SENTRY_DSN,
 *   environment: 'production',
 *   minLevel: ELogLevel.ERROR,
 * });
 * ```
 */
export class SentryTransport extends BaseTransport {
  private dsn: string | undefined;
  private environment: string;
  private minLevel: ELogLevel;
  private Sentry: any = null;

  constructor(options: ISentryTransportOptions = {}) {
    const dsn = options.dsn || process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    super('sentry', Boolean(dsn) && options.enabled !== false);

    this.dsn = dsn;
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.minLevel = options.minLevel || LogLevel.ERROR;

    if (this.isEnabled()) {
      this.initSentry();
    }
  }

  /**
   * Sentry 초기화
   */
  private async initSentry(): Promise<void> {
    try {
      // 서버/클라이언트 환경 구분
      const isServer = typeof window === 'undefined';

      if (isServer) {
        // Node.js 환경
        // @ts-expect-error - Optional dependency
        const Sentry = await import('@sentry/node');
        this.Sentry = Sentry;
      } else {
        // 브라우저 환경
        // @ts-expect-error - Optional dependency
        const Sentry = await import('@sentry/browser');
        this.Sentry = Sentry;
      }

      // Sentry 초기화
      this.Sentry.init({
        dsn: this.dsn,
        environment: this.environment,
        // 성능 모니터링 비활성화 (에러 로깅만)
        tracesSampleRate: 0,
      });
    } catch (error) {
      console.error('[SentryTransport] Failed to initialize Sentry:', error);
      this.disable();
    }
  }

  async log(entry: ILogEntry): Promise<void> {
    // Sentry가 초기화되지 않았으면 return
    if (!this.Sentry) {
      return;
    }

    // 최소 레벨 체크
    if (!this.shouldLog(entry.level)) {
      return;
    }

    try {
      // Sentry에 전송
      this.Sentry.withScope((scope: any) => {
        // Severity 설정
        scope.setLevel(SENTRY_SEVERITY_MAP[entry.level]);

        // 컨텍스트 설정
        if (entry.context.requestId) {
          scope.setTag('requestId', entry.context.requestId);
        }
        if (entry.context.userId) {
          scope.setUser({ id: entry.context.userId });
        }
        if (entry.context.errorCode) {
          scope.setTag('errorCode', entry.context.errorCode);
        }

        // 추가 컨텍스트
        scope.setContext('error_context', entry.context);

        // 에러 전송
        if (entry.error) {
          this.Sentry.captureException(entry.error);
        } else {
          this.Sentry.captureMessage(entry.message);
        }
      });
    } catch (error) {
      console.error('[SentryTransport] Failed to send to Sentry:', error);
    }
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
