/**
 * SSRF 차단 사유 코드·다국어 문구 테스트
 *
 * 테스트 범위:
 * - isSSRFSafe 의 code 와 locale 별 reason
 * - getSsrfBlockMessage 치환 값과 미지원 로케일 폴백
 * - 멀티캐스트·예약 대역 차단
 */
import { isSSRFSafe, isInternalIP } from '@withwiz/toolkit/core/security/url-security';
import { getSsrfBlockMessage } from '@withwiz/toolkit/core/security/ssrf-messages';

describe('isSSRFSafe code', () => {
  it.each([
    ['http://127.0.0.1/', 'PRIVATE_IP'],
    ['http://example.com/%00', 'NULL_BYTE'],
    ['//evil.example', 'PROTOCOL_RELATIVE'],
    ['javascript:alert(1)', 'DANGEROUS_SCHEME'],
    ['http://127.0.0.1.attacker.example/', 'PRIVATE_IP_IN_SUBDOMAIN'],
    ['http://10.0.0.1.nip.io/', 'PRIVATE_IP_IN_SUBDOMAIN'],
    ['http://app.nip.io/', 'DNS_REBINDING_DOMAIN'],
    ['http://metadata.google.internal/', 'BLOCKED_HOSTNAME'],
    ['http://[invalid', 'INVALID_URL'],
  ])('%s → %s', (url, code) => {
    const result = isSSRFSafe(url);
    expect(result.safe).toBe(false);
    expect(result.code).toBe(code);
  });

  it('안전한 URL 은 code 와 reason 이 없다', () => {
    expect(isSSRFSafe('https://example.com/path')).toEqual({ safe: true });
  });

  it('기본 로케일(ko) 문구를 reason 으로 채운다', () => {
    expect(isSSRFSafe('http://127.0.0.1/').reason).toBe('내부 네트워크 주소(사설 IP)는 허용되지 않습니다');
  });

  it('locale 옵션에 맞는 문구를 채운다', () => {
    expect(isSSRFSafe('http://127.0.0.1/', { locale: 'en' }).reason).toBe(
      'Internal network addresses (private IPs) are not allowed',
    );
    expect(isSSRFSafe('javascript:alert(1)', { locale: 'ja' }).reason).toBe('危険なURLスキームです: javascript:');
  });

  it('멀티캐스트·예약 대역도 내부 주소로 차단한다', () => {
    expect(isInternalIP('224.0.0.1')).toBe(true);
    expect(isInternalIP('240.0.0.1')).toBe(true);
    expect(isSSRFSafe('http://239.255.255.250/').code).toBe('PRIVATE_IP');
  });
});

describe('getSsrfBlockMessage', () => {
  it('치환 값을 문구에 넣는다', () => {
    expect(getSsrfBlockMessage('DISALLOWED_PROTOCOL', 'en', { protocol: 'ftp:' })).toBe('Protocol not allowed: ftp:');
  });

  it('지원하지 않는 로케일이면 ko 문구를 쓴다', () => {
    expect(getSsrfBlockMessage('TOO_MANY_REDIRECTS', 'fr' as never)).toBe('리다이렉트 횟수가 너무 많습니다');
  });
});
