/**
 * AppError - 애플리케이션 통합 에러 클래스
 *
 * HTTP 상태 코드를 확장한 5자리 에러 코드 체계 (XXXYY)
 * - XXX: HTTP 상태 코드
 * - YY: 세부 순번
 *
 * 사용자 친화적 메시지 제공 (에러 코드는 별도 필드로 제공)
 */

import {
  ERROR_CODES,
  formatErrorMessage,
  getHttpStatus,
  getErrorCategory,
} from "@withwiz/constants/error-codes";
import type {
  ErrorCodeKey,
  IErrorCodeInfo,
} from "@withwiz/constants/error-codes";

/**
 * 에러 상세 정보 인터페이스
 */
export interface IErrorDetails {
  field?: string;
  value?: unknown;
  constraint?: string;
  [key: string]: unknown;
}

/**
 * 직렬화된 에러 형식
 */
export interface ISerializedError {
  code: number;
  message: string;
  status: number;
  key: string;
  category: ReturnType<typeof getErrorCategory>;
  details?: IErrorDetails;
  timestamp: string;
  requestId?: string;
}

/**
 * AppError - 통합 애플리케이션 에러
 *
 * @example
 * // 에러 코드 키로 생성
 * throw AppError.fromKey('NOT_FOUND', '링크를 찾을 수 없습니다');
 *
 * // 직접 생성
 * throw new AppError(40403, '링크를 찾을 수 없습니다');
 *
 * // 팩토리 메서드 사용
 * throw AppError.notFound('링크를 찾을 수 없습니다');
 */
export class AppError extends Error {
  public readonly code: number;
  public readonly status: number;
  public readonly key: string;
  public readonly category: ReturnType<typeof getErrorCategory>;
  public readonly details?: IErrorDetails;
  public readonly timestamp: Date;
  public requestId?: string;

  constructor(
    code: number,
    message?: string,
    details?: IErrorDetails,
    requestId?: string,
  ) {
    const formattedMessage = formatErrorMessage(code, message);
    super(formattedMessage);

    this.name = "AppError";
    this.code = code;
    this.status = getHttpStatus(code);
    this.key = this.findErrorKey(code);
    this.category = getErrorCategory(code);
    this.details = details;
    this.timestamp = new Date();
    this.requestId = requestId;

    // 프로토타입 체인 유지 (ES6 클래스 상속 호환)
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * 에러 코드로 에러 키 찾기
   */
  private findErrorKey(code: number): string {
    const entry = Object.entries(ERROR_CODES).find(([, v]) => v.code === code);
    return entry ? entry[0] : "UNKNOWN";
  }

  /**
   * JSON 직렬화
   */
  toJSON(): ISerializedError {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      key: this.key,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      requestId: this.requestId,
    };
  }

  /**
   * 사용자 친화적 메시지 반환
   */
  toFriendlyMessage(): string {
    return this.message;
  }

  /**
   * 에러가 특정 카테고리인지 확인
   */
  isCategory(category: ReturnType<typeof getErrorCategory>): boolean {
    return this.category === category;
  }

  /**
   * 로깅용 문자열 반환
   */
  toLogString(): string {
    return `[${this.code}] ${this.message} | ${this.category} | ${this.requestId || "no-request-id"}`;
  }

  // ============================================
  // 정적 팩토리 메서드
  // ============================================

  /**
   * 에러 코드 키로 에러 생성
   */
  static fromKey(
    key: ErrorCodeKey,
    customMessage?: string,
    details?: IErrorDetails,
  ): AppError {
    const errorInfo = ERROR_CODES[key];
    return new AppError(
      errorInfo.code,
      customMessage || errorInfo.message,
      details,
    );
  }

  /**
   * 에러 정보로 에러 생성
   */
  static fromErrorInfo(
    errorInfo: IErrorCodeInfo,
    customMessage?: string,
    details?: IErrorDetails,
  ): AppError {
    return new AppError(
      errorInfo.code,
      customMessage || errorInfo.message,
      details,
    );
  }

  /**
   * 알 수 없는 에러를 AppError로 변환
   */
  static from(error: unknown, fallbackMessage?: string): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      // 에러 메시지에서 에러 코드 추출 시도
      const codeMatch = error.message.match(/\[(\d{5})\]/);
      if (codeMatch) {
        const code = parseInt(codeMatch[1], 10);
        return new AppError(code, error.message.replace(/\s*\[\d{5}\]$/, ""));
      }

