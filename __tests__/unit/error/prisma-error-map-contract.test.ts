/**
 * Prisma 오류 매핑표 계약 테스트 (TC-U-027)
 *
 * `PRISMA_ERROR_MAP` 을 단일 기준표로 삼아, Prisma 오류를 응답으로 바꾸는
 * 세 경로가 같은 결과를 내는지 검증한다.
 *   - next/error/error-handler 의 processError()
 *   - next/utils/error-processor 의 ErrorProcessor.process()
 *   - next/utils/error-processor 의 handlePrismaError()
 *
 * 회귀 방지 대상: handlePrismaError() 가 매핑표 대신 P2002·P2025·P2003 만
 * 개별 분기하여 P2011 을 500, P2003 을 422 로 응답하던 결함.
 */
import { describe, it, expect, vi } from 'vitest';

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
  const json = vi.fn((body: unknown, init?: { status?: number }) => ({
    status: init?.status || 200,
    json: async () => body,
    headers: new Map(),
  }));
  return { NextResponse: { json }, NextRequest: vi.fn() };
});

import {
  PRISMA_ERROR_MAP,
  PRISMA_VALIDATION_MESSAGE,
} from '@withwiz/toolkit/core/error/prisma-error';
import { ERROR_CODES, getHttpStatus } from '@withwiz/toolkit/core/constants/error-codes';
import { ErrorProcessor, handlePrismaError } from '@withwiz/toolkit/next/utils/error-processor';
import { processError } from '@withwiz/toolkit/next/error/error-handler';

/** Prisma 7 PrismaClientKnownRequestError 를 이름과 code 속성으로 모사한다. */
class FakePrismaClientKnownRequestError extends Error {
  code: string;

  constructor(code: string, message = 'Invalid `prisma.x.create()` invocation') {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
  }
}

class FakePrismaClientValidationError extends Error {
  constructor(message = 'Argument `email` is missing. unauthorized') {
    super(message);
    this.name = 'PrismaClientValidationError';
  }
}

interface ResponseBody {
  success: boolean;
  error: { code: number; message: string; details?: unknown };
}

async function readHandlePrismaError(error: unknown) {
  const response = handlePrismaError(error);
  const body = (await response.json()) as ResponseBody;
  return { status: response.status, body };
}

const MAP_ENTRIES = Object.entries(PRISMA_ERROR_MAP);

describe('PRISMA_ERROR_MAP 자체 일관성', () => {
  it('14개 코드를 정의한다', () => {
    expect(MAP_ENTRIES).toHaveLength(14);
  });

  it.each(MAP_ENTRIES)('%s: 표준 코드에서 계산한 HTTP 상태가 status 와 같다', (_prismaCode, mapping) => {
    expect(getHttpStatus(mapping.code)).toBe(mapping.status);
  });
});

describe('processError()·ErrorProcessor.process() 의 매핑표 준수', () => {
  it('code P2011 을 processError() 가 40004·400 으로 변환한다', () => {
    const result = processError(new FakePrismaClientKnownRequestError('P2011'));

    expect(result.code).toBe(40004);
    expect(result.status).toBe(400);
  });

  it('code P2011 을 ErrorProcessor.process() 가 40004·400 과 prismaCode 로 변환한다', () => {
    const result = ErrorProcessor.process(new FakePrismaClientKnownRequestError('P2011'));

    expect(result.code).toBe(40004);
    expect(result.status).toBe(400);
    expect(result.details).toEqual({ prismaCode: 'P2011' });
  });

  it('메시지에 not found 가 없어도 code P2025 를 processError() 가 404 로 변환한다', () => {
    const result = processError(new FakePrismaClientKnownRequestError('P2025', 'Operation failed'));

    expect(result.code).toBe(40401);
    expect(result.status).toBe(404);
  });
});

describe('세 경로가 매핑표와 같은 결과를 낸다', () => {
  it.each(MAP_ENTRIES)('%s', async (prismaCode, mapping) => {
    const error = new FakePrismaClientKnownRequestError(prismaCode);

    const viaHandler = processError(error);
    expect({ code: viaHandler.code, status: viaHandler.status, message: viaHandler.message }).toEqual(mapping);

    const viaProcessor = ErrorProcessor.process(error);
    expect({ code: viaProcessor.code, status: viaProcessor.status, message: viaProcessor.message }).toEqual(mapping);

    const viaHelper = await readHandlePrismaError(error);
    expect(viaHelper.status).toBe(mapping.status);
    expect(viaHelper.body).toEqual({
      success: false,
      error: { code: mapping.code, message: mapping.message },
    });
  });
});

describe('handlePrismaError() 가 매핑표를 따른다', () => {
  it('code P2011 → 400 (40004), 매핑표 메시지', async () => {
    const { status, body } = await readHandlePrismaError({ code: 'P2011' });

    expect(status).toBe(400);
    expect(body.error.code).toBe(PRISMA_ERROR_MAP.P2011.code);
    expect(body.error.message).toBe(PRISMA_ERROR_MAP.P2011.message);
  });

  it('code P2003 → ErrorProcessor.process() 와 같은 400 (422 아님)', async () => {
    const processed = ErrorProcessor.process(new FakePrismaClientKnownRequestError('P2003'));
    const { status, body } = await readHandlePrismaError({ code: 'P2003' });

    expect(status).toBe(400);
    expect(status).toBe(processed.status);
    expect(body.error.code).toBe(processed.code);
    expect(body.error.code).not.toBe(ERROR_CODES.BUSINESS_RULE_VIOLATION.code);
  });

  it('PrismaClientValidationError → 400 VALIDATION_ERROR (다른 경로와 동일)', async () => {
    const error = new FakePrismaClientValidationError();
    const { status, body } = await readHandlePrismaError(error);

    expect(status).toBe(400);
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
    expect(body.error.message).toBe(PRISMA_VALIDATION_MESSAGE);
    expect(processError(error).status).toBe(400);
    expect(ErrorProcessor.process(error).status).toBe(400);
  });

  it('매핑표에 없는 Prisma 코드 → 500 DATABASE_ERROR', async () => {
    const { status, body } = await readHandlePrismaError({ code: 'P9999' });

    expect(status).toBe(500);
    expect(body.error.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
  });

  it('응답 본문에 Prisma 내부 코드(details)를 싣지 않는다', async () => {
    const { body } = await readHandlePrismaError({ code: 'P2002' });

    expect(body.error).not.toHaveProperty('details');
    expect(JSON.stringify(body)).not.toContain('P2002');
  });
});
