import {
  getCurrentUTC,
  utcToLocal,
  localToUTC,
  formatFullDateTime,
  formatTableDateTime,
  getRelativeTime,
  getUserTimezone,
  getTimezoneOffset,
  toUTCISOString,
} from '@withwiz/utils/timezone';

describe('getCurrentUTC', () => {
  it('returns a Date object', () => {
    const result = getCurrentUTC();
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a date close to now', () => {
    const before = Date.now();
    const result = getCurrentUTC();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('utcToLocal', () => {
  it('returns a Date object', () => {
    const result = utcToLocal(new Date('2024-01-15T12:00:00Z'));
    expect(result).toBeInstanceOf(Date);
  });

  it('converts UTC date with specific timezone', () => {
    const utcDate = new Date('2024-06-15T00:00:00Z');
    const result = utcToLocal(utcDate, 'America/New_York');
    expect(result.getHours()).toBe(20);
    expect(result.getDate()).toBe(14);
  });

  it('accepts string date input', () => {
    const result = utcToLocal('2024-01-15T12:00:00Z', 'UTC');
    expect(result).toBeInstanceOf(Date);
    expect(result.getHours()).toBe(12);
  });

  it('returns the same date object when no timezone specified', () => {
    const utcDate = new Date('2024-01-15T12:00:00Z');
    const result = utcToLocal(utcDate);
    expect(result.getTime()).toBe(utcDate.getTime());
  });
});

describe('localToUTC', () => {
  it('returns a Date object', () => {
    const result = localToUTC(new Date());
    expect(result).toBeInstanceOf(Date);
  });

  it('adjusts by timezone offset', () => {
    const date = new Date('2024-01-15T12:00:00');
    const result = localToUTC(date);
    const expectedOffset = date.getTimezoneOffset() * 60000;
    expect(result.getTime()).toBe(date.getTime() - expectedOffset);
  });

  it('accepts string date input', () => {
    const result = localToUTC('2024-06-15T10:30:00');
    expect(result).toBeInstanceOf(Date);
  });
});

describe('formatFullDateTime', () => {
  it('returns a string', () => {
    const result = formatFullDateTime(new Date('2024-01-15T12:30:45'));
    expect(typeof result).toBe('string');
  });

  it('contains both date and time portions separated by space', () => {
    const result = formatFullDateTime(new Date('2024-01-15T08:30:45'));
    expect(result).toContain(' ');
    const parts = result.split(' ');
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it('accepts string date input', () => {
    const result = formatFullDateTime('2024-01-15T12:30:45');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatTableDateTime', () => {
  it('returns an object with date and time string properties', () => {
    const result = formatTableDateTime(new Date('2024-01-15T12:30:45'));
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('time');
    expect(typeof result.date).toBe('string');
    expect(typeof result.time).toBe('string');
  });

  it('date and time are non-empty strings', () => {
    const result = formatTableDateTime(new Date('2024-06-20T08:15:30'));
    expect(result.date.length).toBeGreaterThan(0);
    expect(result.time.length).toBeGreaterThan(0);
  });

  it('accepts string date input', () => {
    const result = formatTableDateTime('2024-01-15T12:30:45');
    expect(typeof result.date).toBe('string');
    expect(typeof result.time).toBe('string');
  });
});

describe('getRelativeTime', () => {
  it('returns "just now" for less than 60 seconds ago', () => {
    const now = new Date();
    const result = getRelativeTime(now);
    expect(result).toBe('just now');
  });

  it('returns Xm ago for minutes', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    const result = getRelativeTime(date);
    expect(result).toBe('5m ago');
  });

  it('returns Xh ago for hours', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const result = getRelativeTime(date);
    expect(result).toBe('3h ago');
  });

  it('returns Xd ago for days', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = getRelativeTime(date);
    expect(result).toBe('2d ago');
  });

  it('returns Xw ago for weeks', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = getRelativeTime(date);
    expect(result).toBe('2w ago');
  });

  it('returns Xmo ago for months', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const result = getRelativeTime(date);
    expect(result).toBe('2mo ago');
  });

  it('returns Xy ago for years', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const result = getRelativeTime(date);
    expect(result).toBe('1y ago');
  });

  it('accepts string date input', () => {
    const result = getRelativeTime(new Date(Date.now() - 120000).toISOString());
    expect(result).toBe('2m ago');
  });
});

describe('getUserTimezone', () => {
  it('returns a non-empty string', () => {
    const result = getUserTimezone();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a valid IANA timezone name', () => {
    const result = getUserTimezone();
    expect(result).toContain('/');
  });
});

describe('getTimezoneOffset', () => {
  it('returns a number', () => {
    const result = getTimezoneOffset();
    expect(typeof result).toBe('number');
  });

  it('returns a value within valid range (-720 to 840 minutes)', () => {
    const result = getTimezoneOffset();
    expect(result).toBeGreaterThanOrEqual(-840);
    expect(result).toBeLessThanOrEqual(720);
  });
});

describe('toUTCISOString', () => {
  it('returns a string ending with Z', () => {
    const result = toUTCISOString(new Date('2024-01-15T12:00:00Z'));
    expect(result).toMatch(/Z$/);
  });

  it('returns valid ISO 8601 format', () => {
    const result = toUTCISOString(new Date('2024-06-15T08:30:00Z'));
    expect(result).toBe('2024-06-15T08:30:00.000Z');
  });

  it('accepts string date input', () => {
    const result = toUTCISOString('2024-01-15T12:00:00Z');
    expect(result).toBe('2024-01-15T12:00:00.000Z');
  });

  it('converts local date to UTC ISO string', () => {
    const date = new Date('2024-01-15T00:00:00Z');
    const result = toUTCISOString(date);
    expect(new Date(result).getTime()).toBe(date.getTime());
  });
});
