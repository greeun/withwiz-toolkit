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

    // 8. localhost/내부 IP 체크
    if (!allowLocalhost && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
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

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /--/g, // SQL 주석
    /\/\*/g, // SQL 블록 주석
    /;.*?/g, // 세미콜론 (쿼리 구분)
    /'\s*(OR|AND)\s*'?\d/gi, // ' OR 1=1
    /\bxp_\w+/gi, // SQL Server 확장 프로시저
    /\bsp_\w+/gi, // SQL Server 저장 프로시저
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
      // HTML은 더 엄격한 검증 필요 (별도 라이브러리 사용 권장)
      if (detectXSS(input)) {
        return { valid: false, error: 'Dangerous HTML pattern detected' };
      }
      return { valid: true, sanitized: input };

    default:
      return { valid: false, error: 'Unknown input type' };
  }
}
