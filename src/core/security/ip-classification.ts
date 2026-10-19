/**
 * IP 주소 분류
 *
 * 공인 인터넷으로 라우팅되지 않는 주소(사설·루프백·링크 로컬·CGNAT·멀티캐스트·예약 대역 등)를 판별한다.
 * `core/utils/ip-utils` 의 `isPrivateIP` 와 `core/security/url-security` 의 `isInternalIP` 가
 * 이 모듈을 공통 판정 기준으로 쓴다.
 */

/**
 * dotted-decimal IPv4 주소가 비공인 대역인지 확인한다.
 *
 * - 0.0.0.0/8 (현재 네트워크), 10.0.0.0/8, 100.64.0.0/10 (CGNAT), 127.0.0.0/8 (루프백)
 * - 169.254.0.0/16 (링크 로컬·클라우드 메타데이터), 172.16.0.0/12, 192.168.0.0/16
 * - 224.0.0.0/4 (멀티캐스트), 240.0.0.0/4 (예약, 255.255.255.255 브로드캐스트 포함)
 *
 * 형식이 올바른 IPv4 가 아니면 false 를 반환한다.
 */
export function isNonPublicIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return false;
  const octets = parts.map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets;

  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

/**
 * IPv6 주소가 비공인 대역인지 확인한다.
 *
 * - `::1` (루프백), `::` (미지정)
 * - IPv4-mapped (`::ffff:a.b.c.d`, `::ffff:HHHH:HHHH`) 는 매핑된 IPv4 기준으로 판정
 * - fe80::/10 (링크 로컬), fc00::/7 (고유 로컬)
 *
 * 대괄호(`[::1]`)는 호출 측에서 제거해야 한다.
 */
export function isNonPublicIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  if (lower === '::1' || lower === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  if (lower === '::' || lower === '0000:0000:0000:0000:0000:0000:0000:0000') return true;

  const v4Mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4Mapped) return isNonPublicIPv4(v4Mapped[1]);

  const v4MappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4MappedHex) {
    const high = parseInt(v4MappedHex[1], 16);
    const low = parseInt(v4MappedHex[2], 16);
    return isNonPublicIPv4(`${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`);
  }

  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  return false;
}

/**
 * IP 리터럴(IPv4 dotted-decimal 또는 IPv6)이 비공인 대역인지 확인한다.
 * 호스트명이나 인코딩된 IPv4(10진수·16진수·8진수)는 해석하지 않는다
 * — 그런 입력까지 다루려면 `core/security/url-security` 의 `isInternalIP` 를 쓴다.
 */
export function isNonPublicIP(ip: string): boolean {
  if (!ip) return false;
  if (ip.includes(':')) return isNonPublicIPv6(ip);
  return isNonPublicIPv4(ip);
}
