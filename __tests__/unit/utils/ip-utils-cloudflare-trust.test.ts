/**
 * extractClientIp 의 trustCloudflare 옵션
 *
 * Cloudflare 뒤가 아닌 배포에서는 CF-Connecting-IP·True-Client-IP 를 클라이언트가 직접
 * 써 넣을 수 있다. 옵션으로 끌 수 있어야 하고, 지정하지 않으면 기존 동작을 유지한다.
 */
import { describe, it, expect } from 'vitest';
import { extractClientIp } from '@withwiz/toolkit/core/utils/ip-utils';

const spoofed = {
  'cf-connecting-ip': '1.1.1.1',
  'true-client-ip': '2.2.2.2',
  'x-forwarded-for': '9.9.9.9, 8.8.8.8',
};

describe('extractClientIp trustCloudflare', () => {
  it('지정하지 않으면 기존처럼 CF-Connecting-IP 를 우선한다', () => {
    expect(extractClientIp(new Headers(spoofed))).toBe('1.1.1.1');
  });

  it('true 로 지정해도 기존과 같다', () => {
    expect(extractClientIp(new Headers(spoofed), { trustCloudflare: true })).toBe('1.1.1.1');
  });

  it('false 면 Cloudflare 헤더를 무시하고 X-Forwarded-For 를 읽는다', () => {
    expect(extractClientIp(new Headers(spoofed), { trustCloudflare: false })).toBe('8.8.8.8');
  });

  it('false 이고 Cloudflare 헤더만 있으면 null 을 반환한다', () => {
    const headers = new Headers({ 'cf-connecting-ip': '1.1.1.1', 'true-client-ip': '2.2.2.2' });
    expect(extractClientIp(headers, { trustCloudflare: false })).toBeNull();
  });

  it('false 일 때 trustedProxyHops 도 함께 적용한다', () => {
    expect(extractClientIp(new Headers(spoofed), { trustCloudflare: false, trustedProxyHops: 1 })).toBe('9.9.9.9');
  });
});
