import type { $ZodIssue } from 'zod/v4/core';
import type { TLocale } from '@withwiz/toolkit/core/error/messages/types';

/** 72바이트 초과 사유 — 화면에 그대로 표시되므로 요청 로케일 문구로 낸다 */
export const BYTE_LIMIT_MESSAGES: Record<TLocale, string> = {
  ko: '비밀번호가 너무 깁니다. 영문 기준 72자, 한글 기준 24자 이하로 입력해 주세요.',
  en: 'Password is too long. Use at most 72 bytes (72 Latin letters or 24 CJK characters).',
  ja: 'パスワードが長すぎます。半角英数字で72文字、全角文字で24文字以内にしてください。',
};

/** 비밀번호 스키마의 72바이트 refine 을 가리키는 `params.reason` */
export const BYTE_LIMIT_REASON = 'PASSWORD_BYTE_LIMIT';

interface FieldMessages {
  required: string;
  invalidType: string;
  email: string;
  minLength: (minimum: number) => string;
}

/**
 * en 은 zod 3 기본 문구로 고정한다(0.22.0 까지의 응답과 같다). zod 4 는 기본 문구가 달라졌는데
 * ("Invalid input: expected string, received undefined") 소비 앱이 이 문구를 화면에 그대로 띄운다.
 */
const FIELD_MESSAGES: Record<TLocale, FieldMessages> = {
  en: {
    required: 'Required',
    invalidType: 'Invalid input',
    email: 'Invalid email',
    minLength: (minimum) => `String must contain at least ${minimum} character(s)`,
  },
  ko: {
    required: '필수 입력 항목입니다.',
    invalidType: '입력 형식이 올바르지 않습니다.',
    email: '올바른 이메일 주소를 입력해 주세요.',
    minLength: (minimum) => `${minimum}자 이상 입력해 주세요.`,
  },
  ja: {
    required: '必須項目です。',
    invalidType: '入力形式が正しくありません。',
    email: '正しいメールアドレスを入力してください。',
    minLength: (minimum) => `${minimum}文字以上で入力してください。`,
  },
};

/** 값이 없는 필드의 사유. */
export function requiredFieldMessage(locale: TLocale): string {
  return FIELD_MESSAGES[locale].required;
}

/**
 * 인증 핸들러 스키마의 zod issue 를 요청 로케일 문구로 바꾼다.
 * 스키마는 toolkit 소유라 issue 종류가 정해져 있다 — 그 밖의 issue 는 zod 문구를 그대로 둔다.
 */
export function localizeFieldIssue(issue: $ZodIssue, locale: TLocale): string {
  if (issue.code === 'custom' && issue.params?.reason === BYTE_LIMIT_REASON && locale !== 'en') {
    return BYTE_LIMIT_MESSAGES[locale];
  }
  const messages = FIELD_MESSAGES[locale];
  switch (issue.code) {
    case 'invalid_type':
      // zod 4 는 받은 값을 issue 에 싣지 않아 기본 문구로 가른다. 스키마는 toolkit 소유라 문구를 지정하지 않았다.
      return /received undefined$/.test(issue.message) ? messages.required : messages.invalidType;
    case 'invalid_format':
      return issue.format === 'email' ? messages.email : issue.message;
    case 'too_small':
      if (issue.origin !== 'string') return issue.message;
      return issue.minimum === 1 ? messages.required : messages.minLength(Number(issue.minimum));
    default:
      return issue.message;
  }
}
