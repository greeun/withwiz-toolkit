// IP 주소 관련 유틸리티 함수들
// /shared/ 내부에서 독립적으로 사용

// Private IP 주소 체크
export function isPrivateIP(ip: string): boolean {
  if (!ip) return false;
  
  // IPv4 private ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // 127.0.0.0/8 (localhost)
    /^169\.254\./,              // 169.254.0.0/16 (link-local)
    /^0\./,                     // 0.0.0.0/8
    /^224\./,                   // 224.0.0.0/4 (multicast)
    /^240\./,                   // 240.0.0.0/4 (reserved)
  ];
  
  // IPv6 private ranges
  const ipv6PrivateRanges = [
    /^::1$/,                    // localhost
    /^fe80:/,                   // link-local
    /^fc00:/,                   // unique local
    /^fd00:/,                   // unique local
  ];
  
  // IPv4 체크
  if (ip.includes('.')) {
    return privateRanges.some(range => range.test(ip));
  }
  
  // IPv6 체크
  if (ip.includes(':')) {
    return ipv6PrivateRanges.some(range => range.test(ip));
  }
  
  return false;
}

// IPv6 주소 체크
export function isIPv6(ip: string): boolean {
  return ip.includes(':');
}

// IP 주소 정규화
export function normalizeIP(ip: string): string {
  if (!ip) return '';
  
  // IPv6 축약형 처리
  if (isIPv6(ip)) {
    // 간단한 IPv6 정규화 (실제로는 더 복잡할 수 있음)
    return ip.toLowerCase();
  }
  
  return ip;
}

/** `extractClientIp` 의 X-Forwarded-For 해석 옵션. */
export interface ExtractClientIpOptions {
  /**
   * X-Forwarded-For 의 **뒤쪽**에 신뢰 프록시가 덧붙인 홉 수.
   *
   * 헤더는 `클라이언트, 프록시1, 프록시2` 순서로 쌓이므로, 프록시가 하나면 마지막 요소가
   * 클라이언트지만 프록시가 둘이면 마지막은 앞단 프록시의 주소다. 이 값만큼 뒤에서
   * 건너뛴 자리를 클라이언트로 판정한다.
   *
   * 기본 0 = 마지막 요소(프록시 1단 구성). 체인이 이 값보다 짧으면 `null` 을 반환한다 —
   * 없는 홉을 신뢰하면 클라이언트가 직접 써 넣은 값을 읽게 된다.
   */
  trustedProxyHops?: number;
}

/** 홉 수를 0 이상의 정수로 보정한다(음수·소수·비수치는 0). */
function normalizeTrustedProxyHops(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/**
 * 클라이언트 IP 주소 추출 (서버에서만 사용)
 *
 * 신뢰 가능한 프록시 헤더만 사용:
 * 1. CF-Connecting-IP: Cloudflare Proxy가 강제 설정 (스푸핑 불가)
 * 2. True-Client-IP: Cloudflare Enterprise에서 설정
 * 3. X-Forwarded-For: 뒤에서 `trustedProxyHops` 만큼 건너뛴 자리
 *
 * 보안 참고:
 * - X-Real-IP, X-Client-IP 등 클라이언트가 임의 설정 가능한 헤더는 사용하지 않음
 * - X-Forwarded-For의 앞쪽 값은 클라이언트가 조작 가능하므로, 신뢰 프록시가 덧붙인
 *   뒤쪽에서부터 센다. 프록시가 여러 단이면 `trustedProxyHops` 로 단수를 알려야 한다
 *   (예: Cloudflare 뒤에 플랫폼 edge 가 한 단 더 있으면 1).
 * - Cloudflare Proxy 환경에서는 CF-Connecting-IP가 항상 설정되므로 폴백에 도달하지 않음
 */
export function extractClientIp(headers: Headers, options: ExtractClientIpOptions = {}): string | null {
  // 1. Cloudflare 헤더 (가장 신뢰할 수 있음 — Cloudflare가 강제 덮어씀)
  const cf = headers.get('cf-connecting-ip');
  if (cf && isValidIP(cf.trim())) return cf.trim();

  // 2. Cloudflare Enterprise True-Client-IP
  const trueClientIp = headers.get('true-client-ip');
  if (trueClientIp && isValidIP(trueClientIp.trim())) return trueClientIp.trim();

  // 3. X-Forwarded-For (뒤에서 신뢰 홉 수만큼 건너뛴 값)
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim()).filter(Boolean);
    const index = ips.length - 1 - normalizeTrustedProxyHops(options.trustedProxyHops);
    const candidate = index >= 0 ? ips[index] : undefined;
    if (candidate && isValidIP(candidate)) {
      return candidate;
    }
  }

  return null;
}

/** IPv4 옥텟 — 선행 0·부호·공백이 붙은 표기는 받지 않는다(같은 주소가 여러 키가 되는 것을 막는다). */
const IPV4_OCTET_PATTERN = /^(?:0|[1-9][0-9]{0,2})$/;
/** IPv6 그룹 — 1~4자리 16진수. */
const IPV6_GROUP_PATTERN = /^[0-9a-fA-F]{1,4}$/;

/** 점 표기 IPv4 판정. */
function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => IPV4_OCTET_PATTERN.test(part) && Number(part) <= 255);
}

/**
 * IPv6 판정 — 축약형(`::`)과 IPv4 사상 형식(`::ffff:192.0.2.1`)을 모두 받는다.
 *
 * `::` 는 한 번만 올 수 있고, 그 자리는 0 그룹 하나 이상을 대신하므로 남은 그룹 수가 8보다
 * 적어야 한다. 축약이 없으면 정확히 8그룹이어야 한다.
 */
function isValidIPv6(ip: string): boolean {
  const segments = ip.split('::');
  if (segments.length > 2) return false;

  const abbreviated = segments.length === 2;
  const toGroups = (part: string): string[] | null => {
    if (part === '') return [];
    const groups = part.split(':');
    // '::' 는 이미 분리했으므로, 여기 남은 빈 요소는 ':' 가 연속했거나 양 끝에 붙은 것이다.
    return groups.some(group => group === '') ? null : groups;
  };

  const left = toGroups(segments[0] ?? '');
  const right = toGroups(abbreviated ? (segments[1] ?? '') : '');
  if (!left || !right) return false;

  const groups = [...left, ...right];
  let count = groups.length;

  // IPv4 사상 꼬리는 16비트 그룹 2개를 차지한다.
  const last = groups[groups.length - 1];
  if (last !== undefined && last.includes('.')) {
    if (!isValidIPv4(last)) return false;
    groups.pop();
    count += 1;
  }

  if (groups.some(group => !IPV6_GROUP_PATTERN.test(group))) return false;

  return abbreviated ? count < 8 : count === 8;
}

// IP 주소 유효성 검사
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;

  // ':' 를 먼저 본다 — IPv4 사상 형식(`::ffff:192.0.2.1`)은 '.' 도 포함한다.
  if (ip.includes(':')) return isValidIPv6(ip);
  if (ip.includes('.')) return isValidIPv4(ip);

  return false;
}
