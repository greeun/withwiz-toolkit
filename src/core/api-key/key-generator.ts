import crypto from 'crypto';

/** prefix + 32바이트 랜덤 hex. */
export function generateRawKey(prefix: string): string {
  return `${prefix}${crypto.randomBytes(32).toString('hex')}`;
}

/** raw key의 sha256 hex (DB 저장용). */
export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/** 키 해시 미리보기: 처음 10 + ... + 마지막 4. 14자 미만이면 원본. */
export function keyPreview(keyHash: string): string {
  if (keyHash.length < 14) return keyHash;
  return `${keyHash.substring(0, 10)}...${keyHash.substring(keyHash.length - 4)}`;
}
