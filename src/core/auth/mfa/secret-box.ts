import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface SecretBox {
  seal(plain: string): string;
  open(sealed: string): string;
}

const KEY_ERROR = 'MFA encryption key must be 32 bytes (base64)';

/**
 * AES-256-GCM 비밀 봉투. 형식 `v1.<keyId>.<iv>.<ciphertext>.<tag>`(base64url).
 * keyId = 키 바이트 SHA-256 hex 앞 8자. 봉인은 첫 키, 열기는 keyId 로 키를 고른다.
 */
export function createSecretBox(keys: string[]): SecretBox {
  if (!keys || keys.length === 0) throw new Error(KEY_ERROR);
  const ring = new Map<string, Buffer>();
  let primaryId = '';
  keys.forEach((k, i) => {
    const raw = Buffer.from(k, 'base64');
    if (raw.length !== 32) throw new Error(KEY_ERROR);
    const id = createHash('sha256').update(raw).digest('hex').slice(0, 8);
    if (i === 0) primaryId = id;
    if (!ring.has(id)) ring.set(id, raw);
  });

  return {
    seal(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', ring.get(primaryId)!, iv);
      const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return ['v1', primaryId, iv.toString('base64url'), ct.toString('base64url'), tag.toString('base64url')].join('.');
    },
    open(sealed) {
      const parts = sealed.split('.');
      if (parts.length !== 5 || parts[0] !== 'v1') throw new Error('Invalid sealed secret');
      const key = ring.get(parts[1]);
      if (!key) throw new Error('Unknown MFA encryption key');
      const iv = Buffer.from(parts[2], 'base64url');
      const tag = Buffer.from(parts[4], 'base64url');
      if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid sealed secret');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
    },
  };
}
