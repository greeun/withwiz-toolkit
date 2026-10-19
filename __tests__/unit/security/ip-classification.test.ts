/**
 * IP 분류 테스트
 *
 * 테스트 범위:
 * - IPv4 비공인 대역(사설·루프백·링크 로컬·CGNAT·멀티캐스트·예약)
 * - IPv6 비공인 대역(루프백·미지정·링크 로컬·고유 로컬·IPv4-mapped)
 * - isPrivateIP 와 판정 기준 일치
 */
import {
  isNonPublicIP,
  isNonPublicIPv4,
  isNonPublicIPv6,
} from '@withwiz/toolkit/core/security/ip-classification';
import { isPrivateIP } from '@withwiz/toolkit/core/utils/ip-utils';

describe('isNonPublicIPv4', () => {
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '100.127.255.255',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '224.0.0.1',
    '239.255.255.250',
    '240.0.0.1',
    '255.255.255.255',
  ])('%s 는 비공인 주소다', (ip) => {
    expect(isNonPublicIPv4(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '100.63.255.255', '100.128.0.1', '172.15.0.1', '172.32.0.1', '223.255.255.255'])(
    '%s 는 공인 주소다',
    (ip) => {
      expect(isNonPublicIPv4(ip)).toBe(false);
    },
  );

  it.each(['256.0.0.1', '1.2.3', '1.2.3.4.5', 'a.b.c.d', ''])('형식이 틀린 %s 는 false', (ip) => {
    expect(isNonPublicIPv4(ip)).toBe(false);
  });
});

describe('isNonPublicIPv6', () => {
  it.each(['::1', '::', 'fe80::1', 'febf::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:7f00:1'])(
    '%s 는 비공인 주소다',
    (ip) => {
      expect(isNonPublicIPv6(ip)).toBe(true);
    },
  );

  it.each(['2001:4860:4860::8888', '::ffff:8.8.8.8', 'fec0::1'])('%s 는 공인 주소로 본다', (ip) => {
    expect(isNonPublicIPv6(ip)).toBe(false);
  });
});

describe('isNonPublicIP', () => {
  it('빈 값은 false', () => {
    expect(isNonPublicIP('')).toBe(false);
  });

  it('isPrivateIP 와 같은 판정을 한다', () => {
    for (const ip of ['10.0.0.1', '100.64.0.1', '8.8.8.8', '::1', 'fd00::1', '2001:db8::1', '230.1.1.1']) {
      expect(isPrivateIP(ip)).toBe(isNonPublicIP(ip));
    }
  });
});
