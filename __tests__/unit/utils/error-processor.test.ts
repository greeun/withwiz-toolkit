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
  const json = vi.fn((body: any, init?: any) => {
    const response = {
      status: init?.status || 200,
      json: async () => body,
      headers: new Map(),
      clone: () => ({
        status: init?.status || 200,
        json: async () => structuredClone(body),
        headers: new Map(),
      }),
    };
    return response;
  });
  return {
    NextResponse: { json },
    NextRequest: vi.fn(),
  };
});

import {
  ErrorProcessor,
  handlePrismaError,
  withErrorHandling,
  throwBusinessRuleError,
  throwNotFoundError,
  throwConflictError,
  throwForbiddenError,
  throwUnauthorizedError,
  throwValidationError,
  throwBadRequestError,
} from '@withwiz/utils/error-processor';
import { AppError } from '@withwiz/error/app-error';
import { ERROR_CODES } from '@withwiz/constants/error-codes';
import { NextResponse } from 'next/server';
import { logger } from '@withwiz/logger/logger';
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

describe('throwForbiddenError', () => {
  it('throws AppError with forbidden status', () => {
    try {
      throwForbiddenError('Not allowed');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(403);
    }
  });

  it('throws AppError with custom code when provided', () => {
    try {
      throwForbiddenError('Custom forbidden', 40301);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(40301);
    }
  });
});

describe('throwUnauthorizedError', () => {
  it('throws AppError with unauthorized status', () => {
    try {
      throwUnauthorizedError('Not authenticated');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(401);
    }
  });

  it('throws AppError with custom code when provided', () => {
    try {
      throwUnauthorizedError('Custom unauthorized', 40101);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(40101);
    }
  });
});

describe('throwValidationError', () => {
  it('throws AppError with validation category', () => {
    try {
      throwValidationError('Invalid email');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(400);
    }
  });

  it('throws AppError with custom code when provided', () => {
    try {
      throwValidationError('Custom validation', 40003);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(40003);
    }
  });
});

describe('throwBadRequestError', () => {
  it('throws AppError with bad request status', () => {
    try {
      throwBadRequestError('Bad request');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(400);
    }
  });

  it('throws AppError with custom code when provided', () => {
    try {
      throwBadRequestError('Custom bad request', 40002);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(40002);
    }
  });
});

describe('throwBusinessRuleError with code', () => {
  it('throws AppError with custom code', () => {
    try {
      throwBusinessRuleError('Rule violation', 42201);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(42201);
    }
  });
});

describe('throwNotFoundError with code', () => {
  it('throws AppError with custom code', () => {
    try {
      throwNotFoundError('Resource missing', 40401);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(40401);
    }
  });
});

describe('throwConflictError with code', () => {
  it('throws AppError with custom code', () => {
    try {
      throwConflictError('Duplicate entry', 40905);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(40905);
    }
  });
});

describe('withErrorHandling (standalone function)', () => {
  function createMockRequest(path = '/api/test') {
    return {
      method: 'GET',
      url: `http://localhost${path}`,
      nextUrl: { pathname: path },
      headers: new Map([['content-type', 'application/json']]),
      cookies: { get: () => undefined },
    } as any;
  }

  it('returns handler response on success', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
    const wrapped = withErrorHandling(handler);
    const request = createMockRequest();

    const response = await wrapped(request);
    const body = await response.json();

    expect(body.success).toBe(true);
  });

  it('handles ZodError and returns 400', async () => {
    const handler = vi.fn().mockImplementation(async () => {
      const schema = z.object({ email: z.string().email() });
      schema.parse({ email: 'invalid' });
    });
    const wrapped = withErrorHandling(handler);
    const request = createMockRequest();

    const response = await wrapped(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR.code);
    expect(body.error.details).toHaveProperty('issues');
  });

  it('handles AppError and returns correct status', async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw new AppError(40401, 'User not found');
    });
    const wrapped = withErrorHandling(handler);
    const request = createMockRequest();

    const response = await wrapped(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(40401);
  });

  it('handles generic Error and returns 500', async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw new Error('Something went wrong');
    });
    const wrapped = withErrorHandling(handler);
    const request = createMockRequest();

    const response = await wrapped(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('handles unknown (non-Error) throws and returns 500', async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw 'string error';
    });
    const wrapped = withErrorHandling(handler);
    const request = createMockRequest();

    const response = await wrapped(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.SERVER_ERROR.code);
  });

  it('uses customErrorHandler when provided', async () => {
    const customHandler = vi.fn().mockReturnValue(
      NextResponse.json({ success: false, custom: true }, { status: 422 })
    );
    const handler = vi.fn().mockImplementation(async () => {
      throw new Error('Custom handled');
    });
    const wrapped = withErrorHandling(handler, { customErrorHandler: customHandler });
    const request = createMockRequest();

    const response = await wrapped(request);

    expect(customHandler).toHaveBeenCalled();
    expect(response.status).toBe(422);
  });

  it('falls back to default handling when customErrorHandler throws', async () => {
    const customHandler = vi.fn().mockImplementation(() => {
      throw new Error('Custom handler failed');
    });
    const handler = vi.fn().mockImplementation(async () => {
      throw new Error('Original error');
    });
    const wrapped = withErrorHandling(handler, { customErrorHandler: customHandler });
    const request = createMockRequest();

    const response = await wrapped(request);

    expect(customHandler).toHaveBeenCalled();
    expect(response.status).toBe(500);
  });

  it('preserveCustomResponses returns non-200 responses as-is', async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ redirected: true }, { status: 302 })
    );
    const wrapped = withErrorHandling(handler, { preserveCustomResponses: true });
    const request = createMockRequest();

    const response = await wrapped(request);

    expect(response.status).toBe(302);
  });

  it('maskSensitiveInfo removes details from error response', async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw new AppError(40401, 'Not found', { field: 'secret_field' });
    });
    const wrapped = withErrorHandling(handler, { maskSensitiveInfo: true });
    const request = createMockRequest();

    const response = await wrapped(request);
    const body = await response.json();

    expect(body.error).not.toHaveProperty('details');
  });

  it('respects logLevel option for AppError', async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw new AppError(40401, 'Not found');
    });
    const wrapped = withErrorHandling(handler, { logLevel: 'warn' });
    const request = createMockRequest();

    await wrapped(request);

    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('ErrorProcessor.withErrorHandling (class method)', () => {
  it('catches errors and returns toResponse result', async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw new AppError(40401, 'Not found');
    }) as any;
    const wrapped = ErrorProcessor.withErrorHandling(handler);

    const response = await wrapped();

    expect(response.status).toBe(404);
  });

  it('passes through successful response', async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ success: true })
    ) as any;
    const wrapped = ErrorProcessor.withErrorHandling(handler);

    const response = await wrapped();
    const body = await response.json();

    expect(body.success).toBe(true);
  });
});
