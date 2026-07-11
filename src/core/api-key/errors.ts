// API 키 코어 typed error — 소비자가 메시지 문자열 매칭 없이 code로 판별한다.
// HTTP 상태 매핑은 경계(consumer) 책임: 예) account 계층은 NOT_FOUND/OWNERSHIP을
// 단일 응답으로 합쳐 리소스 존재를 은닉(IDOR 방어)하고, admin 계층은 구분 노출한다.

export const API_KEY_ERROR_CODES = {
  /** 대상 API 키 미존재 */
  NOT_FOUND: 'API_KEY_NOT_FOUND',
  /** 비소유자 접근 (admin 우회 제외) */
  OWNERSHIP: 'API_KEY_OWNERSHIP',
  /** 제한 플랜(restrictedPlans)의 발급 시도 */
  PLAN_RESTRICTED: 'API_KEY_PLAN_RESTRICTED',
  /** 플랜별 활성 키 한도 초과 */
  LIMIT_REACHED: 'API_KEY_LIMIT_REACHED',
} as const;

export type ApiKeyErrorCode =
  (typeof API_KEY_ERROR_CODES)[keyof typeof API_KEY_ERROR_CODES];

export class ApiKeyError extends Error {
  constructor(
    message: string,
    public readonly code: ApiKeyErrorCode
  ) {
    super(message);
    this.name = 'ApiKeyError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiKeyError);
    }
  }
}

/**
 * ApiKeyError 판별 가드. instanceof 대신 name+code 구조 검사를 사용해
 * 패키지 중복 설치(모듈 인스턴스 분리) 환경에서도 판별이 깨지지 않는다.
 * code를 지정하면 해당 코드까지 일치해야 true.
 */
export function isApiKeyError(
  error: unknown,
  code?: ApiKeyErrorCode
): error is ApiKeyError {
  if (
    !(error instanceof Error) ||
    error.name !== 'ApiKeyError' ||
    typeof (error as ApiKeyError).code !== 'string'
  ) {
    return false;
  }
  return code === undefined || (error as ApiKeyError).code === code;
}
