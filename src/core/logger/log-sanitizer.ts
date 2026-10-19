/**
 * 로그 민감 정보 마스킹
 *
 * 로그로 남기기 전에 이메일·IP·토큰·비밀 값을 부분 또는 전체 마스킹한다.
 * 호출 측이 로그 메타데이터를 만들 때 명시적으로 적용한다.
 *
 * `logger` 내부의 요청 본문 마스킹(고정 키 몇 개만 `[MASKED]` 로 치환)과는 별개다.
 * 이 모듈은 키 이름 휴리스틱(`key`·`auth` 등 부분 일치)을 쓰므로 범위가 더 넓다.
 */

// 민감한 정보로 간주하는 키 이름(부분 일치, 대소문자 무시)
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'key',
  'credential',
  'auth',
  'session',
  'cookie',
  'refresh_token',
  'access_token',
  'id_token',
  'client_secret',
  'api_key',
];

const EMAIL_PATTERN = /^([^@]+)@([^@]+)$/;
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_PATTERN = /^([a-f0-9:]+)$/i;

/**
 * 이메일 로컬 부분의 처음·마지막 글자만 남기고 마스킹한다 (`alice@example.com` → `a***e@example.com`).
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return email;

  const match = email.match(EMAIL_PATTERN);
  if (!match) return email;

  const [, localPart, domain] = match;
  const maskedLocal =
    localPart.length > 2
      ? `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}`
      : localPart;

  return `${maskedLocal}@${domain}`;
}

/**
 * IP 주소의 뒷부분을 마스킹한다 (`192.168.1.100` → `192.168.***.***`, IPv6 는 앞 두 그룹만 남김).
 */
export function maskIpAddress(ip: string): string {
  if (!ip || typeof ip !== 'string') return ip;

  const ipv4Match = ip.match(IPV4_PATTERN);
  if (ipv4Match) {
    const [, octet1, octet2] = ipv4Match;
    return `${octet1}.${octet2}.***.***`;
  }

  if (IPV6_PATTERN.test(ip)) {
    const parts = ip.split(':');
    if (parts.length > 2) {
      return `${parts[0]}:${parts[1]}:***:***`;
    }
  }

  return ip;
}

/**
 * 문자열의 앞뒤 `visibleChars` 글자만 남기고 마스킹한다. 짧은 값은 전부 마스킹한다.
 */
export function maskString(value: string, visibleChars: number = 4): string {
  if (!value || typeof value !== 'string') return value;

  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }

  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  const middle = '*'.repeat(Math.max(0, value.length - visibleChars * 2));

  return `${start}${middle}${end}`;
}

/**
 * 키 이름이 민감한 정보를 가리키는지 확인한다.
 */
export function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitiveKey) => lowerKey.includes(sensitiveKey));
}

/**
 * 객체·배열을 재귀적으로 돌며 민감한 값을 마스킹한다(깊이 5 초과는 `[Too Deep]`).
 * - 민감 키: 문자열은 `maskString`, 그 밖은 `[MASKED]`
 * - `email` 키: `maskEmail`
 * - 이름에 `ip` 가 들어간 키의 IP 형식 문자열: `maskIpAddress`
 */
export function sanitizeLogData(data: unknown, depth: number = 0): unknown {
  if (depth > 5) return '[Too Deep]';
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (data instanceof Date) return data;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = typeof value === 'string' ? maskString(value) : '[MASKED]';
    } else if (key.toLowerCase() === 'email' && typeof value === 'string') {
      sanitized[key] = maskEmail(value);
    } else if (key.toLowerCase().includes('ip') && typeof value === 'string') {
      sanitized[key] = maskIpAddress(value);
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    }
  }

  return sanitized;
}

/**
 * 마스킹한 뒤 JSON 문자열로 바꾼다. 직렬화에 실패하면 고정 문구를 반환한다.
 */
export function toSafeLogString(data: unknown): string {
  try {
    return JSON.stringify(sanitizeLogData(data), null, 2);
  } catch {
    return '[Failed to serialize log data]';
  }
}

/**
 * 자유 형식 메시지 안의 이메일·IPv4·JWT·긴 토큰 형태 문자열을 마스킹한다.
 */
export function sanitizeLogMessage(message: string): string {
  if (!message || typeof message !== 'string') return message;

  let sanitized = message;

  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (match) => maskEmail(match));
  sanitized = sanitized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (match) => maskIpAddress(match));
  sanitized = sanitized.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT_TOKEN]');
  // 20자 이상 연속 토큰 문자열은 API 키일 수 있으므로 마스킹한다
  sanitized = sanitized.replace(/\b[A-Za-z0-9_-]{20,}\b/g, (match) => maskString(match, 4));

  return sanitized;
}

/**
 * 로거 메타데이터를 마스킹하고 `timestamp`·`nodeEnv`·`pid` 를 덧붙인다.
 */
export function createSafeLogMeta(meta: Record<string, unknown> = {}): Record<string, unknown> {
  const safeMeta = sanitizeLogData(meta) as Record<string, unknown>;

  safeMeta.timestamp = new Date().toISOString();
  safeMeta.nodeEnv = process.env.NODE_ENV;
  safeMeta.pid = process.pid;

  return safeMeta;
}
