import { NextResponse } from 'next/server';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import { AUTH_ERROR_CODE_MAP } from '@withwiz/toolkit/next/error/error-handler';
import { buildErrorBody } from '@withwiz/toolkit/next/error/build-error-response';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';

export interface AuthErrorSpec {
  status: number;
  /** standard 의 key. ERROR_CODES 의 key 이거나 AuthError 의 code */
  key: string;
  /** 개발자용 메시지 — legacy 에서는 `error` 문자열이 된다(0.20 과 같은 값) */
  message: string;
  /** legacy 본문에 `code` 를 실을 때만 지정한다(0.20 에서 code 를 싣던 응답) */
  legacyCode?: string;
  /** legacy 본문의 `details`(0.20 의 register 처럼 싣던 응답) */
  legacyDetails?: unknown;
  /** standard 의 `details.fieldErrors` */
  fieldErrors?: Record<string, string[]>;
  /** standard 의 사용자 문구 덮어쓰기. 없으면 오류 사전 문구 */
  userMessage?: string;
  /** standard 의 숫자 코드 지정(ERROR_CODES 에 없는 key 용) */
  code?: number;
}

/** `errorFormat` 미지정 시의 기본값 (0.22+ 'standard', 0.21 은 'legacy') */
export const DEFAULT_AUTH_ERROR_FORMAT = 'standard' satisfies NonNullable<AuthHandlerOptions['errorFormat']>;

/**
 * 인증 핸들러의 실패 응답을 `errorFormat` 에 맞춰 만든다. 미지정이면 `DEFAULT_AUTH_ERROR_FORMAT` 이다.
 * legacy 는 0.20 의 본문과 바이트 단위로 같아야 한다 — 기존 소비자가 문자열을 비교한다.
 */
export function createAuthResponder(options: Pick<AuthHandlerOptions, 'errorFormat'>) {
  const standard = (options.errorFormat ?? DEFAULT_AUTH_ERROR_FORMAT) === 'standard';

  function error(request: Request | undefined, spec: AuthErrorSpec): NextResponse {
    if (!standard) {
      return NextResponse.json(
        {
          success: false,
          error: spec.message,
          ...(spec.legacyCode !== undefined ? { code: spec.legacyCode } : {}),
          ...(spec.legacyDetails !== undefined ? { details: spec.legacyDetails } : {}),
        },
        { status: spec.status },
      );
    }
    const { body } = buildErrorBody(spec.key, {
      status: spec.status,
      code: spec.code,
      message: spec.message,
      userMessage: spec.userMessage,
      fieldErrors: spec.fieldErrors,
      request,
    });
    return NextResponse.json(body, { status: spec.status });
  }

  /** AuthError(서비스가 던진 인증 오류)를 응답으로 바꾼다. `includeCode` 는 0.20 에서 legacy 에 code 를 싣던 핸들러만 true */
  function fromAuthError(request: Request | undefined, err: AuthError, includeCode: boolean): NextResponse {
    return error(request, {
      status: err.statusCode,
      key: err.code,
      code: AUTH_ERROR_CODE_MAP[err.code],
      message: err.message,
      legacyCode: includeCode ? err.code : undefined,
    });
  }

  return { error, fromAuthError };
}

/**
 * 요청 본문을 JSON 으로 읽는다. 본문이 없거나 JSON 이 아니면 `undefined` 를 돌려준다(JSON 은 undefined 를 표현할 수 없다).
 * 파싱 예외가 핸들러의 catch 로 가면 500 이 되므로, 호출부는 결과를 스키마 검증에 넘겨 기존 검증 실패(400)로 응답한다.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** zod 실패를 standard 의 fieldErrors 로 바꾼다 */
export function zodFieldErrors(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [field, reasons] of Object.entries(error.flatten().fieldErrors)) {
    if (reasons && reasons.length) out[field] = reasons;
  }
  return out;
}
