/**
 * URL 스킴 판정의 제어 문자 우회 방지
 *
 * 브라우저는 URL 파싱 전에 탭·개행을 모두 제거하고 앞쪽 C0 제어 문자·공백을 잘라낸다.
 * 판정도 같은 기준으로 해야 `java\tscript:` 가 통과하지 않는다. 정상 URL 의 반환값은 바뀌면 안 된다.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from '@withwiz/toolkit/core/utils/sanitizer';
import { isDangerousUrlScheme } from '@withwiz/toolkit/core/security/dangerous-scheme';

const bypasses = [
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'java\r\nscript:alert(1)',
  '\u0001javascript:alert(1)',
  ' \u0000 javascript:alert(1)',
  'vb\tscript:msgbox(1)',
];

describe('sanitizeUrl 제어 문자 우회', () => {
  it.each(bypasses)('%j 를 차단한다', (url) => {
    expect(sanitizeUrl(url)).toBe('');
  });

  it('탭이 끼어 있는 data:text/html 을 차단한다', () => {
    expect(sanitizeUrl('data:\ttext/html,<script>alert(1)</script>')).toBe('');
  });

  it.each([
    'https://example.com/a?b=1',
    '/relative/path',
    'tel:+821012345678',
    'mailto:a@example.com',
    'myapp://open/1',
    'data:image/png;base64,AAAA',
  ])('정상 URL %s 은 그대로 반환한다', (url) => {
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('위험하지 않은 URL 은 제어 문자를 지우지 않고 기존처럼 trim 만 한다', () => {
    expect(sanitizeUrl('  https://example.com/a\tb  ')).toBe('https://example.com/a\tb');
  });
});

describe('isDangerousUrlScheme 제어 문자 우회', () => {
  it.each(bypasses)('%j 를 위험으로 판정한다', (url) => {
    expect(isDangerousUrlScheme(url)).toBe(true);
  });

  it.each(['https://example.com', 'ht\ttps://example.com', 'example.com', 'tel:+821012345678', 'myapp://x'])(
    '%j 는 위험으로 판정하지 않는다',
    (url) => {
      expect(isDangerousUrlScheme(url)).toBe(false);
    },
  );
});
