/**
 * 메시지 레지스트리
 * 에러 코드에 대한 다중 언어 메시지 제공
 */

import type { IErrorMessage, TLocale, TErrorMessages, IDefaultMessages } from './types';
import { koMessages } from './ko';
import { enMessages } from './en';

/**
 * 메시지 레지스트리
 */
const messageRegistry: Record<TLocale, TErrorMessages> = {
  ko: koMessages,
  en: enMessages,
  ja: koMessages, // Fallback to Korean for now
};

/**
 * 기본 메시지 (에러 코드가 없을 경우)
 */
const defaultMessages: IDefaultMessages = {
  ko: {
    title: '문제가 발생했어요',
    description: '예상치 못한 오류가 발생했습니다.',
    action: '잠시 후 다시 시도해 주세요.',
  },
  en: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred.',
    action: 'Please try again later.',
  },
  ja: {
    title: '問題が発生しました',
    description: '予期しないエラーが発生しました。',
    action: 'しばらくしてからもう一度お試しください。',
  },
};

/**
 * 에러 코드에 해당하는 메시지 가져오기
 *
 * @param code - 에러 코드 (5자리)
 * @param locale - 언어 (기본값: 'ko')
 * @returns 에러 메시지
 */
export function getErrorMessage(code: number, locale: TLocale = 'ko'): IErrorMessage {
  const messages = messageRegistry[locale] || messageRegistry.ko;
  return messages[code] || defaultMessages[locale] || defaultMessages.ko;
}

/**
 * 특정 언어의 모든 메시지 가져오기
 *
 * @param locale - 언어
 * @returns 모든 에러 메시지
 */
export function getAllMessages(locale: TLocale = 'ko'): TErrorMessages {
  return messageRegistry[locale] || messageRegistry.ko;
}

/**
 * 에러 코드가 메시지를 가지고 있는지 확인
 *
 * @param code - 에러 코드
 * @param locale - 언어
 * @returns 메시지 존재 여부
 */
export function hasMessage(code: number, locale: TLocale = 'ko'): boolean {
  const messages = messageRegistry[locale] || messageRegistry.ko;
  return code in messages;
}

/**
 * 지원하는 언어 목록
 */
export const supportedLocales: TLocale[] = ['ko', 'en', 'ja'];

/**
 * 언어가 지원되는지 확인
 *
 * @param locale - 언어
 * @returns 지원 여부
 */
export function isLocaleSupported(locale: string): locale is TLocale {
  return supportedLocales.includes(locale as TLocale);
}

// Re-export types
export type { IErrorMessage, TLocale, TErrorMessages, IDefaultMessages } from './types';
