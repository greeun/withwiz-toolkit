/**
 * 입력 검증 유틸리티
 *
 * XSS, SQL Injection, Path Traversal 등 보안 위협을 방어합니다.
 */

/**
 * 위험한 URL 스키마 목록
 */
const DANGEROUS_URL_SCHEMES = [
  'javascript:',
  'data:',
  'file:',
  'vbscript:',
  'about:',
  'chrome:',
  'chrome-extension:',
  'moz-extension:',
  'ms-its:',
  'ms-itss:',
  'its:',
  'mk:',
  'view-source:',
] as const;

/**
 * 허용된 URL 스키마 목록
 */
const ALLOWED_URL_SCHEMES = [
  'http:',
  'https:',
  'ftp:',
  'ftps:',
  'mailto:',
  'tel:',
  'sms:',
] as const;

/**
 * 사설/예약 IPv4 대역 여부 (a.b.c.d 의 a,b 기준)
 */
function isPrivateV4(a: number, b: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 10) return true; // private 10.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16 (cloud metadata 포함)
  if (a === 192 && b === 168) return true; // private 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16.0.0/12
  return false;
}

/**
 * 내부/사설/loopback 호스트 여부 — SSRF 방어.
 *
 * WHATWG URL 파서가 10진수/16진수 IPv4 를 점표기로 정규화하므로
 * 점표기 IPv4 와 IPv6 리터럴, localhost 만 판정하면 된다.
 */
function isInternalHost(hostname: string): boolean {
  let h = hostname.toLowerCase();
  // IPv6 리터럴 대괄호 제거
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);

  if (h === 'localhost' || h.endsWith('.localhost')) return true;

  // IPv6 (콜론 포함) — 도메인 오탐 방지를 위해 콜론이 있을 때만 IPv6 규칙 적용
  if (h.includes(':')) {
    if (h === '::1' || h === '::') return true; // loopback / unspecified
    // unique-local fc00::/7 (fc/fd), link-local fe80::/10 (fe8-feb)
    if (/^f[cd]/.test(h) || /^fe[89ab]/.test(h)) return true;
    return false;
  }

  // 점표기 IPv4
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const o = v4.slice(1, 5).map(Number);
    if (o.some((n) => n > 255)) return false;
    return isPrivateV4(o[0], o[1]);
  }

  return false;
}

/**
 * URL 검증 옵션
 */
export interface URLValidationOptions {
  allowedSchemes?: string[];
  maxLength?: number;
  requireProtocol?: boolean;
  /** localhost/127.0.0.1 URL 허용 여부 (기본값: false) */
  allowLocalhost?: boolean;
}

/**
 * URL 안전성 검증
 *
 * @param url - 검증할 URL
 * @param options - 검증 옵션
 * @returns 검증 결과 { valid: boolean, error?: string, sanitized?: string }
 */
