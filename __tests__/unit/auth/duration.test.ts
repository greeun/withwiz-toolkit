import { describe, it, expect } from 'vitest';
import { durationToSeconds } from '../../../src/core/auth/duration';

describe('durationToSeconds', () => {
  it('일/시/분/초 단위 → 초 변환', () => {
    expect(durationToSeconds('7d')).toBe(604800);
    expect(durationToSeconds('30d')).toBe(2592000);
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('1h')).toBe(3600);
    expect(durationToSeconds('30s')).toBe(30);
  });
  it('단위 없으면 초로 간주', () => {
    expect(durationToSeconds('900')).toBe(900);
  });
  it('공백 허용', () => {
    expect(durationToSeconds(' 7d ')).toBe(604800);
  });
  it('잘못된 형식 → throw', () => {
    expect(() => durationToSeconds('abc')).toThrow();
    expect(() => durationToSeconds('')).toThrow();
    expect(() => durationToSeconds('7x')).toThrow();
  });
});
