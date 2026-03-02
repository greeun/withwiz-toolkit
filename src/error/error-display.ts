/**
 * 프론트엔드 에러 표시 유틸리티
 * Toast 알림, 에러 UI 표시 등
 */

import { toast } from 'sonner';
import { getErrorCategory } from '@withwiz/constants/error-codes';
import { getFriendlyMessage, getErrorDisplayInfo, type IErrorDisplay } from './friendly-messages';

// Re-export from friendly-messages for external use
export { getFriendlyMessage, getErrorDisplayInfo, type IErrorDisplay } from './friendly-messages';

type TLocale = 'ko' | 'en';

/**
 * API 에러 응답 인터페이스
 */
export interface IApiErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    details?: unknown;
  };
}

/**
 * 현재 로케일 가져오기
 */
function getLocale(): TLocale {
  if (typeof window === 'undefined') return 'ko';
  const locale = localStorage.getItem('locale') || document.cookie.match(/locale=([^;]+)/)?.[1];
  return locale === 'en' ? 'en' : 'ko';
}

/**
 * 에러 코드로 친화적 토스트 표시
 */
export function showFriendlyError(
  errorOrCode: number | IApiErrorResponse | Error,
  options?: {
    locale?: TLocale;
    duration?: number;
    showCode?: boolean;
    onAuthError?: () => void;
    onRateLimitError?: () => void;
  }
): void {
  const { locale = getLocale(), duration = 5000, showCode = true, onAuthError, onRateLimitError } = options || {};

  let code: number;
  let displayInfo: IErrorDisplay;

  if (typeof errorOrCode === 'number') {
    code = errorOrCode;
    displayInfo = getErrorDisplayInfo(code, locale);
  } else if (errorOrCode instanceof Error) {
    // AppError 등 code 속성이 있는 경우 직접 사용
    if ('code' in errorOrCode && typeof (errorOrCode as { code: unknown }).code === 'number') {
      code = (errorOrCode as { code: number }).code;
    } else {
      code = 50002;
    }
    displayInfo = getErrorDisplayInfo(code, locale);
  } else {
    // API 응답
    code = errorOrCode.error?.code || 50002;
    displayInfo = getErrorDisplayInfo(code, locale);
  }

  // 카테고리별 콜백 실행
  const category = getErrorCategory(code);
  if (category === 'auth' && onAuthError) onAuthError();
  if (category === 'rateLimit' && onRateLimitError) onRateLimitError();

  // 토스트 표시
  const description = showCode ? `${displayInfo.description} [${code}]` : displayInfo.description;

  switch (displayInfo.severity) {
    case 'critical':
    case 'error':
      toast.error(displayInfo.title, { description, duration });
      break;
    case 'warning':
      toast.warning(displayInfo.title, { description, duration });
      break;
    case 'info':
    default:
      toast.info(displayInfo.title, { description, duration });
  }
}

/**
 * API 응답에서 에러 처리
 */
export async function handleApiResponse<T>(
  response: Response,
  options?: {
    showToast?: boolean;
    locale?: TLocale;
    onAuthError?: () => void;
  }
): Promise<T> {
  if (response.ok) {
    const data = await response.json();
    return data.data as T;
  }

  const errorData: IApiErrorResponse = await response.json();
  
  if (options?.showToast !== false) {
    showFriendlyError(errorData, {
      locale: options?.locale,
      onAuthError: options?.onAuthError,
    });
  }

  throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
}

/**
 * 에러 메시지 포맷 (인라인 표시용)
 */
export function formatInlineError(code: number, locale?: TLocale): string {
  const lang = locale || getLocale();
  const { title, description } = getFriendlyMessage(code, lang);
  return `${description} [${code}]`;
}

/**
 * 에러 아이콘 가져오기
 */
export function getErrorIcon(code: number): string {
  const category = getErrorCategory(code);
  const icons: Record<string, string> = {
    validation: '⚠️', auth: '🔐', permission: '🚫', resource: '🔍',
    conflict: '⚡', business: '📋', rateLimit: '⏱️', server: '🔧',
    security: '🛡️', unknown: '❌',
  };
  return icons[category] || '❌';
}

/**
 * HTTP 상태 코드에서 기본 에러 코드 가져오기
 */
export function getDefaultErrorCode(status: number): number {
  const statusMap: Record<number, number> = {
    400: 40002, 401: 40101, 403: 40304, 404: 40401, 409: 40904,
    422: 42201, 429: 42901, 500: 50002, 503: 50305,
  };
  return statusMap[status] || 50002;
}

/**
 * 에러 바운더리용 에러 정보 추출
 */
export function extractErrorInfo(error: Error | unknown): { code: number; message: string; stack?: string } {
  if (error instanceof Error) {
    // AppError 등 code 속성이 있는 경우 직접 사용
    if ('code' in error && typeof (error as { code: unknown }).code === 'number' && (error as { code: number }).code >= 10000) {
      return { code: (error as { code: number }).code, message: error.message, stack: error.stack };
    }
    return { code: 50001, message: error.message, stack: error.stack };
  }
  return { code: 50001, message: String(error) };
}
