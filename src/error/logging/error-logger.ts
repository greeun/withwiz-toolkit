/**
 * ErrorLogger 클래스
 *
 * 구조화된 에러 로깅
 */

import { AppError } from '@withwiz/error/app-error';
import type {
  IErrorLogContext,
  ILogEntry,
  ITransport,
  ELogLevel,
  IErrorLoggerOptions,
} from './types';
import { ELogLevel as LogLevel } from './types';

/**
 * 로그 레벨 우선순위
 */
const LOG_LEVEL_PRIORITY: Record<ELogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.CRITICAL]: 4,
};

/**
 * ErrorLogger 클래스
 *
 * @example
 * ```typescript
 * const logger = new ErrorLogger({
 *   minLevel: ELogLevel.INFO,
 *   environment: 'production',
 *   transports: [consoleTransport, sentryTransport],
 * });
 *
 * logger.error('API Error', {
 *   requestId: 'abc-123',
 *   errorCode: 50001,
 * });
 * ```
 */
export class ErrorLogger {
  private options: Required<IErrorLoggerOptions>;
  private transports: ITransport[];

  constructor(options: IErrorLoggerOptions = {}) {
    this.options = {
      minLevel: options.minLevel || LogLevel.INFO,
      environment: options.environment || process.env.NODE_ENV || 'development',
      version: options.version || process.env.APP_VERSION || '1.0.0',
      transports: options.transports || [],
    };

    this.transports = this.options.transports.filter((t) => t.isEnabled());
  }

  /**
   * Transport 추가
   */
  addTransport(transport: ITransport): void {
    if (transport.isEnabled()) {
      this.transports.push(transport);
    }
  }

  /**
   * Transport 제거
   */
  removeTransport(transportName: string): void {
    this.transports = this.transports.filter((t) => t.name !== transportName);
  }

  /**
   * Debug 로그
   */
  debug(message: string, context?: IErrorLogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info 로그
   */
  info(message: string, context?: IErrorLogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning 로그
   */
  warn(message: string, context?: IErrorLogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Error 로그
   */
  error(
    message: string,
    context?: IErrorLogContext,
    error?: AppError | Error
  ): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Critical 로그
   */
  critical(
    message: string,
    context?: IErrorLogContext,
    error?: AppError | Error
  ): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  /**
   * 로그 기록
   */
  private log(
    level: ELogLevel,
    message: string,
    context?: IErrorLogContext,
    error?: AppError | Error
  ): void {
    // 최소 레벨 체크
    if (!this.shouldLog(level)) {
      return;
    }

    // 로그 엔트리 생성
    const entry: ILogEntry = {
      level,
      message,
      context: this.enrichContext(context, error),
      error,
      timestamp: new Date(),
    };

    // 모든 Transport에 전송 (비동기)
    this.sendToTransports(entry);
  }

  /**
   * 로그 레벨 체크
   */
  private shouldLog(level: ELogLevel): boolean {
    return (
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.options.minLevel]
    );
  }

  /**
   * 컨텍스트 보강
   */
  private enrichContext(
    context?: IErrorLogContext,
    error?: AppError | Error
  ): IErrorLogContext {
    const enriched: IErrorLogContext = {
      ...context,
      environment: this.options.environment,
      version: this.options.version,
      timestamp: new Date().toISOString(),
    };

    // 에러 정보 추가
    if (error) {
      if (error instanceof AppError) {
        enriched.errorCode = error.code;
        enriched.errorMessage = error.message;
        enriched.errorStack = error.stack;
      } else if (error instanceof Error) {
        enriched.errorMessage = error.message;
        enriched.errorStack = error.stack;
      }
    }

    return enriched;
  }

  /**
   * Transport로 전송
   */
  private async sendToTransports(entry: ILogEntry): Promise<void> {
    const promises = this.transports.map((transport) =>
      transport.log(entry).catch((err) => {
        // Transport 에러는 무시 (로깅 실패로 앱이 중단되면 안됨)
        console.error(`[ErrorLogger] Transport ${transport.name} failed:`, err);
      })
    );

    // 모든 Transport가 완료될 때까지 기다리지 않음 (fire-and-forget)
    Promise.all(promises).catch(() => {
      // Ignore
    });
  }

  /**
   * AppError 로깅 헬퍼
   */
  logAppError(error: AppError, context?: IErrorLogContext): void {
    const httpStatus = Math.floor(error.code / 100);

    // HTTP 상태에 따라 로그 레벨 결정
    if (httpStatus >= 500) {
      this.error(error.message, { ...context, error } as any);
    } else if (httpStatus >= 400) {
      this.warn(error.message, { ...context, error } as any);
    } else {
      this.info(error.message, { ...context, error } as any);
    }
  }
}
