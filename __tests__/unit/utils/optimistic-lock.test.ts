/**
 * Optimistic Lock Utility Unit Tests
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

describe('withOptimisticLock', () => {
  it('should succeed when update affects rows', async () => {
    const { withOptimisticLock } = await import('@withwiz/utils/optimistic-lock');

    const updateFn = vi.fn().mockResolvedValue({ count: 1 });
    await expect(withOptimisticLock(updateFn, 'Link')).resolves.toBeUndefined();
    expect(updateFn).toHaveBeenCalledOnce();
  });

  it('should throw AppError when count is 0 (version conflict)', async () => {
    const { withOptimisticLock } = await import('@withwiz/utils/optimistic-lock');

    const updateFn = vi.fn().mockResolvedValue({ count: 0 });

    await expect(withOptimisticLock(updateFn, 'Link')).rejects.toThrow(
      'Link was modified by another request'
    );
  });

  it('should use default entity name "Record" when not provided', async () => {
    const { withOptimisticLock } = await import('@withwiz/utils/optimistic-lock');

    const updateFn = vi.fn().mockResolvedValue({ count: 0 });

    await expect(withOptimisticLock(updateFn)).rejects.toThrow(
      'Record was modified by another request'
    );
  });

  it('should propagate errors from updateFn', async () => {
    const { withOptimisticLock } = await import('@withwiz/utils/optimistic-lock');

    const updateFn = vi.fn().mockRejectedValue(new Error('DB connection failed'));

    await expect(withOptimisticLock(updateFn, 'User')).rejects.toThrow('DB connection failed');
  });
});
