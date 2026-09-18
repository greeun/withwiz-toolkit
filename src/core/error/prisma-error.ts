/**
 * Prisma 오류 판정 공통 모듈
 *
 * 배경:
 * Prisma 7 의 오류 메시지에는 난독화된 번들 소스가 통째로 포함될 수 있다.
 * 따라서 `error.message` 에 정규식(`/P\d{4}/`)을 적용해 코드를 추출하면
 * 본문에 우연히 포함된 패턴에 매칭되어 분류 결과가 흔들린다
 * (중복 키 P2002 가 409 대신 500/404 로 응답되는 증상).
 * 또한 `PrismaClientValidationError` 는 `code` 속성이 없어 메시지 기반 분류에서
 * 'unauthorized' 같은 단어에 걸려 401 로 오분류된다.
 *
 * 판정 우선순위:
 *   1. 오류 클래스 이름(`name` / `constructor.name`) — 검증 오류를 먼저 확정
 *   2. `code` / `errorCode` 속성 (`'P2002'` 등)
 *   3. 메시지 앞부분 제한 스캔 (`PRISMA_MESSAGE_SCAN_LIMIT` 자)
 *
 * 이 모듈은 의존성이 없는 leaf 모듈이다.
 * (내부 모듈을 import 하지 않으므로 core/constants/error-codes 에서 참조해도 순환이 없다.)
 */

/** 메시지 폴백 시 검사할 앞부분 길이 — 번들 소스 본문의 우연 매칭 차단 */
export const PRISMA_MESSAGE_SCAN_LIMIT = 200;

/** Prisma 오류 코드 형식 (정확히 일치) */
const PRISMA_CODE_EXACT = /^P\d{4}$/;

/** 메시지 앞부분에서 코드를 찾을 때 사용하는 패턴 */
const PRISMA_CODE_IN_TEXT = /P\d{4}/;

/** Prisma 오류 클래스 이름 접두사 */
const PRISMA_ERROR_NAME_PREFIX = 'PrismaClient';

/** Prisma 오류 종류 */
export type TPrismaErrorKind =
  | 'known-request'
  | 'validation'
  | 'initialization'
  | 'rust-panic'
  | 'unknown-request';

/** Prisma 오류 클래스 이름 → 종류 */
const PRISMA_ERROR_NAME_KINDS: Record<string, TPrismaErrorKind> = {
  PrismaClientKnownRequestError: 'known-request',
  PrismaClientValidationError: 'validation',
  PrismaClientInitializationError: 'initialization',
  PrismaClientRustPanicError: 'rust-panic',
  PrismaClientUnknownRequestError: 'unknown-request',
};

/** Prisma 오류 판정 결과 */
export interface IPrismaErrorInfo {
  /** 오류 종류 */
  kind: TPrismaErrorKind;
  /** Prisma 오류 코드 (`'P2002'` 등). 확인 불가 시 null */
  code: string | null;
  /** 코드 출처 — 'property': error.code/errorCode, 'message': 메시지 앞부분 폴백 */
  source: 'property' | 'message' | null;
  /** 확인된 Prisma 오류 클래스 이름 */
  name: string | null;
}

/** Prisma 코드 → 표준 에러 코드 매핑 */
export interface IPrismaErrorMapping {
  /** 5자리 표준 에러 코드 */
  code: number;
  /** 사용자 노출 메시지 */
  message: string;
  /** HTTP 상태 코드 */
  status: number;
}

/**
 * Prisma 오류 코드 → 표준 에러 코드 매핑 (단일 기준표)
 *
 * next/utils/error-processor(ErrorProcessor.process·handlePrismaError),
 * next/error/error-handler(processError), core/constants/error-codes(classifyError)
 * 가 모두 이 표를 공유한다.
 */
export const PRISMA_ERROR_MAP: Record<string, IPrismaErrorMapping> = {
  P2000: { code: 40001, message: '입력값이 너무 깁니다.', status: 400 },
  P2001: { code: 40401, message: '요청한 레코드를 찾을 수 없습니다.', status: 404 },
  P2002: { code: 40905, message: '이미 존재하는 데이터입니다.', status: 409 },
  P2003: { code: 40001, message: '외래 키 제약 조건 위반입니다.', status: 400 },
  P2004: { code: 40001, message: '데이터베이스 제약 조건 위반입니다.', status: 400 },
  P2005: { code: 40001, message: '유효하지 않은 필드 값입니다.', status: 400 },
  P2006: { code: 40001, message: '유효하지 않은 값입니다.', status: 400 },
  P2011: { code: 40004, message: 'Null 제약 조건 위반입니다.', status: 400 },
  P2014: { code: 40001, message: '필수 관계 위반입니다.', status: 400 },
  P2015: { code: 40401, message: '관련 레코드를 찾을 수 없습니다.', status: 404 },
  P2016: { code: 40001, message: '쿼리 해석 오류입니다.', status: 400 },
  P2017: { code: 40001, message: '관계가 연결되지 않았습니다.', status: 400 },
  P2018: { code: 40401, message: '연결된 레코드를 찾을 수 없습니다.', status: 404 },
  P2025: { code: 40401, message: '요청한 레코드를 찾을 수 없습니다.', status: 404 },
};

