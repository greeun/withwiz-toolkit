/**
 * 로깅 시스템 타입 정의
 */

import type { AppError } from '@withwiz/error/app-error';

/**
 * 로그 레벨
 */
export enum ELogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * 에러 로그 컨텍스트
 */
export interface IErrorLogContext {
  // 요청 정보
  requestId?: string;
  method?: string;
  path?: string;
  userAgent?: string;
  ip?: string;

  // 사용자 정보
  userId?: string;
  userEmail?: string;
  userRole?: string;

  // 에러 정보
  errorCode?: number;
  errorMessage?: string;
  errorStack?: string;

  // 환경 정보
  environment?: string;
  version?: string;
  timestamp?: string;

  // 추가 메타데이터
  metadata?: Record<string, unknown>;
}

/**
 * 로그 엔트리
 */
export interface ILogEntry {
  level: ELogLevel;
  message: string;
  context: IErrorLogContext;
  error?: AppError | Error;
  timestamp: Date;
}

/**
 * Transport 인터페이스
 */
export interface ITransport {
  /**
   * Transport 이름
   */
  name: string;

  /**
   * 로그 전송
   */
  log(entry: ILogEntry): Promise<void>;

  /**
   * Transport 활성화 여부
   */
  isEnabled(): boolean;
}

/**
 * ErrorLogger 옵션
 */
export interface IErrorLoggerOptions {
  /**
   * 최소 로그 레벨
   * 이 레벨 이상의 로그만 기록
   */
  minLevel?: ELogLevel;

  /**
   * 환경 정보
   */
  environment?: string;

  /**
   * 앱 버전
   */
  version?: string;

  /**
   * Transport 목록
   */
  transports?: ITransport[];
}
