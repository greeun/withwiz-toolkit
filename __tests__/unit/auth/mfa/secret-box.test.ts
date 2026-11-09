import { randomBytes } from 'node:crypto';
import { createSecretBox } from '@withwiz/toolkit/core/auth/mfa/secret-box';

const k1 = randomBytes(32).toString('base64');
const k2 = randomBytes(32).toString('base64');

describe('secret-box', () => {
  it('왕복', () => {
    const b = createSecretBox([k1]);
    expect(b.open(b.seal('SECRET'))).toBe('SECRET');
  });

  it('형식 v1.<8hex>.…', () => {
    expect(createSecretBox([k1]).seal('x')).toMatch(/^v1\.[0-9a-f]{8}\.[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('같은 평문도 봉인할 때마다 다르다(IV 무작위)', () => {
    const b = createSecretBox([k1]);
    expect(b.seal('x')).not.toBe(b.seal('x'));
  });

  it('키 교체: 옛 키로 봉인한 값을 새 목록으로 열고, 새 봉인은 첫 키를 쓴다', () => {
    const sealed = createSecretBox([k1]).seal('x');
    const rotated = createSecretBox([k2, k1]);
    expect(rotated.open(sealed)).toBe('x');
    expect(createSecretBox([k2]).open(rotated.seal('y'))).toBe('y');
  });

  it('모르는 키·변조는 오류', () => {
    const sealed = createSecretBox([k1]).seal('x');
    expect(() => createSecretBox([k2]).open(sealed)).toThrow();
    const parts = sealed.split('.');
    parts[4] = Buffer.alloc(16).toString('base64url');
    expect(() => createSecretBox([k1]).open(parts.join('.'))).toThrow();
    expect(() => createSecretBox([k1]).open('garbage')).toThrow();
  });

  it('32바이트가 아닌 키·빈 목록은 생성 시 오류', () => {
    expect(() => createSecretBox([Buffer.alloc(16).toString('base64')])).toThrow(
      'MFA encryption key must be 32 bytes (base64)',
    );
    expect(() => createSecretBox([])).toThrow('MFA encryption key must be 32 bytes (base64)');
  });
});
