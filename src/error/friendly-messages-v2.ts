/**
 * 사용자 친화적 에러 메시지 (v2)
 * 새로운 다중 언어 메시지 시스템 사용
 *
 * 이 파일은 기존 friendly-messages.ts를 대체하며,
 * messages/ 폴더의 다중 언어 시스템을 활용합니다.
 */

import { getErrorCategory } from '@withwiz/constants/error-codes';
import { getErrorMessage, type IErrorMessage, type TLocale } from './messages';

/**
 * @deprecated Use IErrorMessage from './messages' instead
 */
export interface IFriendlyMessage extends IErrorMessage {}

export interface IErrorDisplay {
  code: number;
  title: string;
  description: string;
  action?: string;
  icon: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// 카테고리별 아이콘
const categoryIcons: Record<ReturnType<typeof getErrorCategory>, string> = {
  validation: '⚠️',
  auth: '🔐',
  permission: '🚫',
  resource: '🔍',
  conflict: '⚡',
  business: '📋',
  rateLimit: '⏱️',
  server: '🔧',
  security: '🛡️',
  unknown: '❌',
};

// 카테고리별 심각도
const categorySeverity: Record<
  ReturnType<typeof getErrorCategory>,
  IErrorDisplay['severity']
> = {
  validation: 'warning',
  auth: 'warning',
  permission: 'warning',
  resource: 'info',
  conflict: 'warning',
  business: 'warning',
  rateLimit: 'warning',
  server: 'error',
  security: 'critical',
  unknown: 'error',
};

/**
 * 에러 코드에 해당하는 친화적 메시지 가져오기
 *
 * @param code - 에러 코드
 * @param locale - 언어 (기본값: 'ko')
 * @returns 친화적 메시지
 */
export function getFriendlyMessage(code: number, locale: TLocale = 'ko'): IErrorMessage {
  return getErrorMessage(code, locale);
}

/**
 * 에러 표시 정보 가져오기 (아이콘, 심각도 포함)
 *
 * @param code - 에러 코드
 * @param locale - 언어 (기본값: 'ko')
 * @returns 에러 표시 정보
 */
export function getErrorDisplayInfo(code: number, locale: TLocale = 'ko'): IErrorDisplay {
  const message = getErrorMessage(code, locale);
  const category = getErrorCategory(code);

  return {
    code,
    title: message.title,
    description: message.description,
    action: message.action,
    icon: categoryIcons[category],
    severity: categorySeverity[category],
  };
}

/**
 * 친화적 에러 메시지 포맷팅 (한 줄)
 *
 * @param code - 에러 코드
 * @param locale - 언어 (기본값: 'ko')
 * @returns 포맷된 에러 메시지
 */
export function formatFriendlyError(code: number, locale: TLocale = 'ko'): string {
  const { title, description } = getFriendlyMessage(code, locale);
  return `${title} - ${description} [${code}]`;
}

// Re-export types
export type { IErrorMessage, TLocale } from './messages';