/** `PrismaClientValidationError` 등 code 없는 입력 검증 오류의 사용자 메시지 */
export const PRISMA_VALIDATION_MESSAGE = '요청 값이 올바르지 않습니다.';

/** 객체에서 비어 있지 않은 문자열 속성을 읽는다. */
function readStringProp(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/** 클래스 이름 → Prisma 오류 종류 */
function kindFromName(name: string): TPrismaErrorKind {
  return PRISMA_ERROR_NAME_KINDS[name] ?? 'unknown-request';
}

/**
 * Prisma 오류 클래스 이름을 반환한다.
 *
 * Prisma 는 생성자에서 `this.name = 'PrismaClientXxxError'` 를 문자열 리터럴로
 * 지정하므로 번들 난독화 후에도 `name` 은 보존된다. `constructor.name` 은 보조 수단.
 */
export function getPrismaErrorName(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;

  const ctorName = (error as { constructor?: { name?: unknown } }).constructor?.name;
  const candidates: (string | null)[] = [
    readStringProp(error, 'name'),
    typeof ctorName === 'string' && ctorName.length > 0 ? ctorName : null,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.startsWith(PRISMA_ERROR_NAME_PREFIX)) return candidate;
  }
  return null;
}

/** `PrismaClientValidationError` 여부 (입력 검증 오류 → 400) */
export function isPrismaValidationError(error: unknown): boolean {
  return getPrismaErrorName(error) === 'PrismaClientValidationError';
}

/**
 * Prisma 오류를 판정한다. Prisma 오류가 아니면 null.
 *
 * 메시지 스캔은 구조 판정이 모두 실패했을 때만, 앞부분 일정 길이에 한해 수행한다.
 */
export function inspectPrismaError(error: unknown): IPrismaErrorInfo | null {
  if (!error || typeof error !== 'object') return null;

  const name = getPrismaErrorName(error);

  // 1) 검증 오류는 code 가 없으므로 메시지 스캔 이전에 확정한다.
  if (name === 'PrismaClientValidationError') {
    return { kind: 'validation', code: null, source: null, name };
  }

  // 2) code / errorCode 속성 우선
  const rawCode = readStringProp(error, 'code') ?? readStringProp(error, 'errorCode');
  if (rawCode && PRISMA_CODE_EXACT.test(rawCode)) {
    return {
      kind: name ? kindFromName(name) : 'known-request',
      code: rawCode,
      source: 'property',
      name,
    };
  }

  // 3) code 가 없는 나머지 Prisma 오류 클래스
  if (name) {
    return { kind: kindFromName(name), code: null, source: null, name };
  }

  // 4) 폴백: 메시지 앞부분만 스캔 (번들 소스 본문 매칭 방지)
  const message = readStringProp(error, 'message');
  if (!message) return null;

  const match = message.slice(0, PRISMA_MESSAGE_SCAN_LIMIT).match(PRISMA_CODE_IN_TEXT);
  if (!match) return null;

  return { kind: 'known-request', code: match[0], source: 'message', name: null };
}

/** Prisma 오류 코드를 반환한다 (없으면 null). */
export function getPrismaErrorCode(error: unknown): string | null {
  return inspectPrismaError(error)?.code ?? null;
}

/** Prisma 오류 여부 */
export function isPrismaError(error: unknown): boolean {
  return inspectPrismaError(error) !== null;
}

/** Prisma 코드에 대응하는 표준 에러 코드 매핑을 반환한다. */
export function getPrismaErrorMapping(
  prismaCode: string | null | undefined,
): IPrismaErrorMapping | undefined {
  if (!prismaCode) return undefined;
  return Object.prototype.hasOwnProperty.call(PRISMA_ERROR_MAP, prismaCode)
    ? PRISMA_ERROR_MAP[prismaCode]
    : undefined;
}
