import { base32Encode, base32Decode } from '@withwiz/toolkit/core/auth/mfa/base32';
import {
  totpCode,
  verifyTotp,
  currentStep,
  generateTotpSecret,
  buildOtpauthUri,
} from '@withwiz/toolkit/core/auth/mfa/totp';

const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('RFC 6238 부록 B SHA1 벡터 T=%i', (t, expected) => {
    expect(totpCode(RFC_SECRET, Math.floor(t / 30), 8)).toBe(expected);
  });

  it('6자리는 8자리의 끝 6자리', () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
  });

  it('base32 왕복·소문자·공백 허용', () => {
    const b = Buffer.from('hello world');
    expect(base32Decode(base32Encode(b).toLowerCase().replace(/(.{4})/g, '$1 '))).toEqual(b);
  });

  it('base32 잘못된 문자는 오류', () => {
    expect(() => base32Decode('ABC1')).toThrow();
  });

  it('이전 창 코드는 허용, 두 창 이전은 거부', () => {
    const now = 1_700_000_000_000;
    const s = currentStep(now);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, s - 1), { nowMs: now })).toBe(s - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, s - 2), { nowMs: now })).toBeNull();
  });

  it('형식이 틀리면 null', () => {
    expect(verifyTotp(RFC_SECRET, '12345a')).toBeNull();
  });

  it('generateTotpSecret 은 32자 base32(20바이트)', () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('otpauth URI', () => {
    expect(buildOtpauthUri({ issuer: 'binder', account: 'a@b.c', secret: 'ABC' })).toBe(
      'otpauth://totp/binder:a%40b.c?secret=ABC&issuer=binder&algorithm=SHA1&digits=6&period=30',
    );
  });
});
