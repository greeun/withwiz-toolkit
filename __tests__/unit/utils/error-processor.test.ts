import { vi } from 'vitest';

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
}));

vi.mock('next/server', () => {
  const json = vi.fn((body: any, init?: any) => ({
    status: init?.status || 200,
    json: async () => body,
    headers: new Map(),
  }));
  return {
    NextResponse: { json },
    NextRequest: vi.fn(),
  };
});

import { ErrorProcessor, handlePrismaError, throwBusinessRuleError, throwNotFoundError, throwConflictError } from '@withwiz/utils/error-processor';
import { AppError } from '@withwiz/error/app-error';
import { ERROR_CODES } from '@withwiz/constants/error-codes';
import { z } from 'zod';

describe('ErrorProcessor', () => {
  describe('process', () => {
    it('passes through AppError as serialized JSON', () => {
      const appError = new AppError(40401, 'User not found');
      const result = ErrorProcessor.process(appError);

      expect(result.code).toBe(40401);
      expect(result.status).toBe(404);
      expect(result.message).toBe('User not found');
      expect(result.key).toBe('NOT_FOUND');
      expect(result.category).toBe('resource');
    });

    it('converts ZodError to validation error with issues', () => {
      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(2),
      });

      let zodError: z.ZodError;
      try {
        schema.parse({ email: 'invalid', name: '' });
      } catch (e) {
        zodError = e as z.ZodError;
      }

      const result = ErrorProcessor.process(zodError!);

      expect(result.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
      expect(result.status).toBe(400);
      expect(result.category).toBe('validation');
      expect(result.details).toHaveProperty('issues');
      expect(Array.isArray(result.details!.issues)).toBe(true);
      expect((result.details!.issues as any[]).length).toBeGreaterThan(0);
    });

    it('maps generic Error with "not found" to 404', () => {
      const error = new Error('Resource not found in database');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(404);
      expect(result.key).toBe('NOT_FOUND');
    });

    it('maps generic Error with "Not found" (capitalized) to 404', () => {
      const error = new Error('Not found');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(404);
    });

    it('maps generic Error with "unauthorized" to 401', () => {
      const error = new Error('User is unauthorized');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(401);
      expect(result.key).toBe('UNAUTHORIZED');
    });

    it('maps generic Error with "Unauthorized" (capitalized) to 401', () => {
      const error = new Error('Unauthorized access');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(401);
    });

    it('maps generic Error with "Unique constraint failed" to 409', () => {
      const error = new Error('Unique constraint failed on fields');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(409);
      expect(result.key).toBe('DUPLICATE_RESOURCE');
    });

    it('maps Prisma P2002 error to duplicate resource', () => {
      const error = new Error('P2002: Unique constraint failed on the fields');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(409);
      expect(result.details).toEqual({ prismaCode: 'P2002' });
    });

    it('maps Prisma P2025 error to not found', () => {
      const error = new Error('P2025: An operation failed because it depends on records that were not found');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(404);
      expect(result.details).toEqual({ prismaCode: 'P2025' });
    });

    it('maps Prisma P2003 error to bad request', () => {
      const error = new Error('P2003: Foreign key constraint failed');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(400);
      expect(result.details).toEqual({ prismaCode: 'P2003' });
    });

    it('maps unknown generic Error to 500', () => {
      const error = new Error('Something completely unexpected');
      const result = ErrorProcessor.process(error);

      expect(result.status).toBe(500);
      expect(result.key).toBe('SERVER_ERROR');
    });

    it('maps non-Error unknown values to 500', () => {
      const result = ErrorProcessor.process('string error');

      expect(result.status).toBe(500);
      expect(result.key).toBe('INTERNAL_SERVER_ERROR');
    });

    it('maps null to 500', () => {
      const result = ErrorProcessor.process(null);

      expect(result.status).toBe(500);
    });

    it('maps undefined to 500', () => {
      const result = ErrorProcessor.process(undefined);

      expect(result.status).toBe(500);
    });
  });

  describe('toResponse', () => {
    it('returns response with correct status for AppError', () => {
      const appError = new AppError(40304, 'Access denied');
      const response = ErrorProcessor.toResponse(appError);

      expect(response.status).toBe(403);
    });

    it('returns JSON body with success:false and error object', async () => {
      const appError = new AppError(40401, 'Not found');
      const response = ErrorProcessor.toResponse(appError);
      const body = await response.json();

      expect(body.success).toBe(false);
      expect(body.error).toHaveProperty('code', 40401);
      expect(body.error).toHaveProperty('message', 'Not found');
    });

    it('returns 500 for unknown errors', () => {
      const response = ErrorProcessor.toResponse('random');

      expect(response.status).toBe(500);
    });

    it('returns 400 for ZodError', () => {
      const schema = z.string().min(5);
      let zodError: z.ZodError;
      try {
        schema.parse('ab');
      } catch (e) {
        zodError = e as z.ZodError;
      }

      const response = ErrorProcessor.toResponse(zodError!);
      expect(response.status).toBe(400);
    });
  });
});

describe('throwBusinessRuleError', () => {
  it('throws AppError with businessRule category', () => {
    try {
      throwBusinessRuleError('Custom rule violation');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).category).toBe('business');
    }
  });
});

describe('throwNotFoundError', () => {
  it('throws AppError with notFound status', () => {
    try {
      throwNotFoundError('Item missing');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(404);
    }
  });
});

describe('throwConflictError', () => {
  it('throws AppError with conflict status', () => {
    try {
      throwConflictError('Already exists');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(409);
    }
  });
});

describe('handlePrismaError', () => {
  it('maps P2002 to 409 conflict', async () => {
    const response = handlePrismaError({ code: 'P2002' });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.DUPLICATE_RESOURCE.code);
  });

  it('maps P2025 to 404 not found', async () => {
    const response = handlePrismaError({ code: 'P2025' });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe(ERROR_CODES.NOT_FOUND.code);
  });

  it('maps P2003 to 400 bad request (business rule)', async () => {
    const response = handlePrismaError({ code: 'P2003' });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe(ERROR_CODES.BUSINESS_RULE_VIOLATION.code);
  });

  it('maps unknown prisma code to 500 database error', async () => {
    const response = handlePrismaError({ code: 'P9999' });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
  });

  it('maps non-prisma error object to 500 database error', async () => {
    const response = handlePrismaError({ someField: 'value' });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
  });
});
