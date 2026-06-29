// API 키 IP 화이트리스트 매칭 — 단일 IP·CIDR 범위 지원. 순수 함수(프레임워크 무관).

/** IPv4 CIDR 범위 포함 여부. 잘못된 입력은 false(throw 안 함). */
export function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    const mask = parseInt(bits, 10);
    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);
    if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
    if (Number.isNaN(mask)) return false;
    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
    const maskNum = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
    return (ipNum & maskNum) === (rangeNum & maskNum);
  } catch {
    return false;
  }
}

/** 클라이언트 IP가 화이트리스트(단일 IP 또는 CIDR)에 포함되는지. 빈/null이면 모두 허용. */
export function isIpAllowed(clientIp: string, whitelist: string[] | null): boolean {
  if (!whitelist || whitelist.length === 0) return true;
  const normalizedIp = clientIp.replace(/^::ffff:/, '');
  for (const allowed of whitelist) {
    if (allowed.includes('/')) {
      if (isIpInCidr(normalizedIp, allowed)) return true;
    } else if (normalizedIp === allowed.replace(/^::ffff:/, '')) {
      return true;
    }
  }
  return false;
}
