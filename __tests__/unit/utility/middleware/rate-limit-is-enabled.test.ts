/**
 * Unit Tests: Rate Limit isEnabled DI 패턴
 * Target: packages/@withwiz/toolkit/middleware/rate-limit.ts
 *
 * 테스트 범위:
 * - isEnabled 콜백 설정/미설정 시 동작
 * - isEnabled=false 시 Rate Limiting 스킵
 * - isEnabled=true 시 Rate Limiting 정상 동작
 * - 어댑터 미설정 시 Rate Limiting 비활성화
 * - 타입별 isEnabled(type) 제어
 *
 * 관련 커밋: 2ae174c0 - fix: Rate Limiting 시스템 버그 수정
 */

// Mock Logger
vi.mock("@withwiz/logger/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  setRateLimitAdapter,
  createRateLimitMiddleware,
  type IRateLimitAdapter,
  type IRateLimiter,
} from "@withwiz/middleware/rate-limit";

// ============================================================================
// 테스트 헬퍼
// ============================================================================

function createMockLimiter(overrides?: Partial<{ success: boolean; remaining: number; resetIn: number }>): IRateLimiter {
  const defaults = { success: true, remaining: 59, resetIn: 3600 };
  const result = { ...defaults, ...overrides };
  return {
    check: vi.fn().mockResolvedValue(result),
    config: { limit: 60 },
  };
}

function createMockContext(user?: { id: string }) {
  return {
    request: {
      headers: new Headers({ "x-forwarded-for": "192.168.1.1" }),
    },
    user: user || null,
    metadata: {} as Record<string, unknown>,
  };
}

function createMockNext() {
  return vi.fn().mockResolvedValue({ status: 200 });
}

// ============================================================================
// 테스트
// ============================================================================