      // 기본 서버 에러로 변환
      return new AppError(
        ERROR_CODES.SERVER_ERROR.code,
        fallbackMessage || ERROR_CODES.SERVER_ERROR.message,
      );
    }

    // 알 수 없는 타입
    return new AppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      fallbackMessage || ERROR_CODES.INTERNAL_SERVER_ERROR.message,
    );
  }

  // ============================================
  // 검증 에러 (400xx)
  // ============================================

  static validation(message?: string, details?: IErrorDetails): AppError {
    return AppError.fromKey("VALIDATION_ERROR", message, details);
  }

  static badRequest(message?: string, details?: IErrorDetails): AppError {
    return AppError.fromKey("BAD_REQUEST", message, details);
  }

  static invalidInput(message?: string, details?: IErrorDetails): AppError {
    return AppError.fromKey("INVALID_INPUT", message, details);
  }

  static missingField(fieldName: string): AppError {
    return AppError.fromKey(
      "MISSING_REQUIRED_FIELD",
      `필수 항목 '${fieldName}'이(가) 누락되었습니다.`,
      { field: fieldName },
    );
  }

  static invalidUrl(url?: string): AppError {
    return AppError.fromKey("INVALID_URL_FORMAT", undefined, { value: url });
  }

  static invalidEmail(email?: string): AppError {
    return AppError.fromKey("INVALID_EMAIL_FORMAT", undefined, {
      value: email,
    });
  }

  static weakPassword(): AppError {
    return AppError.fromKey("PASSWORD_TOO_WEAK");
  }

  static invalidAlias(alias?: string): AppError {
    return AppError.fromKey("INVALID_ALIAS_FORMAT", undefined, {
      value: alias,
    });
  }

  // ============================================
  // 인증 에러 (401xx)
  // ============================================

  static unauthorized(message?: string): AppError {
    return AppError.fromKey("UNAUTHORIZED", message);
  }

  static invalidToken(): AppError {
    return AppError.fromKey("INVALID_TOKEN");
  }

  static tokenExpired(): AppError {
    return AppError.fromKey("TOKEN_EXPIRED");
  }

  static invalidCredentials(): AppError {
    return AppError.fromKey("INVALID_CREDENTIALS");
  }

  static sessionExpired(): AppError {
    return AppError.fromKey("SESSION_EXPIRED");
  }

  // ============================================
  // 권한 에러 (403xx)
  // ============================================

  static forbidden(message?: string): AppError {
    return AppError.fromKey("FORBIDDEN", message);
  }

  static emailNotVerified(): AppError {
    return AppError.fromKey("EMAIL_NOT_VERIFIED");
  }

  static accountDisabled(): AppError {
    return AppError.fromKey("ACCOUNT_DISABLED");
  }

  static accountLocked(): AppError {
    return AppError.fromKey("ACCOUNT_LOCKED");
  }

  // ============================================
  // 리소스 에러 (404xx)
  // ============================================

  static notFound(message?: string): AppError {
    return AppError.fromKey("NOT_FOUND", message);
  }

  static userNotFound(): AppError {
    return AppError.fromKey("USER_NOT_FOUND");
  }

  static linkNotFound(): AppError {
    return AppError.fromKey("LINK_NOT_FOUND");
  }

  static tagNotFound(): AppError {
    return AppError.fromKey("TAG_NOT_FOUND");
  }

  static favoriteNotFound(): AppError {
    return AppError.fromKey("FAVORITE_NOT_FOUND");
  }

  static groupNotFound(): AppError {
    return AppError.fromKey("GROUP_NOT_FOUND");
  }

  // ============================================
  // 충돌 에러 (409xx)
  // ============================================

  static conflict(message?: string): AppError {
    return AppError.fromKey("CONFLICT", message);
  }

  static duplicate(resourceName?: string): AppError {
    const message = resourceName
      ? `'${resourceName}'은(는) 이미 존재합니다.`
      : undefined;
    return AppError.fromKey("DUPLICATE_RESOURCE", message);
  }

  static emailExists(email?: string): AppError {
    return AppError.fromKey("EMAIL_ALREADY_EXISTS", undefined, {
      value: email,
    });
  }

  static aliasExists(alias?: string): AppError {
    return AppError.fromKey("ALIAS_ALREADY_EXISTS", undefined, {
      value: alias,
    });
  }

  // ============================================
  // 비즈니스 로직 에러 (422xx)
  // ============================================

  static businessRule(message?: string, details?: IErrorDetails): AppError {
    return AppError.fromKey("BUSINESS_RULE_VIOLATION", message, details);
  }

  static invalidOperation(message?: string): AppError {
    return AppError.fromKey("INVALID_OPERATION", message);
  }

  static quotaExceeded(quotaType?: string): AppError {
    const message = quotaType
      ? `${quotaType} 사용량을 초과했습니다.`
      : undefined;
    return AppError.fromKey("QUOTA_EXCEEDED", message);
  }

  static linkExpired(): AppError {
    return AppError.fromKey("LINK_EXPIRED");
  }

  static linkInactive(): AppError {
    return AppError.fromKey("LINK_INACTIVE");
  }

  static linkPasswordRequired(): AppError {
    return AppError.fromKey("LINK_PASSWORD_REQUIRED");
  }

  static linkPasswordIncorrect(): AppError {
    return AppError.fromKey("LINK_PASSWORD_INCORRECT");
  }

  static reservedWord(word?: string): AppError {
    return AppError.fromKey("RESERVED_WORD_USED", undefined, { value: word });
  }

  static alreadyFavorited(): AppError {
    return AppError.fromKey("ALREADY_FAVORITED");
  }

  static cannotDeleteOwnAccount(): AppError {
    return AppError.fromKey("CANNOT_DELETE_OWN_ACCOUNT");
  }

  static fileTooLarge(maxSize?: string): AppError {
    const message = maxSize
      ? `파일 크기가 ${maxSize}를 초과했습니다.`
      : undefined;
    return AppError.fromKey("FILE_TOO_LARGE", message);
  }

  static unsupportedFileType(fileType?: string): AppError {
    const message = fileType
      ? `'${fileType}' 형식은 지원하지 않습니다.`
      : undefined;
    return AppError.fromKey("UNSUPPORTED_FILE_TYPE", message);
  }

  // ============================================
  // Rate Limiting (429xx)
  // ============================================

  static rateLimit(retryAfter?: number): AppError {
    const details = retryAfter ? { retryAfter } : undefined;
    return AppError.fromKey("RATE_LIMIT_EXCEEDED", undefined, details);
  }

  static dailyLimit(): AppError {
    return AppError.fromKey("DAILY_LIMIT_EXCEEDED");
  }

  static apiQuotaExceeded(): AppError {
    return AppError.fromKey("API_QUOTA_EXCEEDED");
  }

  // ============================================
  // 서버 에러 (500xx)
  // ============================================

  static serverError(message?: string): AppError {
    return AppError.fromKey("SERVER_ERROR", message);
  }

  static internalError(message?: string): AppError {
    return AppError.fromKey("INTERNAL_SERVER_ERROR", message);
  }

  static databaseError(message?: string): AppError {
    return AppError.fromKey("DATABASE_ERROR", message);
  }

  static emailSendFailed(): AppError {
    return AppError.fromKey("EMAIL_SEND_FAILED");
  }

  static cacheError(): AppError {
    return AppError.fromKey("CACHE_ERROR");
  }

  static fileUploadFailed(): AppError {
    return AppError.fromKey("FILE_UPLOAD_FAILED");
  }

  // ============================================
  // 서비스 불가 (503xx)
  // ============================================

  static externalServiceError(serviceName?: string): AppError {
    const message = serviceName
      ? `'${serviceName}' 서비스에 연결할 수 없습니다.`
      : undefined;
    return AppError.fromKey("EXTERNAL_SERVICE_ERROR", message);
  }

  static serviceUnavailable(message?: string): AppError {
    return AppError.fromKey("SERVICE_UNAVAILABLE", message);
  }

  // ============================================
  // 보안 에러 (403xx - 71~79)
  // ============================================

  static accessBlocked(reason?: string): AppError {
    return AppError.fromKey("ACCESS_BLOCKED", reason);
  }

  static securityValidationFailed(): AppError {
    return AppError.fromKey("SECURITY_VALIDATION_FAILED");
  }

  static blockedUrl(url?: string): AppError {
    return AppError.fromKey("BLOCKED_URL", undefined, { value: url });
  }

  static suspiciousActivity(): AppError {
    return AppError.fromKey("SUSPICIOUS_ACTIVITY");
  }

  static ipBlocked(ip?: string): AppError {
    return AppError.fromKey("IP_BLOCKED", undefined, { value: ip });
  }
}

export default AppError;

// ============================================================================
// URL Shortener 서비스 특화 에러 사용법
// ============================================================================
// 순환 의존성 방지를 위해 이 파일에서 직접 re-export하지 않습니다.
// 대신 다음과 같이 import 하세요:
//
// import { LinkAppError } from '@withwiz/extensions/url-shortener';
// 또는
// import { LinkAppError } from '@withwiz/extensions/url-shortener/link-app-error';
