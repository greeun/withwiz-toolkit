/**
 * URL 정규화 및 검증 유틸리티
 * 다양한 스키마(http, https, mailto, tel, 앱 스키마 등) 지원
 */

/**
 * 지원되는 URL 스키마 목록
 */
export const SUPPORTED_SCHEMES = [
  'http:',
  'https:',
  'mailto:',
  'tel:',
  'sms:',
  'ftp:',
  'ftps:',
  // 'file:' - 보안상 제거 (로컬 파일 접근 방지)
  // 'data:' - XSS 공격 벡터로 제거 (CVSS 7.5)
  // Mobile app schemes
  'intent:',
  'market:',
  'itms:',
  'itms-apps:',
  // Social media apps
  'fb:',
  'instagram:',
  'twitter:',
  'youtube:',
  'linkedin:',
  'tiktok:',
  // Messaging apps
  'whatsapp:',
  'telegram:',
  'line:',
  'kakaotalk:',
  'viber:',
  'wechat:',
  'slack:',
  'discord:',
  // Other apps
  'spotify:',
  'zoom:',
  'skype:',
  'maps:',
  'geo:',
];

/**
 * 위험한 프로토콜 목록 (XSS, 로컬 파일 접근 등)
 */
const DANGEROUS_SCHEMES = [
  'javascript:',
  'vbscript:',
  'data:',
  'file:',
  'blob:',
];

/**
 * 커스텀 앱 스키마 패턴 (예: myapp://, customscheme:// 등)
 */
const CUSTOM_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * URL이 유효한 스키마를 가지고 있는지 확인
 */
