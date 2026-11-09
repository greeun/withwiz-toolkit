/** 인증 방법 참조(RFC 8176 amr) 값. 토큰의 `amr` 클레임에 실린다. */
export const AMR = {
  PASSWORD: 'pwd',
  FEDERATED: 'fed',
  OTP: 'otp',
  RECOVERY: 'rec',
  MFA: 'mfa',
} as const;

export type AmrValue = (typeof AMR)[keyof typeof AMR];
