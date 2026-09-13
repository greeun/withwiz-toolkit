/**
 * Prisma 오류 분류 테스트
 *
 * 회귀 방지 대상 (호스트 프로젝트 QA 실측 결함):
 * 1. Prisma 7 오류 메시지에 난독화된 번들 소스가 통째로 포함되어
 *    `/P\d{4}/` 메시지 매칭이 흔들리는 문제 → `error.code` 우선 판정
 * 2. `PrismaClientValidationError`(code 없음)가 메시지의 'unauthorized' 에 걸려
 *    401 로 오분류되는 문제 → 400 입력 검증 오류
 * 3. 난독화된 번들 소스가 로그에 통째로 기록되는 문제 → 길이 제한
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
}));

vi.mock('next/server', () => {
  const json = vi.fn((body: any, init?: any) => ({
    status: init?.status || 200,
    json: async () => body,
    headers: new Map(),
    clone: () => ({
      status: init?.status || 200,
      json: async () => structuredClone(body),
      headers: new Map(),
    }),
  }));
  return { NextResponse: { json }, NextRequest: vi.fn() };
});

import {
  ERROR_CODES,
  classifyError,
  classifyPrismaError,
} from '@withwiz/toolkit/core/constants/error-codes';
import {
  inspectPrismaError,
  getPrismaErrorCode,
  isPrismaValidationError,
  getPrismaErrorMapping,
  PRISMA_MESSAGE_SCAN_LIMIT,
  PRISMA_ERROR_MAP,
} from '@withwiz/toolkit/core/error/prisma-error';
import {
  truncateErrorMessage,
  summarizeErrorForLog,
  ERROR_LOG_MESSAGE_MAX_LENGTH,
} from '@withwiz/toolkit/core/error/extract-error-info';
import { ErrorProcessor } from '@withwiz/toolkit/next/utils/error-processor';
import { processError } from '@withwiz/toolkit/next/error/error-handler';
import { logger } from '@withwiz/toolkit/core/logger/logger';

// ============================================================================
// Prisma 7 오류 재현용 더블
// ============================================================================

/** Prisma 7 이 메시지에 실어 보내는 난독화된 번들 소스 모사 */
function bundleSource(seed: string): string {
  // 'not found' / 'unauthorized' / 다른 P 코드가 본문에 우연히 섞인 상황을 재현
  return [
    `var e=function(t){return t};function n(a){if(!a)throw new Error("${seed}")}`,
    'var r="P2011";var o="unauthorized";var i="record not found";',
    'x'.repeat(4000),
  ].join('\n');
}

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  clientVersion = '7.0.0';
  meta?: Record<string, unknown>;

  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.meta = meta;
  }
}

class FakePrismaClientValidationError extends Error {
  clientVersion = '7.0.0';

  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientValidationError';
  }
}

class FakePrismaClientInitializationError extends Error {
  errorCode?: string;
  clientVersion = '7.0.0';

  constructor(message: string, errorCode?: string) {
    super(message);
    this.name = 'PrismaClientInitializationError';
    this.errorCode = errorCode;
  }
}

beforeEach(() => {
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.warn).mockClear();
});

// ============================================================================
// inspectPrismaError: 구조 기반 판정
// ============================================================================
describe('inspectPrismaError', () => {
  it('code 속성을 우선하여 P2002 를 추출한다', () => {
    const error = new FakePrismaClientKnownRequestError(bundleSource('dup'), 'P2002');
    const info = inspectPrismaError(error);

    expect(info).not.toBeNull();
    expect(info?.code).toBe('P2002');
    expect(info?.source).toBe('property');
    expect(info?.kind).toBe('known-request');
  });

  it('메시지에 다른 P 코드가 섞여 있어도 code 속성을 따른다', () => {
    // 메시지 본문에는 P2025 가 들어 있지만 실제 코드는 P2002
    const error = new FakePrismaClientKnownRequestError(
      `Invalid invocation. see P2025 in ${bundleSource('mix')}`,
      'P2002',
    );

    expect(getPrismaErrorCode(error)).toBe('P2002');
  });

  it('PrismaClientValidationError 는 code 없이 validation 으로 판정한다', () => {
    const error = new FakePrismaClientValidationError(bundleSource('validation'));
    const info = inspectPrismaError(error);

    expect(isPrismaValidationError(error)).toBe(true);
    expect(info?.kind).toBe('validation');
    expect(info?.code).toBeNull();
  });

  it('PrismaClientInitializationError 의 errorCode 도 인식한다', () => {
    const error = new FakePrismaClientInitializationError('Can not reach database server', 'P1001');
    const info = inspectPrismaError(error);

    expect(info?.code).toBe('P1001');
    expect(info?.kind).toBe('initialization');
  });

  it('메시지 폴백은 앞부분으로 제한된다', () => {
    const near = new Error('Prisma error P2002 occurred');
    expect(inspectPrismaError(near)?.code).toBe('P2002');
    expect(inspectPrismaError(near)?.source).toBe('message');

    const far = new Error(`${'x'.repeat(PRISMA_MESSAGE_SCAN_LIMIT + 50)}P2002`);
    expect(inspectPrismaError(far)).toBeNull();
  });

  it('Prisma 오류가 아니면 null 을 반환한다', () => {
    expect(inspectPrismaError(new Error('Something unexpected'))).toBeNull();
    expect(inspectPrismaError(null)).toBeNull();
    expect(inspectPrismaError('P2002')).toBeNull();
  });

  it('공통 매핑표가 P2002 → 409 를 정의한다', () => {
    expect(getPrismaErrorMapping('P2002')).toEqual({
      code: 40905,
      message: expect.any(String),
      status: 409,
    });
    expect(getPrismaErrorMapping('P9999')).toBeUndefined();
    expect(PRISMA_ERROR_MAP.P2025.status).toBe(404);
  });
});

