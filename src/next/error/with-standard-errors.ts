/**
 * 문자열형 오류 응답을 표준 형태로 다시 쓰는 래퍼 (0.21+)
 *
 * 인증 디스패치 라우트나 소비자의 자체 라우트를 감싸면, 실패 응답 본문이
 * `{ success: false, error: "…", code?, details? }` 일 때 표준 형태로 바꿔 돌려준다.
 * 성공 응답과 이미 표준인 응답, JSON 이 아닌 응답은 그대로 통과한다.
 *
 * 변환 규칙
 * - `error`(문자열) → `message` 와 `userMessage.description` 둘 다(문자열형은 이미 사용자 문구를 담아 왔다)
 * - `code`(문자열) → `key`. 없으면 HTTP 상태의 대표 key
 * - `details.fieldErrors` → 그대로
 * - HTTP 상태와 헤더(Set-Cookie·Retry-After 등)는 보존한다
 */

import { getErrorByCode } from '@withwiz/toolkit/core/constants/error-codes';
import { buildErrorBody, representativeCode } from '@withwiz/toolkit/next/error/build-error-response';
import { AUTH_ERROR_CODE_MAP } from '@withwiz/toolkit/next/error/error-handler';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** 상태별 대표 key — buildErrorBody 가 고르는 대표 코드와 같은 표를 쓴다 */
function representativeKey(status: number): string {
  return getErrorByCode(representativeCode(status))?.key ?? 'BAD_REQUEST';
}

/** 문자열형 본문을 표준 본문으로 바꾼다. 문자열형이 아니면 null */
export function toStandardErrorBody(status: number, body: unknown, request?: Request) {
  if (!isRecord(body) || typeof body.error !== 'string') return null;
  const key = typeof body.code === 'string' && body.code ? body.code : representativeKey(status);
  const fieldErrors =
    isRecord(body.details) && isRecord(body.details.fieldErrors)
      ? (body.details.fieldErrors as Record<string, string[]>)
      : undefined;
  return buildErrorBody(key, {
    // AuthError 의 code 는 인증 핸들러와 같은 숫자 코드로 옮긴다
    code: AUTH_ERROR_CODE_MAP[key],
    status,
    message: body.error,
    userMessage: body.error,
    fieldErrors,
    request,
  }).body;
}

export function withStandardErrors<TArgs extends unknown[]>(
  handler: (request: Request, ...args: TArgs) => Promise<Response> | Response,
) {
  return async (request: Request, ...args: TArgs): Promise<Response> => {
    const response = await handler(request, ...args);
    if (response.ok) return response;
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) return response;

    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      return response;
    }
    const standard = toStandardErrorBody(response.status, body, request);
    if (!standard) return response;

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify(standard), { status: response.status, headers });
  };
}
