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

/**
 * 클라이언트 IP 주소 추출 (서버에서만 사용)
 *
 * Cloudflare 환경 최적화:
 * 1. CF-Connecting-IP: Cloudflare가 설정하는 실제 클라이언트 IP (가장 신뢰)
 * 2. True-Client-IP: Cloudflare Enterprise에서 사용
 * 3. X-Real-IP: Nginx 등 신뢰할 수 있는 리버스 프록시
 * 4. X-Forwarded-For: 첫 번째 IP가 실제 클라이언트 (Cloudflare가 추가)
 * 5. X-Client-IP: 일부 프록시에서 사용
 */
export function extractClientIp(headers: Headers): string | null {
  // 1. Cloudflare 헤더 (가장 신뢰할 수 있음)
  const cf = headers.get('cf-connecting-ip');
  if (cf && isValidIP(cf.trim())) return cf.trim();

  // 2. Cloudflare Enterprise True-Client-IP
  const trueClientIp = headers.get('true-client-ip');
  if (trueClientIp && isValidIP(trueClientIp.trim())) return trueClientIp.trim();

  // 3. X-Real-IP (Nginx 등 신뢰할 수 있는 프록시)
  const xri = headers.get('x-real-ip');
  if (xri && isValidIP(xri.trim())) return xri.trim();

  // 4. X-Forwarded-For (첫 번째 IP = 실제 클라이언트)
  // Cloudflare 환경에서는 첫 번째 IP가 실제 클라이언트 IP
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim()).filter(Boolean);
    // 첫 번째 IP 사용 (Cloudflare가 추가한 실제 클라이언트 IP)
    if (ips.length > 0 && isValidIP(ips[0])) {
      return ips[0];
    }
  }

  // 5. X-Client-IP (일부 프록시에서 사용)
  const xc = headers.get('x-client-ip');
  if (xc && isValidIP(xc.trim())) return xc.trim();

  return null;
}

// IP 주소 유효성 검사
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  
  // IPv4 체크
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  }
  
  // IPv6 체크 (간단한 검증)
  if (ip.includes(':')) {
    return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip) ||
           /^::1$/.test(ip) ||
           /^::/.test(ip) ||
           /^2001:4860:4860::8888$/.test(ip); // Google DNS IPv6
  }
  
  return false;
}