describe("SC-API-RLFIX-001: isEnabled DI 패턴 동작 검증", () => {
  const mockApiLimiter = createMockLimiter();

  beforeEach(() => {
    vi.clearAllMocks();
    // 각 테스트에서 limiter mock 리셋
    (mockApiLimiter.check as Mock).mockResolvedValue({
      success: true,
      remaining: 59,
      resetIn: 3600,
    });
  });

  test("TC-API-RLFIX-001: isEnabled=false 시 Rate Limiting 스킵", async () => {
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: mockApiLimiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: vi.fn().mockResolvedValue(false),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("api");
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    // isEnabled가 호출됨
    expect(adapter.isEnabled).toHaveBeenCalled();
    // Rate Limit 체크를 하지 않음
    expect(mockApiLimiter.check).not.toHaveBeenCalled();
    // next()가 바로 호출됨
    expect(next).toHaveBeenCalled();
  });

  test("TC-API-RLFIX-002: isEnabled=true 시 Rate Limiting 정상 동작", async () => {
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: mockApiLimiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("api");
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    // isEnabled와 Rate Limit 체크 모두 호출됨
    expect(adapter.isEnabled).toHaveBeenCalled();
    expect(mockApiLimiter.check).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test("TC-API-RLFIX-003: isEnabled 미설정 시 기본 활성화", async () => {
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: mockApiLimiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      // isEnabled 필드 없음 (undefined)
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("api");
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    // isEnabled가 없으므로 Rate Limit 체크가 바로 수행됨
    expect(mockApiLimiter.check).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test("TC-API-RLFIX-004: isEnabled=false 시 Rate Limit 초과해도 요청 통과", async () => {
    // Rate Limit 초과 상태 설정
    (mockApiLimiter.check as Mock).mockResolvedValue({
      success: false,
      remaining: 0,
      resetIn: 60,
    });

    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: mockApiLimiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: vi.fn().mockResolvedValue(false),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("api");
    const context = createMockContext();
    const next = createMockNext();

    // Rate Limit 비활성화이므로 에러 없이 통과
    await middleware(context as any, next);

    expect(mockApiLimiter.check).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe("SC-API-RLFIX-002: Rate Limiting 기본 동작", () => {
  test("TC-API-RLFIX-010: Rate Limit 초과 시 AppError 발생", async () => {
    const limiter = createMockLimiter({ success: false, remaining: 0, resetIn: 60 });
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: limiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("api");
    const context = createMockContext();
    const next = createMockNext();

    await expect(middleware(context as any, next)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  test("TC-API-RLFIX-011: 인증된 사용자는 userId 기반 식별", async () => {
    const limiter = createMockLimiter();
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: limiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("api");
    const context = createMockContext({ id: "user-123" });
    const next = createMockNext();

    await middleware(context as any, next);

    expect(limiter.check).toHaveBeenCalledWith("user:user-123");
  });

  test("TC-API-RLFIX-012: 비인증 사용자는 IP 기반 식별", async () => {
    const limiter = createMockLimiter();
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: limiter },
      extractClientIp: vi.fn().mockReturnValue("10.0.0.1"),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("api");
    const context = createMockContext(); // user 없음
    const next = createMockNext();

    await middleware(context as any, next);

    expect(limiter.check).toHaveBeenCalledWith("ip:10.0.0.1");
  });

  test("TC-API-RLFIX-013: 미지원 Rate Limit 타입 시 Error 발생", async () => {
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: createMockLimiter() },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("unknown_type");
    const context = createMockContext();
    const next = createMockNext();

    await expect(middleware(context as any, next)).rejects.toThrow(
      /Unknown rate limit type/,
    );
  });

  test("TC-API-RLFIX-014: Rate Limit 메타데이터가 context에 추가됨", async () => {
    const limiter = createMockLimiter({ remaining: 42, resetIn: 120 });
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: limiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    setRateLimitAdapter(adapter);

    const middleware = createRateLimitMiddleware("api");
    const context = createMockContext();
    const next = createMockNext();

    await middleware(context as any, next);

    expect((context.metadata as any).rateLimit).toEqual({
      limit: 60,
      remaining: 42,
      reset: 120,
    });
  });
});

describe("SC-UNIT-RLTYPE-001: 미들웨어 isEnabled(type) 전달 검증", () => {
  const mockApiLimiter = createMockLimiter();
  const mockAuthLimiter = createMockLimiter();

  beforeEach(() => {
    vi.clearAllMocks();
    (mockApiLimiter.check as Mock).mockResolvedValue({
      success: true,
      remaining: 59,
      resetIn: 3600,
    });
    (mockAuthLimiter.check as Mock).mockResolvedValue({
      success: true,
      remaining: 19,
      resetIn: 3600,
    });
  });

  test("TC-UNIT-RLTYPE-001: isEnabled 콜백에 type 파라미터가 전달됨", async () => {
    const isEnabledMock = vi.fn().mockResolvedValue(true);
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: mockApiLimiter, auth: mockAuthLimiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: isEnabledMock,
    };
    setRateLimitAdapter(adapter);

    const apiMiddleware = createRateLimitMiddleware("api");
    const authMiddleware = createRateLimitMiddleware("auth");
    const context1 = createMockContext();
    const context2 = createMockContext();

    await apiMiddleware(context1 as any, createMockNext());
    await authMiddleware(context2 as any, createMockNext());

    // isEnabled가 각각의 타입으로 호출됨
    expect(isEnabledMock).toHaveBeenCalledWith("api");
    expect(isEnabledMock).toHaveBeenCalledWith("auth");
  });

  test("TC-UNIT-RLTYPE-002: 특정 타입만 비활성화 시 해당 타입만 스킵", async () => {
    // auth만 비활성화, api는 활성화
    const isEnabledMock = vi.fn().mockImplementation((type?: string) => {
      return Promise.resolve(type !== "auth");
    });
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: mockApiLimiter, auth: mockAuthLimiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: isEnabledMock,
    };
    setRateLimitAdapter(adapter);

    // API 미들웨어 - 활성화 상태
    const apiMiddleware = createRateLimitMiddleware("api");
    const apiContext = createMockContext();
    const apiNext = createMockNext();
    await apiMiddleware(apiContext as any, apiNext);

    expect(mockApiLimiter.check).toHaveBeenCalled();
    expect(apiNext).toHaveBeenCalled();

    // Auth 미들웨어 - 비활성화 상태
    const authMiddleware = createRateLimitMiddleware("auth");
    const authContext = createMockContext();
    const authNext = createMockNext();
    await authMiddleware(authContext as any, authNext);

    expect(mockAuthLimiter.check).not.toHaveBeenCalled();
    expect(authNext).toHaveBeenCalled();
  });

  test("TC-UNIT-RLTYPE-003: 전역 비활성화 시 모든 타입 스킵", async () => {
    // 전역 비활성화 (모든 타입에 대해 false)
    const isEnabledMock = vi.fn().mockResolvedValue(false);
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: mockApiLimiter, auth: mockAuthLimiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: isEnabledMock,
    };
    setRateLimitAdapter(adapter);

    const apiMiddleware = createRateLimitMiddleware("api");
    const authMiddleware = createRateLimitMiddleware("auth");

    await apiMiddleware(createMockContext() as any, createMockNext());
    await authMiddleware(createMockContext() as any, createMockNext());

    expect(mockApiLimiter.check).not.toHaveBeenCalled();
    expect(mockAuthLimiter.check).not.toHaveBeenCalled();
  });

  test("TC-UNIT-RLTYPE-004: 비활성화된 타입은 Rate Limit 초과해도 통과", async () => {
    // auth Rate Limit 초과 상태로 설정
    (mockAuthLimiter.check as Mock).mockResolvedValue({
      success: false,
      remaining: 0,
      resetIn: 60,
    });

    // auth 비활성화
    const isEnabledMock = vi.fn().mockImplementation((type?: string) => {
      return Promise.resolve(type !== "auth");
    });
    const adapter: IRateLimitAdapter = {
      rateLimiters: { api: mockApiLimiter, auth: mockAuthLimiter },
      extractClientIp: vi.fn().mockReturnValue("192.168.1.1"),
      isEnabled: isEnabledMock,
    };
    setRateLimitAdapter(adapter);

    // Auth가 비활성화이므로 Rate Limit 초과여도 통과
    const authMiddleware = createRateLimitMiddleware("auth");
    const authContext = createMockContext();
    const authNext = createMockNext();
    await authMiddleware(authContext as any, authNext);

    expect(mockAuthLimiter.check).not.toHaveBeenCalled();
    expect(authNext).toHaveBeenCalled();
  });
});
