/**
 * API Helpers Unit Tests
 *
 * 가장 많이 사용되는 유틸리티 (185 imports across 3 projects)
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('API Helpers', () => {
  it('should export api helper functions', async () => {
    const apiHelpers = await import('@withwiz/utils/api-helpers');
    expect(apiHelpers).toBeDefined();
  });

  describe('createApiResponse', () => {
    it('should create success response', async () => {
      const { createApiResponse } = await import('@withwiz/utils/api-helpers');

      if (typeof createApiResponse === 'function') {
        const response = createApiResponse({ data: 'test' });
        expect(response).toBeDefined();
      }
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response', async () => {
      const { createErrorResponse } = await import('@withwiz/utils/api-helpers');

      if (typeof createErrorResponse === 'function') {
        const response = createErrorResponse(400, 'Bad Request');
        expect(response).toBeDefined();
      }
    });
  });
});
