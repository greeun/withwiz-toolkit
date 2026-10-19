/**
 * URL 문자열 기반 SSRF 방어
 *
 * - 비공인 IP 대역 차단(사설·루프백·링크 로컬·CGNAT·멀티캐스트·예약, IPv6 내부 주소)
 * - IP 인코딩 우회 방지(10진수·16진수·8진수, IPv4-mapped IPv6)
 * - 클라우드 메타데이터 호스트명, DNS rebinding 서비스 도메인 차단
 * - 유니코드 마침표 정규화, null byte·protocol-relative URL 차단
 *
 * 문자열만 검사하므로 "공개 도메인 → 사설 IP" A 레코드와 리다이렉트 우회는 막지 못한다.
 * 서버에서 실제로 요청을 보낼 때는 `core/security/safe-fetch` 의 `safeFetch` 를 쓴다.
 */
import type { TLocale } from '@withwiz/toolkit/core/error/messages/types';
import { isNonPublicIPv4, isNonPublicIPv6 } from '@withwiz/toolkit/core/security/ip-classification';
import {
  getSsrfBlockMessage,
  type ISsrfMessageParams,
  type TSsrfBlockCode,
} from '@withwiz/toolkit/core/security/ssrf-messages';

/** 임의 IP 로 해석되는 와일드카드 DNS 서비스 */
const DNS_REBINDING_DOMAINS = ['nip.io', 'xip.io', 'sslip.io', 'localtest.me'];

/** 클라우드 메타데이터 엔드포인트 호스트명 */
const BLOCKED_HOSTNAMES = ['metadata.google.internal', 'metadata.internal'];

/** SSRF 검사 대상인 HTTP 계열 스킴. 그 밖의 앱 스킴(딥링크 등)은 요청 대상이 아니므로 통과시킨다. */
const HTTP_LIKE_SCHEMES = ['http', 'https', 'ftp', 'ftps'];

/** 스크립트 실행·로컬 자원 접근에 쓰이는 스킴 */
const DANGEROUS_SCHEMES = ['javascript', 'data', 'file', 'vbscript', 'about', 'chrome', 'chrome-extension'];

/**
 * 유니코드 마침표(U+3002 。, U+FF0E ．, U+FF61 ｡)를 ASCII 마침표로 정규화
 */
function normalizeUnicodeDots(hostname: string): string {
  return hostname.replace(/[。．｡]/g, '.');
}

/**
 * 8진수 옥텟이 섞인 IPv4 를 10진수 dotted 형식으로 변환 (0177.0.0.1 → 127.0.0.1)
 */
function parseOctalIP(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  if (!parts.some((p) => /^0\d+$/.test(p))) return null;

  const decimals = parts.map((p) => {
    const val = /^0\d+$/.test(p) ? parseInt(p, 8) : parseInt(p, 10);
    return isNaN(val) || val < 0 || val > 255 ? -1 : val;
  });
  if (decimals.some((d) => d === -1)) return null;
  return decimals.join('.');
}

/**
 * 16진수 IPv4 를 10진수 dotted 형식으로 변환 (0x7f000001, 0x7f.0x00.0x00.0x01 → 127.0.0.1)
 */
function parseHexIP(hostname: string): string | null {
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    const num = parseInt(hostname, 16);
    if (isNaN(num) || num < 0 || num > 0xffffffff) return null;
    return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join('.');
  }

  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  if (!parts.some((p) => /^0x[0-9a-f]+$/i.test(p))) return null;

  const decimals = parts.map((p) => {
    const val = /^0x[0-9a-f]+$/i.test(p) ? parseInt(p, 16) : parseInt(p, 10);
    return isNaN(val) || val < 0 || val > 255 ? -1 : val;
  });
  if (decimals.some((d) => d === -1)) return null;
  return decimals.join('.');
}

/**
 * 10진수 정수 IPv4 를 dotted 형식으로 변환 (2130706433 → 127.0.0.1)
 */
function parseDecimalIP(hostname: string): string | null {
  if (!/^\d+$/.test(hostname)) return null;
  const num = parseInt(hostname, 10);
  if (isNaN(num) || num < 0 || num > 0xffffffff) return null;
  return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join('.');
}

