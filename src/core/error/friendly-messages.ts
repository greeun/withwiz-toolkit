/**
 * @deprecated friendly-messages-v2.ts를 사용하세요.
 * 이 파일은 하위 호환용으로만 유지됩니다. 신규 코드에서 import하지 마세요.
 *
 * 사용자 친화적 에러 메시지 정의
 * 5자리 HTTP 확장 에러 코드별 프렌들리 메시지
 */

import { getErrorCategory } from '@withwiz/toolkit/core/constants/error-codes';
import { getErrorMessage } from '@withwiz/toolkit/core/error/messages';

export interface IFriendlyMessage {
  title: string;
  description: string;
  action?: string;
}

export interface IErrorDisplay {
  code: number;
  title: string;
  description: string;
  action?: string;
  icon: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

type TLocale = 'ko' | 'en';

// 카테고리별 아이콘
const categoryIcons: Record<ReturnType<typeof getErrorCategory>, string> = {
  validation: '⚠️', auth: '🔐', permission: '🚫', resource: '🔍', conflict: '⚡',
  business: '📋', rateLimit: '⏱️', server: '🔧', security: '🛡️', unknown: '❌',
};

// 카테고리별 심각도
const categorySeverity: Record<ReturnType<typeof getErrorCategory>, IErrorDisplay['severity']> = {
  validation: 'warning', auth: 'warning', permission: 'warning', resource: 'info',
  conflict: 'warning', business: 'warning', rateLimit: 'warning', server: 'error',
  security: 'critical', unknown: 'error',
};

export function getFriendlyMessage(code: number, locale: TLocale = 'ko'): IFriendlyMessage {
  return getErrorMessage(code, locale);
}

export function getErrorDisplayInfo(code: number, locale: TLocale = 'ko'): IErrorDisplay {
  const message = getFriendlyMessage(code, locale);
  const category = getErrorCategory(code);
  return { code, title: message.title, description: message.description, action: message.action, icon: categoryIcons[category], severity: categorySeverity[category] };
}

export function formatFriendlyError(code: number, locale: TLocale = 'ko'): string {
  const { title, description } = getFriendlyMessage(code, locale);
  return `${title} - ${description} [${code}]`;
}
