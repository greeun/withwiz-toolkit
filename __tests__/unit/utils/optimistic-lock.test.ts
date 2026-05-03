import { vi } from 'vitest';

vi.mock('@withwiz/logger/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { withOptimisticLock } from '@withwiz/utils/optimistic-lock';
import { AppError } from '@withwiz/error/app-error';

describe('withOptimisticLock', () => {
  it('succeeds silently when updateFn returns count > 0', async () => {
    const updateFn = vi.fn().mockResolvedValue({ count: 1 });
    await expect(withOptimisticLock(updateFn)).resolves.toBeUndefined();
    expect(updateFn).toHaveBeenCalledOnce();
  });

  it('succeeds for count greater than 1', async () => {
    const updateFn = vi.fn().mockResolvedValue({ count: 5 });
    await expect(withOptimisticLock(updateFn)).resolves.toBeUndefined();
  });

  it('throws AppError with code 40904 when count is 0', async () => {
    const updateFn = vi.fn().mockResolvedValue({ count: 0 });

    try {
      await withOptimisticLock(updateFn);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(40904);
      expect((e as AppError).status).toBe(409);
    }
  });

  it('uses default entity name "Record" in error message', async () => {
    const updateFn = vi.fn().mockResolvedValue({ count: 0 });

    try {
      await withOptimisticLock(updateFn);
      expect.fail('Should have thrown');
    } catch (e) {
      expect((e as AppError).message).toContain('Record');
    }
  });

  it('uses provided entityName in error message', async () => {
    const updateFn = vi.fn().mockResolvedValue({ count: 0 });

    try {
      await withOptimisticLock(updateFn, 'User');
      expect.fail('Should have thrown');
    } catch (e) {
      expect((e as AppError).message).toContain('User');
      expect((e as AppError).message).not.toContain('Record');
    }
  });

  it('propagates errors thrown by updateFn', async () => {
    const updateFn = vi.fn().mockRejectedValue(new Error('DB connection lost'));

    await expect(withOptimisticLock(updateFn)).rejects.toThrow('DB connection lost');
  });

  it('propagates AppError thrown by updateFn', async () => {
    const updateFn = vi.fn().mockRejectedValue(new AppError(50003, 'Database failure'));

    try {
      await withOptimisticLock(updateFn);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(50003);
    }
  });
});
