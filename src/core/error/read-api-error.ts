/**
 * API 오류 응답 판독기 — Core tier (프레임워크 독립)
 *
 * 클라이언트가 실패 응답 본문을 한 형태로 읽게 한다. 두 형태를 모두 받는다.
 * - 표준: `{ error: { code, key, message, userMessage: { description }, requestId, details: { fieldErrors } } }`
 * - 문자열형(`errorFormat: 'legacy'` 인증 핸들러 — 0.21 이하의 기본): `{ error: "…", code?: "…", details?: { fieldErrors } }`
 */

export interface IReadApiError {
  /** 기계 분기용 키 — 표준의 error.key, 문자열형의 code */
  key?: string;
  /** 표준의 숫자 코드(예: 40305) */
  code?: number;
  /** 화면 표시용 문구 — userMessage.description → 문자열 error → message 순. 없으면 빈 문자열 */
  text: string;
  /** 필드별 첫 사유 */
  fieldErrors: Record<string, string>;
  requestId?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function firstFieldErrors(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(details) || !isRecord(details.fieldErrors)) return out;
  for (const [field, reasons] of Object.entries(details.fieldErrors)) {
    if (Array.isArray(reasons) && typeof reasons[0] === "string" && reasons[0]) out[field] = reasons[0];
  }
  return out;
}

/**
 * 실패 응답 본문을 정규화한다. 본문이 객체가 아니면(파싱 실패 등) `text` 가 빈 문자열인 결과를 돌려준다 —
 * 호출부가 자기 기본 문구로 대체한다.
 */
export function readApiError(body: unknown): IReadApiError {
  if (!isRecord(body)) return { text: "", fieldErrors: {} };
  const { error } = body;

  if (isRecord(error)) {
    const userMessage = isRecord(error.userMessage) ? error.userMessage : undefined;
    const description = typeof userMessage?.description === "string" ? userMessage.description : "";
    const message = typeof error.message === "string" ? error.message : "";
    return {
      key: typeof error.key === "string" ? error.key : undefined,
      code: typeof error.code === "number" ? error.code : undefined,
      text: description || message,
      fieldErrors: firstFieldErrors(error.details),
      requestId: typeof error.requestId === "string" ? error.requestId : undefined,
    };
  }

  return {
    key: typeof body.code === "string" ? body.code : undefined,
    text: typeof error === "string" ? error : "",
    fieldErrors: firstFieldErrors(body.details),
  };
}
