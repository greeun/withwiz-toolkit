/**
 * url-security.ts 유닛 테스트
 * - isInternalIP: 내부 IP 감지
 * - isSSRFSafe: SSRF 안전성 검증
 */
import { describe, it, expect } from 'vitest';
import { isInternalIP, isSSRFSafe } from '@withwiz/toolkit/core/security/url-security';

// ============================================================================
// isInternalIP
// ============================================================================
describe('isInternalIP', () => {
  describe('내부 IP 감지', () => {
    it.each([
      ['127.0.0.1', 'loopback IPv4'],
      ['10.0.0.1', 'Class A private'],
      ['172.16.0.1', 'Class B private 시작'],
      ['172.31.255.255', 'Class B private 끝'],
      ['192.168.1.1', 'Class C private'],
      ['169.254.169.254', 'link-local / cloud metadata'],
      ['0.0.0.0', '현재 네트워크'],
      ['100.64.0.1', 'CGNAT'],
      ['localhost', 'localhost 문자열'],
    ])('%s — %s → true', (hostname) => {
      expect(isInternalIP(hostname)).toBe(true);
    });
  });

  describe('외부 IP 감지', () => {
    it.each([
      ['8.8.8.8', 'Google DNS'],
      ['1.1.1.1', 'Cloudflare DNS'],
      ['203.0.113.1', '공인 IP'],
      ['172.32.0.1', 'Class B 범위 밖'],
      ['100.128.0.1', 'CGNAT 범위 밖'],
    ])('%s — %s → false', (hostname) => {
      expect(isInternalIP(hostname)).toBe(false);
    });
  });

  describe('IPv6 내부 주소', () => {
    it.each([
      ['::1', 'IPv6 loopback'],
      ['::', 'IPv6 unspecified'],
      ['::ffff:127.0.0.1', 'IPv4-mapped IPv6 loopback'],
      ['::ffff:10.0.0.1', 'IPv4-mapped IPv6 private'],
    ])('%s — %s → true', (hostname) => {
      expect(isInternalIP(hostname)).toBe(true);
    });
  });

  describe('IP 인코딩 우회 방지', () => {
    it('10진수 IP (2130706433 = 127.0.0.1)', () => {
      expect(isInternalIP('2130706433')).toBe(true);
    });

    it('16진수 IP (0x7f000001 = 127.0.0.1)', () => {
      expect(isInternalIP('0x7f000001')).toBe(true);
    });

    it('8진수 IP (0177.0.0.1 = 127.0.0.1)', () => {
      expect(isInternalIP('0177.0.0.1')).toBe(true);
    });
  });

  describe('엣지 케이스', () => {
    it('빈 문자열은 true 반환', () => {
      expect(isInternalIP('')).toBe(true);
    });

    it('255.255.255.255 broadcast', () => {
      expect(isInternalIP('255.255.255.255')).toBe(true);
    });

    it('유니코드 마침표 정규화', () => {
      // U+3002 (。) → .
      expect(isInternalIP('127\u30020\u30020\u30021')).toBe(true);
    });
  });
});

