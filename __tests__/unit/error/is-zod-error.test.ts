import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isZodError, zodPathText } from '../../../src/core/error/is-zod-error';

describe('isZodError', () => {
  it('toolkit 의 zod 가 던진 실패를 알아본다', () => {
    const r = z.object({ email: z.string() }).safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(isZodError(r.error)).toBe(true);
  });

  it('소비 앱의 다른 zod 사본(zod 3 형태)이 던진 실패도 알아본다', () => {
    const fromOtherCopy = Object.assign(new Error('x'), {
      name: 'ZodError',
      issues: [{ path: ['a'], message: 'Required', code: 'invalid_type' }],
    });
    expect(isZodError(fromOtherCopy)).toBe(true);
  });

  it('일반 오류와 비객체는 아니다', () => {
    expect(isZodError(new Error('x'))).toBe(false);
    expect(isZodError({ name: 'ZodError' })).toBe(false);
    expect(isZodError(null)).toBe(false);
    expect(isZodError('ZodError')).toBe(false);
  });
});

describe('zodPathText', () => {
  it('숫자·symbol 이 섞인 path 도 던지지 않는다', () => {
    expect(zodPathText(['a', 0, Symbol('k')])).toBe('a.0.Symbol(k)');
  });
});
