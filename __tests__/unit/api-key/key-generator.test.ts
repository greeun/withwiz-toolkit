import { describe, it, expect } from 'vitest';
import { generateRawKey, hashKey, keyPreview } from '../../../src/core/api-key/key-generator';

describe('key-generator', () => {
  it('generateRawKey: prefix로 시작하고 prefix+64 hex 길이', () => {
    const key = generateRawKey('sk_test_');
    expect(key.startsWith('sk_test_')).toBe(true);
    expect(key.length).toBe('sk_test_'.length + 64); // 32 bytes hex
  });

  it('generateRawKey: 매 호출 고유', () => {
    expect(generateRawKey('sk_test_')).not.toBe(generateRawKey('sk_test_'));
  });

  it('hashKey: 동일 입력 → 동일 sha256 hex(64자), 결정적', () => {
    const h1 = hashKey('sk_test_abc');
    const h2 = hashKey('sk_test_abc');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keyPreview: 처음10+...+마지막4', () => {
    const hash = 'a'.repeat(10) + 'b'.repeat(50) + 'cccc';
    expect(keyPreview(hash)).toBe('aaaaaaaaaa...cccc');
  });

  it('keyPreview: 14자 미만이면 원본', () => {
    expect(keyPreview('short')).toBe('short');
  });
});