// ============================================================================
// isSSRFSafe
// ============================================================================
describe('isSSRFSafe', () => {
  describe('안전한 URL', () => {
    it.each([
      ['https://google.com', 'Google'],
      ['https://example.com/path?q=1', '쿼리 포함 URL'],
      ['http://example.org', 'HTTP URL'],
      ['https://sub.domain.com', '서브도메인 URL'],
    ])('%s — %s', (url) => {
      const result = isSSRFSafe(url);
      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(typeof result.safe).toBe('boolean');
    });
  });

  describe('커스텀 스킴 (딥링크/앱 스킴) 허용', () => {
    it.each([
      ['appstore://13roihfn.qwlghd.asd.com', 'App Store 딥링크'],
      ['market://details?id=com.example.app', 'Google Play 마켓'],
      ['itms-apps://apps.apple.com/app/id123456', 'iTunes 앱 스토어'],
      ['kakaotalk://open/profile/1234', '카카오톡 딥링크'],
      ['instagram://user?username=test', '인스타그램 딥링크'],
      ['spotify://track/4uLU6hMCjMI75M1A2tKUQC', 'Spotify 딥링크'],
      ['mailto:test@example.com', '메일 주소'],
      ['tel:+821012345678', '전화번호'],
      ['sms:+821012345678?body=hello', 'SMS 링크'],
      ['line://msg/text/hello', 'Line 딥링크'],
      ['fb://page/123456', 'Facebook 딥링크'],
      ['zoom://join?confno=123456', 'Zoom 미팅 링크'],
    ])('%s — %s → safe', (url) => {
      const result = isSSRFSafe(url);
      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('위험한 스킴 차단', () => {
    it.each([
      ['javascript:alert(1)', 'XSS javascript:'],
      ['data:text/html,<script>alert(1)</script>', 'data: XSS'],
      ['file:///etc/passwd', '로컬 파일 접근'],
      ['vbscript:MsgBox("xss")', 'VBScript'],
    ])('%s — %s → 차단', (url) => {
      const result = isSSRFSafe(url);
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('위험한 URL 스킴');
    });
  });

  describe('내부 IP URL 차단', () => {
    it.each([
      ['http://127.0.0.1', 'loopback'],
      ['http://10.0.0.1:8080', 'private IP with port'],
      ['http://192.168.1.1', 'Class C private'],
      ['http://localhost', 'localhost'],
      ['http://169.254.169.254/latest/meta-data/', 'AWS metadata'],
    ])('%s — %s', (url) => {
      const result = isSSRFSafe(url);
      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });
  });

  describe('DNS rebinding 도메인 차단', () => {
    it.each([
      ['http://evil.nip.io', 'nip.io'],
      ['http://evil.xip.io', 'xip.io'],
      ['http://evil.sslip.io', 'sslip.io'],
      ['http://evil.localtest.me', 'localtest.me'],
    ])('%s — %s', (url) => {
      const result = isSSRFSafe(url);
      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('DNS rebinding');
    });
  });

  describe('차단된 호스트명', () => {
    it.each([
      ['http://metadata.google.internal', 'GCP metadata'],
      ['http://metadata.internal', 'generic metadata'],
    ])('%s — %s', (url) => {
      const result = isSSRFSafe(url);
      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });
  });

  describe('null byte 차단', () => {
    it('null byte 포함 URL', () => {
      const result = isSSRFSafe('https://example.com\0');
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('null byte');
    });

    it('URL 인코딩된 null byte', () => {
      const result = isSSRFSafe('https://example.com%00');
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('null byte');
    });
  });

  describe('프로토콜 없는 URL (bare domain)', () => {
    it.each([
      ['grim.com', '단순 도메인'],
      ['example.com/path?q=1', '경로+쿼리 포함'],
      ['sub.domain.co.kr', '서브도메인'],
      ['naver.com', '한국 도메인'],
    ])('%s — %s → safe', (url) => {
      const result = isSSRFSafe(url);
      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it.each([
      ['localhost', 'localhost 문자열'],
      ['127.0.0.1', 'loopback IP'],
      ['10.0.0.1', 'private IP'],
      ['192.168.1.1', 'Class C private'],
    ])('%s — %s → 내부 주소 차단', (url) => {
      const result = isSSRFSafe(url);
      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('잘못된 URL', () => {
    it('파싱 불가 URL은 결과를 반환한다', () => {
      const result = isSSRFSafe('not-a-url');
      expect(result).toBeDefined();
      expect(typeof result.safe).toBe('boolean');
      expect(result).toHaveProperty('safe');
    });
  });

  describe('IP 인코딩 우회 차단', () => {
    it('10진수 IP URL (2130706433)', () => {
      const result = isSSRFSafe('http://2130706433');
      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });

    it('16진수 IP URL (0x7f000001)', () => {
      const result = isSSRFSafe('http://0x7f000001');
      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });
  });

  describe('서브도메인에 내부 IP 포함 차단', () => {
    it('127.0.0.1.attacker.com', () => {
      const result = isSSRFSafe('http://127.0.0.1.attacker.com');
      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('내부 IP');
    });
  });
});
