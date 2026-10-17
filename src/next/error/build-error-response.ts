/**
 * 표준 오류 응답 빌더 (0.21+)
 *
 * 표준 형태: `{ success: false, error: { code, key, message, userMessage, requestId?, details? } }`
 * - `key` 로 분기하고, 화면에는 `userMessage.description` 을 표시한다. `message` 는 개발자용이다.
 * - 필드 오류는 `details.fieldErrors`(zod `flatten().fieldErrors` 와 같은 모양)에 담는다.
 */

import { NextResponse } from 'next/server';
import { ERROR_CODES, getHttpStatus } from '@withwiz/toolkit/core/constants/error-codes';
import { getErrorMessage } from '@withwiz/toolkit/core/error/messages';
import type { TLocale } from '@withwiz/toolkit/core/error/messages/types';
import { LocaleDetector } from '@withwiz/toolkit/next/error/locale-detector';

export interface IStandardUserMessage {
  title?: string;
  description: string;
  action?: string;
}

export interface IStandardErrorBody {
  success: false;
  error: {
    code: number;
    key: string;
    message: string;
    userMessage: IStandardUserMessage;
    requestId?: string;
    details?: Record<string, unknown>;
  };
}

export interface IBuildErrorOptions {
  /** HTTP 상태. 기본값은 숫자 코드의 앞 세 자리 */
  status?: number;
  /** 숫자 코드 지정 — ERROR_CODES 에 없는 소비자 고유 key 에 쓴다. 기본값은 상태별 대표 코드 */
  code?: number;
  /** 개발자용 메시지. 기본값은 ERROR_CODES 의 message */
  message?: string;
  /** 사용자 문구 덮어쓰기. 문자열이면 description 만 바꾼다 */
  userMessage?: string | Partial<IStandardUserMessage>;
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
  requestId?: string;
  /** 사용자 문구의 로케일. 없으면 request 로 감지하고, 둘 다 없으면 'ko' */
  locale?: TLocale;
  request?: Request;
  headers?: HeadersInit;
}

/** ERROR_CODES 에 없는 key 의 숫자 코드를 HTTP 상태로 고른다 */
export function representativeCode(status: number): number {
  if (status === 401) return ERROR_CODES.UNAUTHORIZED.code;
  if (status === 403) return ERROR_CODES.FORBIDDEN.code;
  if (status === 404) return ERROR_CODES.NOT_FOUND.code;
  if (status === 409) return ERROR_CODES.CONFLICT.code;
  if (status === 422) return ERROR_CODES.BUSINESS_RULE_VIOLATION.code;
  if (status === 429) return ERROR_CODES.RATE_LIMIT_EXCEEDED.code;
  if (status === 503) return ERROR_CODES.SERVICE_UNAVAILABLE.code;
  if (status >= 500) return ERROR_CODES.INTERNAL_SERVER_ERROR.code;
  return ERROR_CODES.BAD_REQUEST.code;
}

function resolveLocale(options: IBuildErrorOptions): TLocale {
  if (options.locale) return options.locale;
  if (options.request) {
    // NextRequest 가 아니어도(테스트의 Request 등) 감지기는 실패 시 기본값을 돌려준다
    return LocaleDetector.detectServer(options.request as Parameters<typeof LocaleDetector.detectServer>[0]);
  }
  return 'ko';
}

/** 표준 오류 본문과 HTTP 상태를 만든다 */
export function buildErrorBody(key: string, options: IBuildErrorOptions = {}): { status: number; body: IStandardErrorBody } {
  const known = (ERROR_CODES as Record<string, { code: number; message: string }>)[key];
  const code = options.code ?? known?.code ?? representativeCode(options.status ?? 400);
  const status = options.status ?? getHttpStatus(code);

  const dictionary = getErrorMessage(code, resolveLocale(options));
  const override = typeof options.userMessage === 'string' ? { description: options.userMessage } : options.userMessage;
  const userMessage: IStandardUserMessage = {
    title: override?.title ?? dictionary.title,
    description: override?.description ?? dictionary.description,
    action: override?.action ?? dictionary.action,
  };

  const details = options.fieldErrors ? { ...options.details, fieldErrors: options.fieldErrors } : options.details;

  return {
    status,
    body: {
      success: false,
      error: {
        code,
        key,
        message: options.message ?? known?.message ?? key,
        userMessage,
        ...(options.requestId ? { requestId: options.requestId } : {}),
        ...(details ? { details } : {}),
      },
    },
  };
}

/** 표준 오류 응답을 만든다 */
export function buildErrorResponse(key: string, options: IBuildErrorOptions = {}): NextResponse<IStandardErrorBody> {
  const { status, body } = buildErrorBody(key, options);
  return NextResponse.json(body, { status, headers: options.headers });
}