export function hasValidScheme(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol.toLowerCase();

    // 위험한 프로토콜 차단
    if (DANGEROUS_SCHEMES.includes(protocol)) {
      return false;
    }

    // 지원 목록에 있는 스키마인지 확인
    if (SUPPORTED_SCHEMES.includes(protocol)) {
      return true;
    }

    // 커스텀 스키마 패턴에 매치되는지 확인
    if (CUSTOM_SCHEME_PATTERN.test(url)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * URL에서 스키마 추출
 */
export function extractScheme(url: string): string | null {
  const match = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/?\/?/);
  return match ? match[1] : null;
}

/**
 * URL 정규화
 * - 스키마가 없으면 https:// 추가
 * - 이미 유효한 스키마가 있으면 그대로 반환
 * - 공백 제거 및 기본적인 정리
 */
export function normalizeUrl(url: string): string {
  if (!url) {
    return '';
  }
  
  // 앞뒤 공백 제거
  let normalized = url.trim();
  
  if (!normalized) {
    return '';
  }
  
  // 이미 유효한 스키마가 있는지 확인
  const scheme = extractScheme(normalized);

  if (scheme) {
    // 위험한 프로토콜은 빈 문자열 반환
    if (DANGEROUS_SCHEMES.includes(scheme.toLowerCase() + ':')) {
      return '';
    }
    // 유효한 스키마가 있으면 그대로 반환
    return normalized;
  }
  
  // 스키마가 없으면 https:// 추가
  // 단, '//'로 시작하는 경우는 'https:' 추가
  if (normalized.startsWith('//')) {
    return `https:${normalized}`;
  }
  
  return `https://${normalized}`;
}

/**
 * URL 검증 결과의 메시지 키 (i18n용)
 */
export type UrlValidationMessageKey =
  | 'validUrl'
  | 'urlRequired'
  | 'unsupportedProtocol'
  | 'invalidDomain'
  | 'invalidDomainFormat'
  | 'invalidEmail'
  | 'invalidPhone'
  | 'urlTooLong'
  | 'invalidUrlFormat';

/**
 * URL 검증 (다양한 스키마 지원)
 * @param url 검증할 URL
 * @param options.skipNormalization true이면 URL을 정규화하지 않고 검증 (기본: false)
 */
export function validateUrl(url: string, options?: { skipNormalization?: boolean }): {
  isValid: boolean;
  message: string;
  messageKey: UrlValidationMessageKey;
  messageParams?: Record<string, string>;
  normalizedUrl?: string;
} {
  if (!url || !url.trim()) {
    return {
      isValid: false,
      message: 'URL을 입력해주세요',
      messageKey: 'urlRequired',
    };
  }

  // skipNormalization 옵션이 true면 정규화 없이 검증
  const normalized = options?.skipNormalization ? url.trim() : normalizeUrl(url);

  try {
    const urlObj = new URL(normalized);
    const protocol = urlObj.protocol;

    // 위험한 프로토콜 차단
    if (DANGEROUS_SCHEMES.includes(protocol.toLowerCase())) {
      return {
        isValid: false,
        message: `보안상 허용되지 않는 프로토콜입니다: ${protocol}`,
        messageKey: 'unsupportedProtocol',
        messageParams: { protocol },
      };
    }

    // 지원되는 스키마 확인
    const isSupported = SUPPORTED_SCHEMES.includes(protocol);
    const isCustom = CUSTOM_SCHEME_PATTERN.test(normalized);

    if (!isSupported && !isCustom) {
      return {
        isValid: false,
        message: `지원하지 않는 프로토콜입니다: ${protocol}`,
        messageKey: 'unsupportedProtocol',
        messageParams: { protocol },
      };
    }

    // HTTP/HTTPS의 경우 추가 검증
    if (protocol === 'http:' || protocol === 'https:') {
      if (!urlObj.hostname || urlObj.hostname.length < 1) {
        return {
          isValid: false,
          message: '유효한 도메인을 입력해주세요',
          messageKey: 'invalidDomain',
        };
      }

      // 도메인에 최소한 점(.) 하나는 있어야 함 (localhost 제외)
      if (!urlObj.hostname.includes('.') && urlObj.hostname !== 'localhost') {
        return {
          isValid: false,
          message: '유효한 도메인 형식이 아닙니다',
          messageKey: 'invalidDomainFormat',
        };
      }
    }

    // mailto: 검증
    if (protocol === 'mailto:') {
      const email = urlObj.pathname;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          isValid: false,
          message: '유효한 이메일 주소가 아닙니다',
          messageKey: 'invalidEmail',
        };
      }
    }

    // tel: 검증
    if (protocol === 'tel:') {
      const phone = urlObj.pathname;
      // 전화번호는 최소한 숫자를 포함해야 함
      if (!/\d/.test(phone)) {
        return {
          isValid: false,
          message: '유효한 전화번호가 아닙니다',
          messageKey: 'invalidPhone',
        };
      }
    }

    // URL 길이 제한 (2048자)
    if (normalized.length > 2048) {
      return {
        isValid: false,
        message: 'URL이 너무 깁니다 (최대 2048자)',
        messageKey: 'urlTooLong',
      };
    }

    return {
      isValid: true,
      message: '유효한 URL입니다',
      messageKey: 'validUrl',
      normalizedUrl: normalized,
    };
  } catch (error) {
    return {
      isValid: false,
      message: '유효한 URL 형식이 아닙니다',
      messageKey: 'invalidUrlFormat',
    };
  }
}

/**
 * URL이 웹 URL인지 확인 (http 또는 https)
 */
export function isWebUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * URL이 앱 스키마인지 확인
 */
export function isAppScheme(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return !['http:', 'https:', 'ftp:', 'ftps:', 'file:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * URL 타입 반환 (웹, 이메일, 전화, 앱 등)
 */
export function getUrlType(url: string): 'web' | 'email' | 'tel' | 'app' | 'other' {
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    
    if (protocol === 'http:' || protocol === 'https:') {
      return 'web';
    }
    if (protocol === 'mailto:') {
      return 'email';
    }
    if (protocol === 'tel:' || protocol === 'sms:') {
      return 'tel';
    }
    if (isAppScheme(url)) {
      return 'app';
    }
    return 'other';
  } catch {
    return 'other';
  }
}
