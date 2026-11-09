import {
  generateRecoveryCodes,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
} from '@withwiz/toolkit/core/auth/mfa/recovery-codes';

describe('recovery codes', () => {
  it('복구 코드 10개, 형식, 중복 없음', () => {
    const codes = generateRecoveryCodes();
    expect(RECOVERY_CODE_COUNT).toBe(10);
    expect(codes).toHaveLength(10);
    codes.forEach((c) => expect(c).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}$/));
    expect(new Set(codes).size).toBe(10);
  });

  it('개수 지정', () => {
    expect(generateRecoveryCodes(3)).toHaveLength(3);
  });

  it('정규화: 대문자·공백·하이픈 없음도 같은 해시', () => {
    expect(hashRecoveryCode(' ABCD 2345 ')).toBe(hashRecoveryCode('abcd-2345'));
    expect(hashRecoveryCode('abcd-2345')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('다른 코드는 다른 해시', () => {
    expect(hashRecoveryCode('abcd-2345')).not.toBe(hashRecoveryCode('abcd-2346'));
  });
});