// ============================================================================
// classifyError / classifyPrismaError (core/constants/error-codes)
// ============================================================================
describe('classifyError: Prisma 오류', () => {
  it('code P2002 를 DUPLICATE_RESOURCE(409) 로 분류한다', () => {
    const error = new FakePrismaClientKnownRequestError(bundleSource('dup'), 'P2002');
    const result = classifyError(error);

    expect(result.code).toBe(ERROR_CODES.DUPLICATE_RESOURCE.code);
    expect(result.status).toBe(409);
  });

  it('PrismaClientValidationError 를 400 으로 분류한다 (401 아님)', () => {
    const error = new FakePrismaClientValidationError(
      `Invalid \`prisma.performance.findMany()\` invocation:\nInvalid value for argument \`category\`. Expected Category.\n${bundleSource('enum')}`,
    );
    const result = classifyError(error);

    expect(result.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
    expect(result.status).toBe(400);
    expect(result.status).not.toBe(401);
  });

  it('매핑되지 않은 Prisma 코드는 DATABASE_ERROR(500) 로 분류한다', () => {
    const error = new FakePrismaClientKnownRequestError('raw query failed', 'P2010');
    expect(classifyError(error).code).toBe(ERROR_CODES.DATABASE_ERROR.code);
  });

  it('classifyPrismaError 는 Prisma 오류가 아니면 null 을 반환한다', () => {
    expect(classifyPrismaError(new Error('Unauthorized access'))).toBeNull();
    expect(classifyError(new Error('Unauthorized access')).code).toBe(ERROR_CODES.UNAUTHORIZED.code);
  });
});

// ============================================================================
// ErrorProcessor.process (next/utils/error-processor)
// ============================================================================
describe('ErrorProcessor.process: Prisma 오류', () => {
  it('code P2002 → 409 (번들 소스가 메시지에 들어 있어도)', () => {
    const error = new FakePrismaClientKnownRequestError(bundleSource('dup'), 'P2002');
    const result = ErrorProcessor.process(error);

    expect(result.status).toBe(409);
    expect(result.code).toBe(40905);
    expect(result.details).toEqual({ prismaCode: 'P2002' });
  });

  it('메시지에 다른 P 코드가 섞여도 code 기준으로 분류한다', () => {
    const error = new FakePrismaClientKnownRequestError(
      `P2025 appears in the bundled source ${bundleSource('mix')}`,
      'P2002',
    );
    const result = ErrorProcessor.process(error);

    expect(result.status).toBe(409);
    expect(result.details).toEqual({ prismaCode: 'P2002' });
  });

  it('PrismaClientValidationError → 400 (401 아님)', () => {
    const error = new FakePrismaClientValidationError(
      `Invalid value for argument \`category\`. Expected Category.\n${bundleSource('enum')}`,
    );
    const result = ErrorProcessor.process(error);

    expect(result.status).toBe(400);
    expect(result.status).not.toBe(401);
    expect(result.key).toBe('VALIDATION_ERROR');
    expect(result.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
  });

  it('번들 소스 본문 깊숙한 P 코드에는 매칭되지 않는다', () => {
    const error = new Error(`${'x'.repeat(PRISMA_MESSAGE_SCAN_LIMIT + 100)}P2002`);
    const result = ErrorProcessor.process(error);

    expect(result.status).toBe(500);
    expect(result.key).toBe('SERVER_ERROR');
  });
});

// ============================================================================
// processError (next/error/error-handler)
// ============================================================================
describe('processError: Prisma 오류', () => {
  it('code P2002 → 409', () => {
    const error = new FakePrismaClientKnownRequestError(bundleSource('dup'), 'P2002');
    const result = processError(error);

    expect(result.status).toBe(409);
    expect(result.code).toBe(40905);
  });

  it('메시지에 다른 P 코드가 섞여도 code 기준으로 분류한다', () => {
    const error = new FakePrismaClientKnownRequestError(
      `P2025 record not found ${bundleSource('mix')}`,
      'P2002',
    );
    const result = processError(error);

    expect(result.status).toBe(409);
    expect(result.code).toBe(40905);
  });

  it('PrismaClientValidationError → 400 (401 아님)', () => {
    const error = new FakePrismaClientValidationError(
      `Invalid value for argument \`category\`. Expected Category.\n${bundleSource('enum')}`,
    );
    const result = processError(error);

    expect(result.status).toBe(400);
    expect(result.status).not.toBe(401);
    expect(result.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
  });

  it('매핑되지 않은 Prisma 코드 → DATABASE_ERROR(500)', () => {
    const error = new FakePrismaClientKnownRequestError('raw query failed', 'P9999');
    const result = processError(error);

    expect(result.status).toBe(500);
    expect(result.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
  });
});

// ============================================================================
// 로그 메시지 길이 제한
// ============================================================================
describe('로그 메시지 길이 제한', () => {
  it('truncateErrorMessage 는 긴 문자열을 잘라낸다', () => {
    const long = 'y'.repeat(ERROR_LOG_MESSAGE_MAX_LENGTH + 3000);
    const truncated = truncateErrorMessage(long);

    expect(truncated).toBeDefined();
    expect(truncated!.length).toBeLessThan(long.length);
    expect(truncated!.startsWith('y'.repeat(50))).toBe(true);
    expect(truncated).toContain('[truncated 3000 chars]');
  });

  it('짧은 문자열과 빈 값은 그대로 둔다', () => {
    expect(truncateErrorMessage('short')).toBe('short');
    expect(truncateErrorMessage(undefined)).toBeUndefined();
    expect(truncateErrorMessage(null)).toBeUndefined();
  });

  it('summarizeErrorForLog 는 메시지와 스택을 모두 제한한다', () => {
    const error = new FakePrismaClientKnownRequestError(bundleSource('log'), 'P2002');
    const summary = summarizeErrorForLog(error);

    expect(summary.name).toBe('PrismaClientKnownRequestError');
    expect(summary.code).toBe('P2002');
    expect(summary.message!.length).toBeLessThanOrEqual(ERROR_LOG_MESSAGE_MAX_LENGTH + 40);
    expect(summary.stack!.length).toBeLessThanOrEqual(ERROR_LOG_MESSAGE_MAX_LENGTH + 40);
  });

  it('매핑되지 않은 Prisma 오류 로그에 번들 소스가 통째로 기록되지 않는다', () => {
    const message = bundleSource('unmapped');
    const error = new FakePrismaClientKnownRequestError(message, 'P9999');

    ErrorProcessor.process(error);

    expect(logger.error).toHaveBeenCalledWith(
      'Unmapped Prisma error',
      expect.objectContaining({ prismaCode: 'P9999' }),
    );
    const logged = vi.mocked(logger.error).mock.calls[0][1] as { message: string };
    expect(message.length).toBeGreaterThan(ERROR_LOG_MESSAGE_MAX_LENGTH);
    expect(logged.message.length).toBeLessThanOrEqual(ERROR_LOG_MESSAGE_MAX_LENGTH + 40);
    expect(logged.message).toContain('[truncated');
  });

  it('Prisma 검증 오류 로그도 길이가 제한된다', () => {
    const error = new FakePrismaClientValidationError(bundleSource('validation-log'));

    ErrorProcessor.process(error);

    const logged = vi.mocked(logger.warn).mock.calls[0][1] as { message: string };
    expect(logged.message.length).toBeLessThanOrEqual(ERROR_LOG_MESSAGE_MAX_LENGTH + 40);
  });

  it('ErrorProcessor.toResponse 는 원본 오류를 요약하여 기록한다', () => {
    const error = new Error('y'.repeat(ERROR_LOG_MESSAGE_MAX_LENGTH + 2000));
    ErrorProcessor.toResponse(error, '/api/test');

    const logged = vi.mocked(logger.error).mock.calls[0][1] as {
      originalError: { message: string; stack: string };
    };
    expect(logged.originalError.message.length).toBeLessThanOrEqual(ERROR_LOG_MESSAGE_MAX_LENGTH + 40);
    expect(logged.originalError.stack.length).toBeLessThanOrEqual(ERROR_LOG_MESSAGE_MAX_LENGTH + 40);
  });
});
