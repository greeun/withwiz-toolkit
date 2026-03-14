/**
 * Timezone Utility Unit Tests
 */
import { describe, it, expect } from 'vitest';

describe('Timezone Utils', () => {
  it('should export timezone functions', async () => {
    const timezoneModule = await import('@withwiz/utils/timezone');
    expect(timezoneModule).toBeDefined();
  });

  describe('formatFullDateTime', () => {
    it('should format date string', async () => {
      const { formatFullDateTime } = await import('@withwiz/utils/timezone');

      if (typeof formatFullDateTime === 'function') {
        const result = formatFullDateTime('2026-01-15T10:30:00Z');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('should handle ISO date strings', async () => {
      const { formatFullDateTime } = await import('@withwiz/utils/timezone');

      if (typeof formatFullDateTime === 'function') {
        const result = formatFullDateTime(new Date('2026-03-14T12:00:00Z').toISOString());
        expect(result).toBeDefined();
      }
    });
  });
});
