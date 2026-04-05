/**
 * logger
 *
 * logger
 * - Shared
 */
import fs from 'fs';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getLoggerConfig } from './config';
import { getCommonConfig } from '../config/common';

// 전역 플래그로 중복 설정 방지
declare global {
  // eslint-disable-next-line no-var
  var __maxListenersSet: boolean | undefined;
  // eslint-disable-next-line no-var
  var __winstonLoggerInstance: winston.Logger | undefined;
}

// 이벤트 리스너 제한 증가 (한 번만 설정)
// Edge Runtime 체크 - process가 있을 때만 실행
if (typeof process !== 'undefined' && process.setMaxListeners) {
  if (!(globalThis as any).__maxListenersSet) {
    process.setMaxListeners(20);
    (globalThis as any).__maxListenersSet = true;
  }
}

const { combine, timestamp, printf, colorize } = winston.format

function getLogConfig() {
  try {
    return getLoggerConfig();
  } catch {
    // logger가 initialize() 이전에 사용될 수 있으므로 폴백 반환
    return {
      level: 'info',
      dir: './logs',
      file: 'app.log',
      fileEnabled: true,
      consoleEnabled: true,
    };
  }
}

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
}

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
}
winston.addColors(colors)

// 테스트 환경 및 빌드 타임에는 파일 로깅을 비활성화
const isTestEnv = (() => {
  try { return getCommonConfig().nodeEnv === 'test'; } catch { return false; }
})() || process.env.VITEST !== undefined || process.env.JEST_WORKER_ID !== undefined;

// Next.js 빌드 타임 감지: 빌드 시 process.argv에 build 명령이 포함되거나, NEXT_PHASE 환경변수 확인
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                    process.argv.some(arg => arg.includes('build'));

// 로그 디렉토리 쓰기 가능 여부 확인
const canWriteToLogDir = (() => {
  if (isTestEnv || isBuildTime) return false;
  try {
    const cfg = getLogConfig();
    const logDir = cfg.dir;
    // 디렉토리가 존재하고 쓰기 가능한지 확인
    if (fs.existsSync(logDir)) {
      fs.accessSync(logDir, fs.constants.W_OK);
      return true;
    }
    // 디렉토리가 없으면 생성 시도
    fs.mkdirSync(logDir, { recursive: true });
    return true;
  } catch {
    return false;
  }
})();
const fileLoggingEnabled = !isTestEnv && !isBuildTime && canWriteToLogDir && getLogConfig().fileEnabled;
const consoleLoggingEnabled = getLogConfig().consoleEnabled;
const datePatternString = 'YYYY-MM-DD';
const logLevel = getLogConfig().level;

const transports: winston.transport[] = [];

// Log Format
const logFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  printf((info) => {
    if (info.stack) {
      return `${info.level}: ${info.timestamp} ${info.message} \n Error Stack: ${info.stack}`
    }

    // winston 표준 속성들을 제외한 나머지를 메타데이터로 처리
    const winstonStandardKeys = ['level', 'message', 'timestamp', 'stack', 'splat', 'symbol'];
    const metaKeys = Object.keys(info).filter(key => !winstonStandardKeys.includes(key));

    // info 레벨 확인 (색상 코드 제거)
    const rawLevel = info.level.replace(/\u001b\[\d+m/g, '');
    const isInfoLevel = rawLevel === 'info';

    if (metaKeys.length > 0) {
      const meta: Record<string, any> = {};
      metaKeys.forEach(key => {
        meta[key] = info[key];
      });
      // info 레벨은 1줄로, 나머지는 상세 출력
      const metaStr = isInfoLevel ? JSON.stringify(meta) : JSON.stringify(meta, null, 2);
      return `${info.level}: ${info.timestamp} ${info.message} ${metaStr}`
    }

    // info.meta가 직접 있는 경우 (레거시 지원)
    if (info.meta && typeof info.meta === 'object') {
      const metaStr = isInfoLevel ? JSON.stringify(info.meta) : JSON.stringify(info.meta, null, 2);
      return `${info.level}: ${info.timestamp} ${info.message} ${metaStr}`
    }

    return `${info.level}: ${info.timestamp} ${info.message}`
  })
)

// 콘솔에 찍힐 때는 색깔을 구변해서 로깅해주자.
const consoleOpts = {
  handleExceptions: true,
  // level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  format: combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' })
  )
}

if (consoleLoggingEnabled) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.printf((info) => {
          if (info.stack) {
            return `${info.level}: ${info.timestamp} ${info.message} \n Error Stack: ${info.stack}`
          }

          // winston 표준 속성들을 제외한 나머지를 메타데이터로 처리
          const winstonStandardKeys = ['level', 'message', 'timestamp', 'stack', 'splat', 'symbol'];
          const metaKeys = Object.keys(info).filter(key => !winstonStandardKeys.includes(key));

          // info 레벨 확인 (색상 코드 제거)
          const rawLevel = info.level.replace(/\u001b\[\d+m/g, '');
          const isInfoLevel = rawLevel === 'info';

          if (metaKeys.length > 0) {
            const meta: Record<string, any> = {};
            metaKeys.forEach(key => {
              meta[key] = info[key];
            });
            // info 레벨은 1줄로, 나머지는 상세 출력
            const metaStr = isInfoLevel ? JSON.stringify(meta) : JSON.stringify(meta, null, 2);
            return `${info.level}: ${info.timestamp} ${info.message} ${metaStr}`
          }

          // info.meta가 직접 있는 경우 (레거시 지원)
          if (info.meta && typeof info.meta === 'object') {
            const metaStr = isInfoLevel ? JSON.stringify(info.meta) : JSON.stringify(info.meta, null, 2);
            return `${info.level}: ${info.timestamp} ${info.message} ${metaStr}`
          }

          return `${info.level}: ${info.timestamp} ${info.message}`
        })
      ),
      level: logLevel,
      handleExceptions: true,
    })
  );
}

