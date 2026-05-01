/**
 * createRoleMiddleware Unit Tests
 *
 * - 역할 기반 접근 제어 미들웨어 팩토리 검증
 * - adminMiddleware 하위 호환성 확인
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IApiContext } from '@withwiz/middleware/types';
import { AppError } from '@withwiz/error/app-error';
import { ERROR_CODES } from '@withwiz/constants/error-codes';

// logger mock
vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// auth config mock — createRoleMiddleware는 JWT 불필요하지만 모듈 로드 시 참조됨
vi.mock('@withwiz/auth/core/jwt', () => ({
  JWTManager: vi.fn(),
}));

function createMockContext(user?: { id: string; email: string; role: string }): IApiContext {
  return {
    request: new Request('http://localhost/api/test'),
    user: user as any,
    locale: 'ko',
    requestId: 'test-req-id',
    startTime: Date.now(),
    metadata: {},
  } as IApiContext;
}

const mockNext = vi.fn(async () => new Response('OK'));

describe('createRoleMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // 단일 역할 검증
  // ========================================================================

  describe('단일 역할 (ADMIN)', () => {
    it('ADMIN 역할이 아닌 사용자를 FORBIDDEN 에러로 거부해야 한다', async () => {
      const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
      const middleware = createRoleMiddleware('ADMIN');
      const context = createMockContext({ id: '1', email: 'user@test.com', role: 'USER' });

      try {
        await middleware(context, mockNext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ERROR_CODES.FORBIDDEN.code);
      }
    });

    it('ADMIN 역할의 사용자를 허용해야 한다', async () => {
      const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
      const middleware = createRoleMiddleware('ADMIN');
      const context = createMockContext({ id: '1', email: 'admin@test.com', role: 'ADMIN' });

      const response = await middleware(context, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(response).toBeInstanceOf(Response);
    });
  });

  // ========================================================================
  // 복수 역할 검증
  // ========================================================================

  describe('복수 역할 (ADMIN, EDITOR)', () => {
    it('허용된 복수 역할 중 하나인 사용자를 통과시켜야 한다', async () => {
      const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
      const middleware = createRoleMiddleware('ADMIN', 'EDITOR');

      // ADMIN 허용
      const adminContext = createMockContext({ id: '1', email: 'admin@test.com', role: 'ADMIN' });
      await middleware(adminContext, mockNext);
      expect(mockNext).toHaveBeenCalled();

      mockNext.mockClear();

      // EDITOR 허용
      const editorContext = createMockContext({ id: '2', email: 'editor@test.com', role: 'EDITOR' });
      await middleware(editorContext, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('허용 역할 목록에 없는 사용자를 FORBIDDEN 에러로 거부해야 한다', async () => {
      const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
      const middleware = createRoleMiddleware('ADMIN', 'EDITOR');
      const context = createMockContext({ id: '3', email: 'user@test.com', role: 'USER' });

      try {
        await middleware(context, mockNext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ERROR_CODES.FORBIDDEN.code);
      }
    });
  });

  // ========================================================================
  // 인증되지 않은 사용자 (user가 없는 경우)
  // ========================================================================

  describe('미인증 사용자', () => {
    it('context.user가 undefined이면 UNAUTHORIZED 에러를 발생시켜야 한다', async () => {
      const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
      const middleware = createRoleMiddleware('ADMIN');
      const context = createMockContext(undefined);

      try {
        await middleware(context, mockNext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ERROR_CODES.UNAUTHORIZED.code);
      }
    });

    it('context.user가 null이면 UNAUTHORIZED 에러를 발생시켜야 한다', async () => {
      const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
      const middleware = createRoleMiddleware('ADMIN');
      const context = createMockContext(undefined);
      // 명시적으로 null 설정
      (context as any).user = null;

      try {
        await middleware(context, mockNext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ERROR_CODES.UNAUTHORIZED.code);
      }
    });
  });

  // ========================================================================
  // next() 호출 확인
  // ========================================================================

  describe('next() 호출', () => {
    it('허용된 역할이면 next()를 정확히 한 번 호출해야 한다', async () => {
      const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
      const middleware = createRoleMiddleware('MODERATOR');
      const context = createMockContext({ id: '1', email: 'mod@test.com', role: 'MODERATOR' });

      await middleware(context, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('거부된 경우 next()를 호출하지 않아야 한다', async () => {
      const { createRoleMiddleware } = await import('@withwiz/middleware/auth');
      const middleware = createRoleMiddleware('ADMIN');
      const context = createMockContext({ id: '1', email: 'user@test.com', role: 'USER' });

      try {
        await middleware(context, mockNext);
      } catch {
        // expected
      }

      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// adminMiddleware 하위 호환성
// ============================================================================

describe('adminMiddleware (하위 호환성)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ADMIN 역할의 사용자를 허용해야 한다', async () => {
    const { adminMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext({ id: '1', email: 'admin@test.com', role: 'ADMIN' });

    const response = await adminMiddleware(context, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
    expect(response).toBeInstanceOf(Response);
  });

  it('ADMIN이 아닌 사용자를 FORBIDDEN 에러로 거부해야 한다', async () => {
    const { adminMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext({ id: '1', email: 'user@test.com', role: 'USER' });

    try {
      await adminMiddleware(context, mockNext);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODES.FORBIDDEN.code);
    }
  });

  it('인증되지 않은 사용자를 UNAUTHORIZED 에러로 거부해야 한다', async () => {
    const { adminMiddleware } = await import('@withwiz/middleware/auth');
    const context = createMockContext(undefined);

    try {
      await adminMiddleware(context, mockNext);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODES.UNAUTHORIZED.code);
    }
  });

  it('createRoleMiddleware("ADMIN")과 동일하게 동작해야 한다', async () => {
    const { adminMiddleware, createRoleMiddleware } = await import('@withwiz/middleware/auth');
    const roleMiddleware = createRoleMiddleware('ADMIN');

    // 둘 다 ADMIN 허용
    const adminContext = createMockContext({ id: '1', email: 'admin@test.com', role: 'ADMIN' });
    await adminMiddleware(adminContext, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();

    mockNext.mockClear();

    const adminContext2 = createMockContext({ id: '1', email: 'admin@test.com', role: 'ADMIN' });
    await roleMiddleware(adminContext2, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();

    mockNext.mockClear();

    // 둘 다 USER 거부
    const userContext1 = createMockContext({ id: '2', email: 'user@test.com', role: 'USER' });
    let adminError: AppError | undefined;
    try {
      await adminMiddleware(userContext1, mockNext);
    } catch (e) {
      adminError = e as AppError;
    }

    const userContext2 = createMockContext({ id: '2', email: 'user@test.com', role: 'USER' });
    let roleError: AppError | undefined;
    try {
      await roleMiddleware(userContext2, mockNext);
    } catch (e) {
      roleError = e as AppError;
    }

    expect(adminError).toBeInstanceOf(AppError);
    expect(roleError).toBeInstanceOf(AppError);
    expect(adminError!.code).toBe(roleError!.code);
    expect(adminError!.code).toBe(ERROR_CODES.FORBIDDEN.code);
  });
});
