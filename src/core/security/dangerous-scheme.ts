/**
 * 위험 URL 스킴 판정
 *
 * 입력 검증을 통과했거나 우회한 값(과거 레코드, 직접 저장된 값 등)을 리다이렉트·링크 출력 직전에
 * 한 번 더 걸러내는 안전망이다.
 *
 * `core/utils/sanitizer` 의 `sanitizeUrl` 은 HTML 출력용으로 `data:image/*` 를 허용하지만,
 * 이 함수는 리다이렉트 대상 판정용이라 `data:` 전체와 `file:`·`blob:` 까지 위험으로 본다.
 */

const DANGEROUS_SCHEMES = new Set(['javascript', 'vbscript', 'data', 'file', 'blob']);

const SCHEME_REGEX = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/**
 * URL 이 위험 스킴(javascript:/vbscript:/data:/file:/blob:)인지 판정한다.
 * - 스킴이 없으면(`example.com`) false
 * - 그 밖의 스킴(http/https/ftp/앱 딥링크 등)은 false
 */
export function isDangerousUrlScheme(url: string): boolean {
  if (!url) return false;
  const match = url.trim().match(SCHEME_REGEX);
  if (!match) return false;
  return DANGEROUS_SCHEMES.has(match[1].toLowerCase());
}