if (fileLoggingEnabled) {
  const cfg = getLogConfig();
  transports.push(
    new DailyRotateFile({
      filename: `${cfg.dir}/${cfg.file.replace(/\.log$/, '')}-%DATE%.log`,
      zippedArchive: true,
      maxFiles: '14d', // Keep for 14 days
      datePattern: datePatternString,
      level: logLevel,
      handleExceptions: true,
      json: false,
      dirname: cfg.dir,
    })
  );
}

// Turbopack/HMR 환경에서 모듈 재평가 시 중복 인스턴스 방지
// global 싱글톤으로 Console transport 중복 등록 문제 해결
export const logger: winston.Logger = globalThis.__winstonLoggerInstance ?? (() => {
  const instance = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      logFormat
    ),
    transports,
    exitOnError: false,
  });
  globalThis.__winstonLoggerInstance = instance;
  return instance;
})();

export function logDebug(message: string, meta?: any) {
  logger.debug(message, meta);
}

export function logInfo(message: string, meta?: any) {
  logger.info(message, meta);
}

export function logError(message: string, meta?: any) {
  logger.error(message, meta);
}

// 공통 유틸리티 함수들을 상단으로 이동
const MASK_KEYS = ['password', 'token', 'secret', 'accessToken', 'refreshToken'] as const;
const MAX_BODY_LENGTH = 1024;

// 민감 정보 마스킹 함수
function maskSensitiveData(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const masked = { ...obj };
  for (const key of MASK_KEYS) {
    if (key in masked) {
      masked[key] = '[MASKED]';
    }
  }
  return masked;
}

// body 길이 제한 함수
function truncateBody(body: any): any {
  if (typeof body === 'string') {
    return body.length > MAX_BODY_LENGTH 
      ? body.slice(0, MAX_BODY_LENGTH) + '... [TRUNCATED]'
      : body;
  }
  
  if (typeof body === 'object') {
    const str = JSON.stringify(body);
    return str.length > MAX_BODY_LENGTH
      ? str.slice(0, MAX_BODY_LENGTH) + '... [TRUNCATED]'
      : body;
  }
  
  return body;
}

// 안전한 body 추출 함수 (최적화됨)
async function getSafeBody(req: Request | Response): Promise<any> {
  try {
    const cloned = req.clone();
    const contentType = cloned.headers.get('content-type') || '';
    
    let body: any = null;
    
    // content-type에 따른 body 처리 최적화
    if (contentType.includes('application/json')) {
      body = await cloned.json();
    } else if (contentType.includes('text/')) {
      body = await cloned.text();
    } else {
      return '[non-text body]';
    }
    
    // 민감 정보 마스킹 및 길이 제한
    if (typeof body === 'object' && body !== null) {
      body = maskSensitiveData(body);
    }
    
    return truncateBody(body);
  } catch (e) {
    return '[unreadable body]';
  }
}

export function logApiRequest(request: Request, extra?: Record<string, any>) {
  // 기본 로그 정보만 즉시 생성 (body 없이)
  const baseLog = {
    method: request.method,
    url: request.url,
    ...extra,
  };
  
  // body가 있는 경우에만 비동기 처리
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('text/')) {
    // 비동기로 body 처리하되, 에러가 발생해도 기본 로그는 출력
    getSafeBody(request)
      .then(body => {
        const fullLog = { ...baseLog, body };
        logDebug('[API Req] ' + JSON.stringify(fullLog, null, 2));
      })
      .catch(() => {
        // body 처리 실패 시에도 기본 로그는 출력
        logDebug('[API Req] ' + JSON.stringify(baseLog, null, 2));
      });
  } else {
    // body가 없는 경우 즉시 로그 출력
    logDebug('[API Req] ' + JSON.stringify(baseLog, null, 2));
  }
}

export function logApiResponse(request: Request, response: Response, extra?: Record<string, any>) {
  // 기본 로그 정보만 즉시 생성
  const baseLog = {
    method: request.method,
    url: request.url,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    ...extra,
  };
  
  // body가 있는 경우에만 비동기 처리
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('text/')) {
    getSafeBody(response)
      .then(body => {
        const fullLog = { ...baseLog, body };
        logDebug('[API Res] ' + JSON.stringify(fullLog, null, 2));
      })
      .catch(() => {
        logDebug('[API Res] ' + JSON.stringify(baseLog, null, 2));
      });
  } else {
    logDebug('[API Res] ' + JSON.stringify(baseLog, null, 2));
  }
} 