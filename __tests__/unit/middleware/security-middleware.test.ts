/**
 * Unit Tests: Security Middleware - Content-Type 검증 & validateSecurityConfiguration
 *
 * 커버리지 대상:
 * - POST 요청에 body가 있지만 Content-Type이 없을 때 415 응답
 * - POST 요청에 허용되지 않은 Content-Type → 415 응답
 * - POST 요청에 허용된 Content-Type → 통과
 * - multipart/form-data (boundary 포함) → 통과
 * - validateSecurityConfiguration() 로깅 검증
 */

import { NextResponse } from 'next/server';

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { securityMiddleware, validateSecurityConfiguration, setAllowedOrigins } from '@withwiz/middleware/security';
import { logger } from '@withwiz/logger/logger';
import type { IApiContext } from '@withwiz/middleware/types';

// ============================================================================
// 테스트 헬퍼
// ============================================================================

function createMockContext(
  method: string,
  headers: Record<string, string> = {},
): IApiContext {
  const h = new Headers(headers);
  return {
    request: {
      method,
      url: 'http://localhost/api/test',
      headers: h,
      cookies: { get: () => undefined },
    } as any,
    locale: 'ko',
    requestId: 'test-id',
    startTime: Date.now(),
    metadata: {},
  };
}

function createMockNext() {
  return vi.fn().mockResolvedValue(
    new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

// ============================================================================
// 테스트
// ============================================================================

describe('Security Middleware - Content-Type 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Origin 검증을 비활성화 (설정 초기화)
    globalThis.__withwiz_allowed_origins = undefined;
  });

  describe('Content-Type 누락 (body 있음)', () => {
    it('POST 요청에 content-length > 0이지만 content-type이 없으면 415를 반환한다', async () => {
      const context = createMockContext('POST', {
        'content-length': '42',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(415);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(41500);
      expect(body.error.message).toContain('Content-Type header is required');
      expect(next).not.toHaveBeenCalled();
    });

    it('PUT 요청에 content-length > 0이지만 content-type이 없으면 415를 반환한다', async () => {
      const context = createMockContext('PUT', {
        'content-length': '100',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(415);
      const body = await response.json();
      expect(body.error.code).toBe(41500);
      expect(next).not.toHaveBeenCalled();
    });

    it('PATCH 요청에 content-length > 0이지만 content-type이 없으면 415를 반환한다', async () => {
      const context = createMockContext('PATCH', {
        'content-length': '10',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(415);
      expect(next).not.toHaveBeenCalled();
    });

    it('POST 요청에 content-length가 0이고 content-type이 없으면 통과한다', async () => {
      const context = createMockContext('POST', {
        'content-length': '0',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    });

    it('POST 요청에 content-length 헤더가 없고 content-type도 없으면 통과한다', async () => {
      const context = createMockContext('POST', {});
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('허용되지 않은 Content-Type', () => {
    it('text/xml Content-Type은 415를 반환한다', async () => {
      const context = createMockContext('POST', {
        'content-type': 'text/xml',
        'content-length': '50',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(415);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(41501);
      expect(body.error.message).toContain('Unsupported Content-Type');
      expect(body.error.message).toContain('text/xml');
      expect(next).not.toHaveBeenCalled();
    });

    it('application/xml Content-Type은 415를 반환한다', async () => {
      const context = createMockContext('POST', {
        'content-type': 'application/xml',
        'content-length': '50',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(415);
      const body = await response.json();
      expect(body.error.message).toContain('application/xml');
      expect(next).not.toHaveBeenCalled();
    });

    it('text/html Content-Type은 415를 반환한다', async () => {
      const context = createMockContext('PUT', {
        'content-type': 'text/html; charset=utf-8',
        'content-length': '100',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(415);
      const body = await response.json();
      // charset은 분리되므로 text/html만 포함
      expect(body.error.message).toContain('text/html');
      expect(next).not.toHaveBeenCalled();
    });

    it('415 응답에 Accept 헤더가 포함된다', async () => {
      const context = createMockContext('POST', {
        'content-type': 'text/xml',
        'content-length': '50',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.headers.get('Accept')).toContain('application/json');
      expect(response.headers.get('Accept')).toContain('multipart/form-data');
    });
  });

  describe('허용된 Content-Type 통과', () => {
    it('application/json Content-Type은 통과한다', async () => {
      const context = createMockContext('POST', {
        'content-type': 'application/json',
        'content-length': '50',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    });

    it('application/json; charset=utf-8 Content-Type은 통과한다', async () => {
      const context = createMockContext('POST', {
        'content-type': 'application/json; charset=utf-8',
        'content-length': '50',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    });

    it('multipart/form-data; boundary=... Content-Type은 통과한다', async () => {
      const context = createMockContext('POST', {
        'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary',
        'content-length': '1024',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    });

    it('application/x-www-form-urlencoded Content-Type은 통과한다', async () => {
      const context = createMockContext('POST', {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': '50',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    });

    it('text/plain Content-Type은 통과한다', async () => {
      const context = createMockContext('POST', {
        'content-type': 'text/plain',
        'content-length': '50',
      });
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('GET 요청은 Content-Type 검증을 건너뛴다', () => {
    it('GET 요청에는 Content-Type이 없어도 통과한다', async () => {
      const context = createMockContext('GET', {});
      const next = createMockNext();

      const response = await securityMiddleware(context, next);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    });
  });
});

describe('validateSecurityConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__withwiz_allowed_origins = undefined;
  });

  it('차단된 메서드 목록을 로깅한다', () => {
    validateSecurityConfiguration();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Blocked methods'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('TRACE'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('TRACK'),
    );
  });

  it('허용된 Content-Type 목록을 로깅한다', () => {
    validateSecurityConfiguration();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Allowed Content-Types'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('application/json'),
    );
  });

  it('허용된 Origin이 설정되지 않은 경우 NOT CONFIGURED를 로깅한다', () => {
    validateSecurityConfiguration();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('NOT CONFIGURED'),
    );
  });

  it('허용된 Origin이 설정된 경우 해당 목록을 로깅한다', () => {
    globalThis.__withwiz_allowed_origins = ['https://example.com', 'https://api.example.com'];

    validateSecurityConfiguration();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('https://api.example.com'),
    );
  });
});
