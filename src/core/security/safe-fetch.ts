/**
 * SSRF 방어가 적용된 서버측 fetch
 *
 * `isSSRFSafe` 는 URL "문자열"만 검사하므로 두 가지 우회가 남는다.
 *   1) 공개 도메인의 A 레코드가 사설 IP(169.254.169.254, 127.0.0.1 등)를 가리키는 경우
 *   2) 공개 호스트가 3xx 리다이렉트로 내부 주소를 돌려주는 경우
 *
 * 이 모듈은 두 경로를 모두 막는다.
 *   - DNS 해석 결과의 모든 IP 를 `isInternalIP` 로 검증한다.
 *   - 리다이렉트를 직접 따라가며 매 홉의 URL 을 다시 검증한다.
 *
 * `node:dns` 를 쓰므로 Node.js 런타임 전용이다(브라우저·엣지 런타임 불가).
 * 같은 이유로 `core/security` 인덱스에서 내보내지 않고 이 경로로만 import 한다.
 */
import { lookup } from 'node:dns/promises';
import type { TLocale } from '@withwiz/toolkit/core/error/messages/types';
import { isInternalIP, isSSRFSafe } from '@withwiz/toolkit/core/security/url-security';
import {
  getSsrfBlockMessage,
  type ISsrfMessageParams,
  type TSsrfBlockCode,
} from '@withwiz/toolkit/core/security/ssrf-messages';

/**
 * SSRF 방어로 요청이 차단되었음을 나타내는 에러.
 * 호출 측은 이 에러를 잡아 실패로 처리한다.
 */
export class SSRFBlockedError extends Error {
  readonly code: TSsrfBlockCode;

  constructor(code: TSsrfBlockCode, message: string) {
    super(message);
    this.name = 'SSRFBlockedError';
    this.code = code;
  }
}

export interface ISafeFetchOptions {
  /** 차단 에러 메시지 로케일. 기본 `ko` */
  locale?: TLocale;
  /** 리다이렉트 최대 추적 횟수. 기본 5 */
  maxRedirects?: number;
}

const DEFAULT_MAX_REDIRECTS = 5;

/**
 * 프로토콜이 없는 URL 은 https 로 보정해 절대 URL 로 만든다.
 */
function toAbsoluteUrl(raw: string): URL {
  try {
    return new URL(raw);
  } catch {
    return new URL(`https://${raw}`);
  }
}

/**
 * URL 이 공인 주소로만 향하는지 검증한다.
 * - 문자열 검사(`isSSRFSafe`)
 * - http/https 스킴만 허용
 * - DNS 해석 결과의 모든 IP 가 공인 IP 인지 확인
 *
 * @throws {SSRFBlockedError}
 */
async function assertPublicUrl(target: URL, locale: TLocale | undefined): Promise<void> {
  const fail = (code: TSsrfBlockCode, params?: ISsrfMessageParams): never => {
    throw new SSRFBlockedError(code, getSsrfBlockMessage(code, locale, params));
  };

  const check = isSSRFSafe(target.toString(), { locale });
  if (!check.safe) fail(check.code ?? 'INVALID_URL');

  // 리다이렉트가 앱 딥링크 등 비-HTTP 스킴으로 빠지는 것을 막는다
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    fail('DISALLOWED_PROTOCOL', { protocol: target.protocol });
  }

  let records: Array<{ address: string }> = [];
  try {
    records = await lookup(target.hostname, { all: true });
  } catch {
    fail('DNS_LOOKUP_FAILED');
  }
  if (records.length === 0) fail('DNS_NO_RESULT');
  for (const { address } of records) {
    if (isInternalIP(address)) fail('RESOLVES_TO_PRIVATE_IP');
  }
}

/**
 * SSRF 방어가 적용된 fetch.
 *
 * 리다이렉트를 직접 따라가며 매 홉의 URL 을 재검증한다.
 * `init.signal`(타임아웃 등)은 리다이렉트 체인 전체에 적용된다.
 *
 * @param url - 요청할 URL (프로토콜 생략 시 https 보정)
 * @param init - fetch 옵션 (`redirect` 는 내부에서 `manual` 로 강제한다)
 * @returns 최종 응답 (3xx 가 아니거나 Location 이 없는 3xx)
 * @throws {SSRFBlockedError} 어느 홉이든 내부 주소로 향하거나 리다이렉트가 너무 많은 경우
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  options: ISafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let current = toAbsoluteUrl(url);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current, options.locale);

    const response = await fetch(current.toString(), { ...init, redirect: 'manual' });

    const isRedirect = response.status >= 300 && response.status < 400 && response.status !== 304;
    if (!isRedirect) return response;

    const location = response.headers.get('location');
    if (!location) return response;
    current = new URL(location, current);
  }

  throw new SSRFBlockedError(
    'TOO_MANY_REDIRECTS',
    getSsrfBlockMessage('TOO_MANY_REDIRECTS', options.locale),
  );
}
