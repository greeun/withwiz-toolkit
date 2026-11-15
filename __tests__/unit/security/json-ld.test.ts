/**
 * JSON-LD 직렬화 테스트
 *
 * 테스트 범위:
 * - `</script>`·`<!--` 등 HTML 파서가 해석할 문자를 이스케이프
 * - U+2028·U+2029 이스케이프
 * - JSON.parse 왕복 시 원래 값 보존
 */
import { serializeJsonLd } from '@withwiz/toolkit/core/security/json-ld';
import { serializeJsonLd as fromIndex } from '@withwiz/toolkit/core/security';

describe('serializeJsonLd', () => {
  it('</script> 를 그대로 남기지 않는다', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out.toLowerCase()).not.toContain('</script');
  });

  it('<!-- 와 & 도 이스케이프한다', () => {
    const out = serializeJsonLd({ a: '<!-- x -->', b: 'a&b' });
    expect(out).not.toMatch(/[<>&]/);
  });

  it('U+2028·U+2029 를 이스케이프한다', () => {
    const out = serializeJsonLd({ s: 'a\u2028b\u2029c' });
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });

  it('JSON.parse 하면 원래 값과 같다', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: '</script><b>굵게</b> & "따옴표" \u2028\u2029',
      nested: [{ x: 1, y: null, z: true }, '<>&'],
    };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('직렬화할 수 없는 값이면 TypeError 를 던진다', () => {
    expect(() => serializeJsonLd(undefined)).toThrow(TypeError);
  });

  it('core/security 인덱스에서도 내보낸다', () => {
    expect(fromIndex).toBe(serializeJsonLd);
  });
});