/**
 * hostname 이 내부(비공인) 주소인지 확인한다.
 *
 * IPv4·IPv6 리터럴, `localhost`, 10진수·16진수·8진수 인코딩, IPv4-mapped IPv6 를 모두 해석한다.
 * 빈 값은 안전하지 않은 것으로 보고 true 를 반환한다.
 */
export function isInternalIP(hostname: string): boolean {
  if (!hostname) return true;

  const normalized = normalizeUnicodeDots(hostname.toLowerCase().trim());
  if (normalized === 'localhost') return true;

  const ipv6 = normalized.replace(/^\[|\]$/g, '');
  if (ipv6.includes(':')) return isNonPublicIPv6(ipv6);

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) return isNonPublicIPv4(normalized);

  const decoded = parseDecimalIP(normalized) ?? parseHexIP(normalized) ?? parseOctalIP(normalized);
  if (decoded) return isNonPublicIPv4(decoded);

  return false;
}

function isDNSRebindingDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return DNS_REBINDING_DOMAINS.some((domain) => lower === domain || lower.endsWith(`.${domain}`));
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.some((blocked) => lower === blocked || lower.endsWith(`.${blocked}`));
}

/**
 * 서브도메인에 비공인 IPv4 가 들어 있는지 확인 (127.0.0.1.attacker.example)
 */
function hasInternalIPInSubdomain(hostname: string): boolean {
  const match = hostname.match(/(?:^|\.)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\.|$)/);
  return match ? isNonPublicIPv4(match[1]) : false;
}

export interface ISSRFCheckOptions {
  /** `reason` 문구 로케일. 기본 `ko` */
  locale?: TLocale;
}

export interface ISSRFCheckResult {
  safe: boolean;
  /** 차단 사유 코드 (safe 가 false 일 때) */
  code?: TSsrfBlockCode;
  /** 차단 사유 문구 (safe 가 false 일 때, `options.locale` 기준) */
  reason?: string;
}

/**
 * URL 이 SSRF 공격에 안전한지 문자열 기준으로 검증한다.
 *
 * - 프로토콜이 없으면 `https://` 를 붙여 해석한다(`example.com`, `localhost:3000`).
 * - HTTP 계열이 아닌 앱 스킴은 요청 대상이 아니므로 통과시키고, 위험 스킴은 차단한다.
 */
export function isSSRFSafe(url: string, options: ISSRFCheckOptions = {}): ISSRFCheckResult {
  const block = (code: TSsrfBlockCode, params?: ISsrfMessageParams): ISSRFCheckResult => ({
    safe: false,
    code,
    reason: getSsrfBlockMessage(code, options.locale, params),
  });

  try {
    if (url.includes('\0') || url.includes('%00')) return block('NULL_BYTE');

    // //evil.example, /\evil.example — redirect 대상으로 쓰이면 외부 도메인으로 이동한다(Open Redirect)
    if (/^\/[\\/]/.test(url)) return block('PROTOCOL_RELATIVE');

    const normalizedUrl = normalizeUnicodeDots(url);
    // "scheme:" 형태이되 "host:port"(localhost:3000)는 스킴으로 보지 않는다
    const protocolMatch = normalizedUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    const hasProtocol = protocolMatch ? !/^\d+/.test(normalizedUrl.slice(protocolMatch[0].length)) : false;

    if (hasProtocol) {
      const scheme = normalizedUrl.split(':')[0].toLowerCase();
      if (DANGEROUS_SCHEMES.includes(scheme)) return block('DANGEROUS_SCHEME', { scheme });
      if (!HTTP_LIKE_SCHEMES.includes(scheme)) return { safe: true };
    }

    const parsed = new URL(hasProtocol ? normalizedUrl : `https://${normalizedUrl}`);
    const hostname = parsed.hostname;

    if (!hostname) return block('MISSING_HOSTNAME');
    if (isInternalIP(hostname)) return block('PRIVATE_IP');
    if (hasInternalIPInSubdomain(hostname)) return block('PRIVATE_IP_IN_SUBDOMAIN');
    if (isDNSRebindingDomain(hostname)) return block('DNS_REBINDING_DOMAIN');
    if (isBlockedHostname(hostname)) return block('BLOCKED_HOSTNAME');

    return { safe: true };
  } catch {
    return block('INVALID_URL');
  }
}
