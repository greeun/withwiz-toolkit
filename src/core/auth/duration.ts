/**
 * 만료 기간 문자열을 초로 변환.
 *
 * JWT 만료(jose는 "7d" 형식 문자열을 직접 받음)와 쿠키 maxAge(초 단위 number)를
 * 동일한 설정값에서 도출하기 위한 유틸. 단위 없는 숫자는 초로 간주.
 *
 * 지원 단위: s(초) / m(분) / h(시) / d(일).
 */
export function durationToSeconds(expiry: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(expiry.trim());
  if (!match) {
    throw new Error(`Invalid duration format: "${expiry}" (expected e.g. "7d", "15m", "900")`);
  }
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return value; // 단위 없음 → 초
  }
}
