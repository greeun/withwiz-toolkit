/**
 * SSRF 차단 사유 코드와 다국어 메시지
 *
 * `isSSRFSafe` 와 `safeFetch` 는 차단 사유를 코드(`TSsrfBlockCode`)로 돌려주고,
 * 요청 로케일에 맞는 문구를 `reason`/`message` 로 함께 채운다(기본 로케일 `ko`).
 * 소비 측에서 문구를 바꾸려면 코드를 기준으로 직접 매핑한다.
 */
import type { TLocale } from '@withwiz/toolkit/core/error/messages/types';

export type TSsrfBlockCode =
  | 'NULL_BYTE'
  | 'PROTOCOL_RELATIVE'
  | 'DANGEROUS_SCHEME'
  | 'MISSING_HOSTNAME'
  | 'PRIVATE_IP'
  | 'PRIVATE_IP_IN_SUBDOMAIN'
  | 'DNS_REBINDING_DOMAIN'
  | 'BLOCKED_HOSTNAME'
  | 'INVALID_URL'
  | 'DISALLOWED_PROTOCOL'
  | 'DNS_LOOKUP_FAILED'
  | 'DNS_NO_RESULT'
  | 'RESOLVES_TO_PRIVATE_IP'
  | 'TOO_MANY_REDIRECTS';

/** 메시지 치환 값. DANGEROUS_SCHEME 은 `scheme`, DISALLOWED_PROTOCOL 은 `protocol` 을 쓴다. */
export interface ISsrfMessageParams {
  scheme?: string;
  protocol?: string;
}

type TMessageTable = Record<TSsrfBlockCode, (p: ISsrfMessageParams) => string>;

const ko: TMessageTable = {
  NULL_BYTE: () => 'URL에 null byte가 포함되어 있습니다',
  PROTOCOL_RELATIVE: () => 'protocol-relative URL은 허용되지 않습니다',
  DANGEROUS_SCHEME: (p) => `위험한 URL 스킴입니다: ${p.scheme ?? ''}:`,
  MISSING_HOSTNAME: () => 'URL에 호스트명이 없습니다',
  PRIVATE_IP: () => '내부 네트워크 주소(사설 IP)는 허용되지 않습니다',
  PRIVATE_IP_IN_SUBDOMAIN: () => '서브도메인에 내부 IP가 포함된 URL은 허용되지 않습니다',
  DNS_REBINDING_DOMAIN: () => 'DNS rebinding 위험이 있는 도메인은 허용되지 않습니다',
  BLOCKED_HOSTNAME: () => '차단된 호스트명입니다 (클라우드 메타데이터 엔드포인트)',
  INVALID_URL: () => 'URL 파싱에 실패했습니다',
  DISALLOWED_PROTOCOL: (p) => `허용되지 않는 프로토콜입니다: ${p.protocol ?? ''}`,
  DNS_LOOKUP_FAILED: () => 'DNS 해석에 실패했습니다',
  DNS_NO_RESULT: () => 'DNS 해석 결과가 없습니다',
  RESOLVES_TO_PRIVATE_IP: () => '내부 네트워크 주소로 해석되는 호스트입니다',
  TOO_MANY_REDIRECTS: () => '리다이렉트 횟수가 너무 많습니다',
};

const en: TMessageTable = {
  NULL_BYTE: () => 'URL contains a null byte',
  PROTOCOL_RELATIVE: () => 'Protocol-relative URLs are not allowed',
  DANGEROUS_SCHEME: (p) => `Dangerous URL scheme: ${p.scheme ?? ''}:`,
  MISSING_HOSTNAME: () => 'URL has no hostname',
  PRIVATE_IP: () => 'Internal network addresses (private IPs) are not allowed',
  PRIVATE_IP_IN_SUBDOMAIN: () => 'URLs with an internal IP in the subdomain are not allowed',
  DNS_REBINDING_DOMAIN: () => 'Domains with DNS rebinding risk are not allowed',
  BLOCKED_HOSTNAME: () => 'Blocked hostname (cloud metadata endpoint)',
  INVALID_URL: () => 'Failed to parse the URL',
  DISALLOWED_PROTOCOL: (p) => `Protocol not allowed: ${p.protocol ?? ''}`,
  DNS_LOOKUP_FAILED: () => 'DNS lookup failed',
  DNS_NO_RESULT: () => 'DNS lookup returned no addresses',
  RESOLVES_TO_PRIVATE_IP: () => 'Host resolves to an internal network address',
  TOO_MANY_REDIRECTS: () => 'Too many redirects',
};

const ja: TMessageTable = {
  NULL_BYTE: () => 'URLにヌルバイトが含まれています',
  PROTOCOL_RELATIVE: () => 'プロトコル相対URLは使用できません',
  DANGEROUS_SCHEME: (p) => `危険なURLスキームです: ${p.scheme ?? ''}:`,
  MISSING_HOSTNAME: () => 'URLにホスト名がありません',
  PRIVATE_IP: () => '内部ネットワークアドレス(プライベートIP)は使用できません',
  PRIVATE_IP_IN_SUBDOMAIN: () => 'サブドメインに内部IPを含むURLは使用できません',
  DNS_REBINDING_DOMAIN: () => 'DNSリバインディングの危険があるドメインは使用できません',
  BLOCKED_HOSTNAME: () => 'ブロックされたホスト名です(クラウドメタデータエンドポイント)',
  INVALID_URL: () => 'URLの解析に失敗しました',
  DISALLOWED_PROTOCOL: (p) => `許可されていないプロトコルです: ${p.protocol ?? ''}`,
  DNS_LOOKUP_FAILED: () => 'DNSの名前解決に失敗しました',
  DNS_NO_RESULT: () => 'DNSの名前解決結果がありません',
  RESOLVES_TO_PRIVATE_IP: () => '内部ネットワークアドレスに解決されるホストです',
  TOO_MANY_REDIRECTS: () => 'リダイレクト回数が多すぎます',
};

const TABLES: Record<TLocale, TMessageTable> = { ko, en, ja };

/**
 * 차단 사유 코드를 로케일 문구로 바꾼다. 지원하지 않는 로케일이면 `ko` 를 쓴다.
 */
export function getSsrfBlockMessage(
  code: TSsrfBlockCode,
  locale: TLocale = 'ko',
  params: ISsrfMessageParams = {},
): string {
  return (TABLES[locale] ?? TABLES.ko)[code](params);
}
