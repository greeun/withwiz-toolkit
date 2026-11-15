/**
 * JSON-LD 직렬화
 *
 * `<script type="application/ld+json">` 안에 그대로 넣을 수 있는 JSON 문자열을 만든다.
 * `JSON.stringify` 는 `<` 를 이스케이프하지 않으므로, 사용자 입력에 든 `</script>` 가 요소를 닫아
 * 스크립트 삽입(XSS)으로 이어질 수 있다. `<`·`>`·`&` 와 줄 구분자 U+2028·U+2029 를 `\uXXXX` 로 바꾼다.
 * 이 문자들은 JSON 문자열 값 안에만 나타나므로 `JSON.parse` 결과는 원래 값과 같다.
 *
 * @example
 * ```tsx
 * <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
 * ```
 */

const UNSAFE_CHARS = /[<>&\u2028\u2029]/g;

const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/**
 * @throws {TypeError} `JSON.stringify` 가 문자열을 만들지 못하는 값(`undefined`, 함수 등)
 */
export function serializeJsonLd(data: unknown): string {
  const json = JSON.stringify(data);
  if (json === undefined) {
    throw new TypeError('serializeJsonLd: value is not JSON-serializable');
  }
  return json.replace(UNSAFE_CHARS, (ch) => ESCAPES[ch]);
}
