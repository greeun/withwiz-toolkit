import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { base32Decode, base32Encode } from './base32';

export const TOTP_DEFAULTS = { digits: 6, period: 30, window: 1 } as const;

/** 20바이트 무작위 비밀 키를 base32 로 반환한다. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function currentStep(nowMs: number = Date.now(), period: number = TOTP_DEFAULTS.period): number {
  return Math.floor(nowMs / 1000 / period);
}

/** HMAC-SHA1 + RFC 4226 동적 절단. */
export function totpCode(secret: string, step: number, digits: number = TOTP_DEFAULTS.digits): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

/** 맞은 스텝을 반환한다. 형식 불일치·불일치는 null. */
export function verifyTotp(
  secret: string,
  code: string,
  opts: { nowMs?: number; window?: number } = {},
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const window = opts.window ?? TOTP_DEFAULTS.window;
  const step = currentStep(opts.nowMs);
  const given = Buffer.from(code);
  let matched: number | null = null;
  for (let s = step - window; s <= step + window; s++) {
    // 일치해도 끝까지 돌아 비교 시간을 일정하게 한다.
    if (timingSafeEqual(given, Buffer.from(totpCode(secret, s))) && matched === null) matched = s;
  }
  return matched;
}

export function buildOtpauthUri(p: { issuer: string; account: string; secret: string }): string {
  const issuer = encodeURIComponent(p.issuer);
  const account = encodeURIComponent(p.account);
  return `otpauth://totp/${issuer}:${account}?secret=${p.secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DEFAULTS.digits}&period=${TOTP_DEFAULTS.period}`;
}
