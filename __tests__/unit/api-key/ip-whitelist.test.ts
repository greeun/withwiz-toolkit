import { describe, it, expect } from 'vitest';
import { isIpAllowed, isIpInCidr } from '../../../src/core/api-key/ip-whitelist';

describe('ip-whitelist', () => {
  it('빈/null 화이트리스트 → 모두 허용', () => {
    expect(isIpAllowed('1.2.3.4', null)).toBe(true);
    expect(isIpAllowed('1.2.3.4', [])).toBe(true);
  });
  it('단일 IP 정확 일치', () => {
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4'])).toBe(true);
    expect(isIpAllowed('1.2.3.5', ['1.2.3.4'])).toBe(false);
  });
  it('IPv6-mapped IPv4 정규화', () => {
    expect(isIpAllowed('::ffff:1.2.3.4', ['1.2.3.4'])).toBe(true);
  });
  it('CIDR 범위 포함', () => {
    expect(isIpInCidr('192.168.1.5', '192.168.1.0/24')).toBe(true);
    expect(isIpInCidr('192.168.2.5', '192.168.1.0/24')).toBe(false);
    expect(isIpAllowed('10.0.0.9', ['10.0.0.0/8'])).toBe(true);
  });
  it('잘못된 CIDR → false (throw 안 함)', () => {
    expect(isIpInCidr('1.2.3.4', 'garbage')).toBe(false);
  });
});
