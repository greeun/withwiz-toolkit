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
  it('마스크 범위 0~32 밖 → false (fail-open 방지)', () => {
    expect(isIpInCidr('192.99.99.99', '192.168.1.0/40')).toBe(false); // /40이 /8로 오작동 방지
    expect(isIpInCidr('1.2.3.4', '1.2.3.0/33')).toBe(false);
    expect(isIpInCidr('1.2.3.4', '1.2.3.0/-1')).toBe(false);
  });
  it('옥텟 0~255 밖 → false', () => {
    expect(isIpInCidr('999.1.1.1', '231.1.1.1/32')).toBe(false); // 999&0xFF=231 매칭 방지
    expect(isIpInCidr('1.2.3.4', '999.1.1.0/24')).toBe(false);
  });
});
