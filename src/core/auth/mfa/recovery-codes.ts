import { createHash, randomBytes } from 'node:crypto';

export const RECOVERY_CODE_COUNT = 10;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** 암호학적 난수로 8자를 뽑는다. 32개 문자라 바이트 하위 5비트를 쓰면 모듈로 편향이 없다. */
function randomCode(): string {
  const bytes = randomBytes(8);
  let s = '';
  for (const b of bytes) s += ALPHABET[b & 31];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** `xxxx-xxxx` 형식 복구 코드를 count 개 만든다(배치 내 중복 없음). */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(randomCode());
  return [...codes];
}

/** 소문자화 후 `[a-z2-7]` 이외 문자를 제거하고 SHA-256 hex 로 해시한다. */
export function hashRecoveryCode(input: string): string {
  const normalized = input.toLowerCase().replace(/[^a-z2-7]/g, '');
  return createHash('sha256').update(normalized).digest('hex');
}
