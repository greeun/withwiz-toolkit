/**
 * Error Display Unit Tests
 *
 * Tests for src/error/error-display.ts
 * - showFriendlyError
 * - handleApiResponse
 * - formatInlineError
 * - getErrorIcon
 * - getDefaultErrorCode
 * - extractErrorInfo
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sonner toast
const mockToast = {
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('sonner', () => ({
  toast: mockToast,
}));

// Mock logger (needed transitively)
vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('error-display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // showFriendlyError
  // ============================================================================
  describe('showFriendlyError', () => {
    it('should show toast with error severity for server category code', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      // 50002 → server category → severity 'error'
      showFriendlyError(50002, { locale: 'ko' });
      expect(mockToast.error).toHaveBeenCalledTimes(1);
    });

    it('should show toast with warning severity for validation category code', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      // 40001 → validation category → severity 'warning'
      showFriendlyError(40001, { locale: 'ko' });
      expect(mockToast.warning).toHaveBeenCalledTimes(1);
    });

    it('should show toast with info severity for resource category code', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      // 40401 → resource category → severity 'info'
      showFriendlyError(40401, { locale: 'ko' });
      expect(mockToast.info).toHaveBeenCalledTimes(1);
    });

    it('should show critical severity via toast.error for security category', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      // 40371 → security category → severity 'critical' → toast.error
      showFriendlyError(40371, { locale: 'ko' });
      expect(mockToast.error).toHaveBeenCalledTimes(1);
    });

    it('should extract code from IApiErrorResponse', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      const apiError = {
        success: false as const,
        error: { code: 40101, message: 'Unauthorized' },
      };
      showFriendlyError(apiError, { locale: 'ko' });
      // 40101 → auth category → severity 'warning' → toast.warning
      expect(mockToast.warning).toHaveBeenCalledTimes(1);
    });

    it('should use error.code when Error has a numeric code property', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      const { AppError } = await import('@withwiz/error/app-error');
      const error = AppError.notFound('test');
      showFriendlyError(error, { locale: 'ko' });
      // 40401 → resource → info
      expect(mockToast.info).toHaveBeenCalledTimes(1);
    });

    it('should default to 50002 when Error has no code property', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      const error = new Error('generic error');
      showFriendlyError(error, { locale: 'ko' });
      // 50002 → server → error
      expect(mockToast.error).toHaveBeenCalledTimes(1);
    });

    it('should call onAuthError callback for auth category', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      const onAuthError = vi.fn();
      // 40101 → auth category
      showFriendlyError(40101, { locale: 'ko', onAuthError });
      expect(onAuthError).toHaveBeenCalledTimes(1);
    });

    it('should call onRateLimitError callback for rateLimit category', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      const onRateLimitError = vi.fn();
      // 42901 → rateLimit category
      showFriendlyError(42901, { locale: 'ko', onRateLimitError });
      expect(onRateLimitError).toHaveBeenCalledTimes(1);
    });

    it('should not call onAuthError when category is not auth', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      const onAuthError = vi.fn();
      showFriendlyError(40001, { locale: 'ko', onAuthError });
      expect(onAuthError).not.toHaveBeenCalled();
    });

    it('should include error code in description when showCode is true (default)', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      showFriendlyError(40001, { locale: 'ko' });
      const callArgs = mockToast.warning.mock.calls[0];
      expect(callArgs[1].description).toContain('[40001]');
    });

    it('should not include error code when showCode is false', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      showFriendlyError(40001, { locale: 'ko', showCode: false });
      const callArgs = mockToast.warning.mock.calls[0];
      expect(callArgs[1].description).not.toContain('[40001]');
    });

    it('should pass duration to toast', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      showFriendlyError(50002, { locale: 'ko', duration: 10000 });
      const callArgs = mockToast.error.mock.calls[0];
      expect(callArgs[1].duration).toBe(10000);
    });

    it('should default to 50002 when IApiErrorResponse has no code', async () => {
      const { showFriendlyError } = await import('@withwiz/error/error-display');
      const apiError = {
        success: false as const,
        error: { code: 0, message: '' },
      };
      showFriendlyError(apiError, { locale: 'ko' });
      // 0 is falsy → defaults to 50002 → server → error
      expect(mockToast.error).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // handleApiResponse
  // ============================================================================
  describe('handleApiResponse', () => {
    it('should return data on successful response', async () => {
      const { handleApiResponse } = await import('@withwiz/error/error-display');
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { id: 1, name: 'test' } }),
      } as unknown as Response;

      const result = await handleApiResponse<{ id: number; name: string }>(mockResponse);
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should show toast and throw AppError on error response', async () => {
      const { handleApiResponse } = await import('@withwiz/error/error-display');
      const { AppError } = await import('@withwiz/error/app-error');
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 40401, message: 'Not Found' },
        }),
      } as unknown as Response;

      await expect(handleApiResponse(mockResponse, { locale: 'ko' })).rejects.toThrow(AppError);
      expect(mockToast.info).toHaveBeenCalled(); // 40401 → resource → info
    });

    it('should not show toast when showToast is false', async () => {
      const { handleApiResponse } = await import('@withwiz/error/error-display');
      const mockResponse = {
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 50002, message: 'Server Error' },
        }),
      } as unknown as Response;

      await expect(
        handleApiResponse(mockResponse, { showToast: false })
      ).rejects.toThrow();
      expect(mockToast.error).not.toHaveBeenCalled();
      expect(mockToast.warning).not.toHaveBeenCalled();
      expect(mockToast.info).not.toHaveBeenCalled();
    });

    it('should throw AppError.fromKey(SERVER_ERROR) when error response has no code', async () => {
      const { handleApiResponse } = await import('@withwiz/error/error-display');
      const mockResponse = {
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 0, message: '' },
        }),
      } as unknown as Response;

      await expect(handleApiResponse(mockResponse, { locale: 'ko' })).rejects.toThrow();
    });

    it('should call onAuthError callback when error is auth category', async () => {
      const { handleApiResponse } = await import('@withwiz/error/error-display');
      const onAuthError = vi.fn();
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 40101, message: 'Unauthorized' },
        }),
      } as unknown as Response;

      await expect(
        handleApiResponse(mockResponse, { locale: 'ko', onAuthError })
      ).rejects.toThrow();
      expect(onAuthError).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // formatInlineError
  // ============================================================================
  describe('formatInlineError', () => {
    it('should return formatted string with description and code', async () => {
      const { formatInlineError } = await import('@withwiz/error/error-display');
      const result = formatInlineError(40001, 'ko');
      expect(result).toContain('[40001]');
      expect(result).toContain('입력하신 정보 중 일부가 올바르지 않습니다.');
    });

    it('should return English description with en locale', async () => {
      const { formatInlineError } = await import('@withwiz/error/error-display');
      const result = formatInlineError(40001, 'en');
      expect(result).toContain('[40001]');
      expect(result).toContain('Some information you entered is incorrect.');
    });

    it('should return fallback message for unknown code', async () => {
      const { formatInlineError } = await import('@withwiz/error/error-display');
      const result = formatInlineError(99999, 'ko');
      expect(result).toContain('[99999]');
      // Should use default message
      expect(result).toContain('예상치 못한 오류가 발생했습니다.');
    });
  });

  // ============================================================================
  // getErrorIcon
  // ============================================================================
  describe('getErrorIcon', () => {
    it('should return ⚠️ for validation category (400xx)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(40001)).toBe('⚠️');
    });

    it('should return 🔐 for auth category (401xx)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(40101)).toBe('🔐');
    });

    it('should return 🚫 for permission category (403xx 01-70)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(40304)).toBe('🚫');
    });

    it('should return 🔍 for resource category (404xx)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(40401)).toBe('🔍');
    });

    it('should return ⚡ for conflict category (409xx)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(40904)).toBe('⚡');
    });

    it('should return 📋 for business category (422xx)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(42201)).toBe('📋');
    });

    it('should return ⏱️ for rateLimit category (429xx)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(42901)).toBe('⏱️');
    });

    it('should return 🔧 for server category (500xx)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(50002)).toBe('🔧');
    });

    it('should return 🛡️ for security category (403xx 71-79)', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      expect(getErrorIcon(40371)).toBe('🛡️');
    });

    it('should return ❌ for unknown category', async () => {
      const { getErrorIcon } = await import('@withwiz/error/error-display');
      // A code whose httpStatus maps to unknown
      expect(getErrorIcon(99999)).toBe('❌');
    });
  });

  // ============================================================================
  // getDefaultErrorCode
  // ============================================================================
  describe('getDefaultErrorCode', () => {
    it('should map 400 → 40002', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(400)).toBe(40002);
    });

    it('should map 401 → 40101', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(401)).toBe(40101);
    });

    it('should map 403 → 40304', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(403)).toBe(40304);
    });

    it('should map 404 → 40401', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(404)).toBe(40401);
    });

    it('should map 409 → 40904', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(409)).toBe(40904);
    });

    it('should map 422 → 42201', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(422)).toBe(42201);
    });

    it('should map 429 → 42901', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(429)).toBe(42901);
    });

    it('should map 500 → 50002', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(500)).toBe(50002);
    });

    it('should map 503 → 50305', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(503)).toBe(50305);
    });

    it('should map unknown status to 50002', async () => {
      const { getDefaultErrorCode } = await import('@withwiz/error/error-display');
      expect(getDefaultErrorCode(418)).toBe(50002);
      expect(getDefaultErrorCode(200)).toBe(50002);
    });
  });

  // ============================================================================
  // extractErrorInfo
  // ============================================================================
  describe('extractErrorInfo', () => {
    it('should extract code from AppError (code >= 10000)', async () => {
      const { extractErrorInfo } = await import('@withwiz/error/error-display');
      const { AppError } = await import('@withwiz/error/app-error');
      const error = AppError.notFound('Test');
      const result = extractErrorInfo(error);
      expect(result.code).toBe(40401);
      expect(result.message).toBeDefined();
      expect(result.stack).toBeDefined();
    });

    it('should return 50001 for regular Error without code property', async () => {
      const { extractErrorInfo } = await import('@withwiz/error/error-display');
      const error = new Error('Something went wrong');
      const result = extractErrorInfo(error);
      expect(result.code).toBe(50001);
      expect(result.message).toBe('Something went wrong');
      expect(result.stack).toBeDefined();
    });

    it('should return 50001 for Error with code < 10000', async () => {
      const { extractErrorInfo } = await import('@withwiz/error/error-display');
      const error = new Error('Some error') as Error & { code: number };
      (error as any).code = 42;
      const result = extractErrorInfo(error);
      expect(result.code).toBe(50001);
    });

    it('should return string representation for non-Error objects', async () => {
      const { extractErrorInfo } = await import('@withwiz/error/error-display');
      const result = extractErrorInfo('string error');
      expect(result.code).toBe(50001);
      expect(result.message).toBe('string error');
      expect(result.stack).toBeUndefined();
    });

    it('should return string representation for null/undefined', async () => {
      const { extractErrorInfo } = await import('@withwiz/error/error-display');
      const result = extractErrorInfo(null);
      expect(result.code).toBe(50001);
      expect(result.message).toBe('null');
    });

    it('should return string representation for number', async () => {
      const { extractErrorInfo } = await import('@withwiz/error/error-display');
      const result = extractErrorInfo(404);
      expect(result.code).toBe(50001);
      expect(result.message).toBe('404');
    });
  });
});
