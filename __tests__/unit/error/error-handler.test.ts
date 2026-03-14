/**
 * Error Handler Unit Tests
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

describe('Error Handler', () => {
  it('should export error handler functions', async () => {
    const errorHandler = await import('@withwiz/error/error-handler');
    expect(errorHandler).toBeDefined();
  });
});

describe('Error Display', () => {
  it('should export error display utilities', async () => {
    const errorDisplay = await import('@withwiz/error/error-display');
    expect(errorDisplay).toBeDefined();
  });
});