export function validateURL(
  url: string,
  options: URLValidationOptions = {}
): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  const {
    allowedSchemes = ALLOWED_URL_SCHEMES,
    maxLength = 2048,
    requireProtocol = true,
    allowLocalhost = false,
  } = options;

  // 1. 빈 문자열 체크
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // 2. 길이 체크
  if (url.length > maxLength) {
    return { valid: false, error: `URL exceeds maximum length of ${maxLength}` };
  }

  // 3. 공백 제거
  const trimmedUrl = url.trim();

  // 4. 프로토콜 체크
  const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl);

  if (requireProtocol && !hasProtocol) {
    return { valid: false, error: 'URL must include a protocol (http:// or https://)' };
  }

  // 5. 위험한 스키마 체크
  const urlLower = trimmedUrl.toLowerCase();
  for (const scheme of DANGEROUS_URL_SCHEMES) {
    if (urlLower.startsWith(scheme)) {
      return { valid: false, error: `Dangerous URL scheme detected: ${scheme}` };
    }
  }

  // 6. 허용된 스키마 체크
  if (hasProtocol) {
    const scheme = trimmedUrl.split(':')[0].toLowerCase() + ':';
    if (!allowedSchemes.includes(scheme as any)) {
      return { valid: false, error: `URL scheme not allowed: ${scheme}` };
    }
  }

  // 7. URL 파싱 시도
  try {
    // 프로토콜이 없으면 https:// 추가 (선택사항)
    const urlToParse = hasProtocol ? trimmedUrl : `https://${trimmedUrl}`;
    const parsed = new URL(urlToParse);

    // 8. localhost/내부·사설 IP 체크 (SSRF 방어)
    if (!allowLocalhost && isInternalHost(parsed.hostname)) {
      return { valid: false, error: 'Internal URLs are not allowed' };
    }

    return {
      valid: true,
      sanitized: parsed.toString(),
    };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * XSS 방지: HTML 특수 문자 이스케이프
 *
 * @param input - 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
export function escapeHTML(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * XSS 패턴 탐지
 *
 * @param input - 검증할 문자열
 * @returns XSS 패턴 발견 시 true
 */
export function detectXSS(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick=, onerror= 등
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<applet/gi,
    /<meta/gi,
    /<link/gi,
    /<style/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
}

/**
 * Path Traversal 공격 탐지
 *
 * @param input - 검증할 경로
 * @returns Path Traversal 패턴 발견 시 true
 */
export function detectPathTraversal(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const traversalPatterns = [
    /\.\./g, // ../
    /\.\\/g, // .\
    /%2e%2e/gi, // URL 인코딩된 ..
    /%252e/gi, // 이중 URL 인코딩
    /\\/g, // 백슬래시
    /\/\//g, // 이중 슬래시
  ];

  return traversalPatterns.some((pattern) => pattern.test(input));
}

/**
 * SQL Injection 패턴 탐지
 *
 * @param input - 검증할 문자열
 * @returns SQL Injection 패턴 발견 시 true
 */
export function detectSQLInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  // 단일 키워드/세미콜론만으로 판정하면 정상 텍스트("update your profile", "a; b")를
  // 오탐한다. SQL 구조(키워드 조합)·주입 시그니처에 한해 탐지한다.
  // (전역 플래그 미사용 — test() 의 lastIndex 부작용 회피)
  const sqlPatterns = [
    /\bSELECT\b[\s\S]+\bFROM\b/i, // SELECT ... FROM
    /\bINSERT\b[\s\S]+\bINTO\b/i, // INSERT INTO
    /\bUPDATE\b[\s\S]+\bSET\b/i, // UPDATE ... SET
    /\bDELETE\b[\s\S]+\bFROM\b/i, // DELETE FROM
    /\b(?:DROP|ALTER|CREATE|TRUNCATE)\s+(?:TABLE|DATABASE|INDEX|VIEW|SCHEMA|COLUMN)\b/i,
    /\bUNION\b[\s\S]*?\bSELECT\b/i, // UNION SELECT
    /\b(?:EXEC|EXECUTE)\s*\(/i, // exec(
    /'\s*(?:--|#|;)/, // 따옴표 뒤 주석/종결 (admin'--)
    /\/\*[\s\S]*?\*\//, // 블록 주석
    /'\s*(?:OR|AND)\s+'?\d/i, // ' OR 1
    /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b/i, // 스택 쿼리
    /\b(?:xp_|sp_)\w+/i, // SQL Server 프로시저
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * 입력 문자열 정제
 *
 * @param input - 정제할 문자열
 * @param options - 정제 옵션
 * @returns 정제된 문자열
 */
export function sanitizeInput(
  input: string,
  options: {
    maxLength?: number;
    allowHTML?: boolean;
    trim?: boolean;
  } = {}
): string {
  const { maxLength = 10000, allowHTML = false, trim = true } = options;

  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // 1. 공백 제거
  if (trim) {
    sanitized = sanitized.trim();
  }

  // 2. HTML 이스케이프 (길이 제한 전에 실행 - 이스케이프로 문자열 팽창 가능)
  if (!allowHTML) {
    sanitized = escapeHTML(sanitized);
  }

  // 3. NULL 바이트 제거
  sanitized = sanitized.replace(/\0/g, '');

  // 4. 제어 문자 제거 (탭, 개행 제외)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 5. 길이 제한 (이스케이프/정제 후 최종 적용)
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * 파일 이름 검증
 *
 * @param filename - 검증할 파일 이름
 * @returns 검증 결과
 */
export function validateFilename(filename: string): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Filename is required' };
  }

  // Path Traversal 체크
  if (detectPathTraversal(filename)) {
    return { valid: false, error: 'Path traversal detected in filename' };
  }

  // 위험한 확장자 체크 (Windows 실행 파일 + 서버 사이드 스크립트)
  // .com은 Windows COM 실행 파일 (도메인 접미사가 아님)
  const dangerousExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.pif',
    '.scr',
    '.vbs',
    '.js',
    '.sh',
    '.php',
    '.asp',
    '.aspx',
    '.jsp',
  ];

  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (dangerousExtensions.includes(ext)) {
    return { valid: false, error: `Dangerous file extension: ${ext}` };
  }

  // 파일 이름 정제
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // 특수 문자를 _로 대체
    .replace(/\.{2,}/g, '.') // 연속된 점 제거
    .substring(0, 255); // 길이 제한

  return { valid: true, sanitized };
}

/**
 * 종합 입력 검증
 *
 * @param input - 검증할 입력
 * @param type - 입력 타입
 * @returns 검증 결과
 */
export function validateInput(
  input: string,
  type: 'text' | 'url' | 'filename' | 'html'
): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  switch (type) {
    case 'url':
      return validateURL(input);

    case 'filename':
      return validateFilename(input);

    case 'text':
      // XSS, SQL Injection 체크
      if (detectXSS(input)) {
        return { valid: false, error: 'XSS pattern detected' };
      }
      if (detectSQLInjection(input)) {
        return { valid: false, error: 'SQL Injection pattern detected' };
      }
      return { valid: true, sanitized: sanitizeInput(input) };

    case 'html':
      // blocklist(detectXSS)는 우회가 쉬우므로 통과 시에도 원본을 그대로
      // 돌려주지 않는다. escapeHTML 로 안전한 값을 반환한다(텍스트 컨텍스트 안전).
      // 실제 리치 HTML 정제가 필요하면 소비자가 DOMPurify 등 allowlist 정제기를 쓸 것.
      if (detectXSS(input)) {
        return { valid: false, error: 'Dangerous HTML pattern detected' };
      }
      return { valid: true, sanitized: escapeHTML(input) };

    default:
      return { valid: false, error: 'Unknown input type' };
  }
}
