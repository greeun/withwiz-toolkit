/**
 * Error Code Constant Definitions
 * All API errors use these constants for consistency.
 *
 * Error Code Format: 5-digit HTTP extended code (XXXYY)
 * - XXX: HTTP status code (400, 401, 403, 404, 409, 422, 429, 500, 503)
 * - YY: Detail sequence (01~99)
 *
 * Categories:
 * - 400xx: Validation errors
 * - 401xx: Authentication errors
 * - 403xx (01-09): Permission errors
 * - 403xx (71-79): Security errors
 * - 404xx: Resource not found
 * - 409xx: Conflict
 * - 422xx: Business logic errors
 * - 429xx: Rate Limit
 * - 500xx: Server errors
 * - 503xx: Service unavailable
 */

// HTTP Status Code Mapping
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Code Definitions (5-digit HTTP extended code)
export const ERROR_CODES = {
  // ============================================
  // Validation Related (400xx)
  // ============================================
  VALIDATION_ERROR: {
    code: 40001,
    key: "VALIDATION_ERROR",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Invalid input values.",
  },
  BAD_REQUEST: {
    code: 40002,
    key: "BAD_REQUEST",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Invalid request.",
  },
  INVALID_INPUT: {
    code: 40003,
    key: "INVALID_INPUT",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Invalid input.",
  },
  MISSING_REQUIRED_FIELD: {
    code: 40004,
    key: "MISSING_REQUIRED_FIELD",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Required field is missing.",
  },
  INVALID_URL_FORMAT: {
    code: 40005,
    key: "INVALID_URL_FORMAT",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Invalid URL format.",
  },
  INVALID_EMAIL_FORMAT: {
    code: 40006,
    key: "INVALID_EMAIL_FORMAT",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Invalid email format.",
  },
  PASSWORD_TOO_WEAK: {
    code: 40007,
    key: "PASSWORD_TOO_WEAK",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Password is too weak.",
  },

  // ============================================
  // Authentication Related (401xx)
  // ============================================
  UNAUTHORIZED: {
    code: 40101,
    key: "UNAUTHORIZED",
    status: HTTP_STATUS.UNAUTHORIZED,
    message: "Authentication required.",
  },
  INVALID_TOKEN: {
    code: 40102,
    key: "INVALID_TOKEN",
    status: HTTP_STATUS.UNAUTHORIZED,
    message: "Invalid token.",
  },
  TOKEN_EXPIRED: {
    code: 40103,
    key: "TOKEN_EXPIRED",
    status: HTTP_STATUS.UNAUTHORIZED,
    message: "Token has expired.",
  },
  INVALID_CREDENTIALS: {
    code: 40106,
    key: "INVALID_CREDENTIALS",
    status: HTTP_STATUS.UNAUTHORIZED,
    message: "Invalid email or password.",
  },
  SESSION_EXPIRED: {
    code: 40107,
    key: "SESSION_EXPIRED",
    status: HTTP_STATUS.UNAUTHORIZED,
    message: "Session has expired.",
  },

  // ============================================
  // Permissions Related (403xx - 01~09)
  // Reserved: 40301~40303 (미사용, 향후 세분화 확장용)
  // ============================================
  FORBIDDEN: {
    code: 40304,
    key: "FORBIDDEN",
    status: HTTP_STATUS.FORBIDDEN,
    message: "Access denied.",
  },
  EMAIL_NOT_VERIFIED: {
    code: 40305,
    key: "EMAIL_NOT_VERIFIED",
    status: HTTP_STATUS.FORBIDDEN,
    message: "Email verification required.",
  },
  // Reserved: 40306~40307 (미사용, 향후 확장용)
  ACCOUNT_DISABLED: {
    code: 40308,
    key: "ACCOUNT_DISABLED",
    status: HTTP_STATUS.FORBIDDEN,
    message: "Account is disabled.",
  },
  ACCOUNT_LOCKED: {
    code: 40309,
    key: "ACCOUNT_LOCKED",
    status: HTTP_STATUS.FORBIDDEN,
    message: "Account is locked.",
  },

  // ============================================
  // Resource Not Found (404xx)
  // Reserved: 40404~40407 (미사용, 향후 리소스 타입 확장용)
  // ============================================
  NOT_FOUND: {
    code: 40401,
    key: "NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "Requested resource not found.",
  },
  USER_NOT_FOUND: {
    code: 40402,
    key: "USER_NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "User not found.",
  },

  // ============================================
  // Conflict (409xx)
  // Reserved: 40901~40903 (미사용, 향후 확장용)
  // ============================================
  CONFLICT: {
    code: 40904,
    key: "CONFLICT",
    status: HTTP_STATUS.CONFLICT,
    message: "Resource conflict occurred.",
  },
  DUPLICATE_RESOURCE: {
    code: 40905,
    key: "DUPLICATE_RESOURCE",
    status: HTTP_STATUS.CONFLICT,
    message: "Resource already exists.",
  },
  EMAIL_ALREADY_EXISTS: {
    code: 40906,
    key: "EMAIL_ALREADY_EXISTS",
    status: HTTP_STATUS.CONFLICT,
    message: "Email is already registered.",
  },

  // ============================================
  // Business Logic (422xx)
  // ============================================
  BUSINESS_RULE_VIOLATION: {
    code: 42201,
    key: "BUSINESS_RULE_VIOLATION",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Unable to process the request.",
  },
  INVALID_OPERATION: {
    code: 42202,
    key: "INVALID_OPERATION",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Invalid operation.",
  },
  QUOTA_EXCEEDED: {
    code: 42203,
    key: "QUOTA_EXCEEDED",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Usage quota exceeded.",
  },
  FILE_TOO_LARGE: {
    code: 42211,
    key: "FILE_TOO_LARGE",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "File size exceeds the limit.",
  },
  UNSUPPORTED_FILE_TYPE: {
    code: 42212,
    key: "UNSUPPORTED_FILE_TYPE",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Unsupported file type.",
  },

  // ============================================
  // Rate Limiting (429xx)
  // ============================================
  RATE_LIMIT_EXCEEDED: {
    code: 42901,
    key: "RATE_LIMIT_EXCEEDED",
    status: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: "Too many requests. Please try again later.",
  },
  DAILY_LIMIT_EXCEEDED: {
    code: 42902,
    key: "DAILY_LIMIT_EXCEEDED",
    status: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: "Daily limit exceeded.",
  },
  API_QUOTA_EXCEEDED: {
    code: 42903,
    key: "API_QUOTA_EXCEEDED",
    status: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: "API quota exceeded.",
  },

  // ============================================
  // Server Errors (500xx)
  // ============================================
  INTERNAL_SERVER_ERROR: {
    code: 50001,
    key: "INTERNAL_SERVER_ERROR",
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: "Internal server error occurred.",
  },
  SERVER_ERROR: {
    code: 50002,
    key: "SERVER_ERROR",
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: "A temporary error occurred.",
  },
  DATABASE_ERROR: {
    code: 50003,
    key: "DATABASE_ERROR",
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: "An error occurred during data processing.",
  },
  // Reserved: 50004~50005 (미사용, 향후 서버 에러 세분화용)
  EMAIL_SEND_FAILED: {
    code: 50006,
    key: "EMAIL_SEND_FAILED",
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: "Failed to send email.",
  },
  CACHE_ERROR: {
    code: 50007,
    key: "CACHE_ERROR",
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: "An error occurred during cache processing.",
  },
  FILE_UPLOAD_FAILED: {
    code: 50008,
    key: "FILE_UPLOAD_FAILED",
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: "Failed to upload file.",
  },

  // ============================================
  // Service Unavailable (503xx)
  // Reserved: 50301~50303 (미사용, 향후 확장용)
  // ============================================
  EXTERNAL_SERVICE_ERROR: {
    code: 50304,
    key: "EXTERNAL_SERVICE_ERROR",
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    message: "Unable to connect to external service.",
  },
  SERVICE_UNAVAILABLE: {
    code: 50305,
    key: "SERVICE_UNAVAILABLE",
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    message: "Service is temporarily unavailable.",
  },

  // ============================================
  // Security Related (403xx - 71~79)
  // ============================================
  ACCESS_BLOCKED: {
    code: 40371,
    key: "ACCESS_BLOCKED",
    status: HTTP_STATUS.FORBIDDEN,
    message: "Blocked due to security policy.",
  },
  SECURITY_VALIDATION_FAILED: {
    code: 40372,
    key: "SECURITY_VALIDATION_FAILED",
    status: HTTP_STATUS.FORBIDDEN,
    message: "Security validation failed.",
  },
  BLOCKED_URL: {
    code: 40373,
    key: "BLOCKED_URL",
    status: HTTP_STATUS.FORBIDDEN,
    message: "Blocked URL.",
  },
  SUSPICIOUS_ACTIVITY: {
    code: 40374,
    key: "SUSPICIOUS_ACTIVITY",
    status: HTTP_STATUS.FORBIDDEN,
    message: "Suspicious activity detected.",
  },
  IP_BLOCKED: {
    code: 40375,
    key: "IP_BLOCKED",
    status: HTTP_STATUS.FORBIDDEN,
    message: "IP is blocked.",
  },
  CORS_VIOLATION: {
    code: 40376,
    key: "CORS_VIOLATION",
    status: HTTP_STATUS.FORBIDDEN,
    message: "CORS policy violation.",
  },
} as const;

// Type Extraction
export type ErrorCodeKey = keyof typeof ERROR_CODES;
export type ErrorCodeValue = (typeof ERROR_CODES)[ErrorCodeKey];

// Error Code Interface (for API Response)
export interface IErrorCodeInfo {
  code: number;
  key: string;
  status: number;
  message: string;
}

// Get error info from error code key
export function getErrorInfo(codeKey: ErrorCodeKey): IErrorCodeInfo {
  return ERROR_CODES[codeKey];
}

// Get error info from 5-digit error code
export function getErrorByCode(code: number): IErrorCodeInfo | null {
  const entry = Object.values(ERROR_CODES).find((e) => e.code === code);
  return entry || null;
}

// Extract HTTP status code (first 3 digits)
export function getHttpStatus(code: number): number {
  return Math.floor(code / 100);
}

// Get error category
export function getErrorCategory(
  code: number,
):
  | "validation"
  | "auth"
  | "permission"
  | "resource"
  | "conflict"
  | "business"
  | "rateLimit"
  | "server"
  | "security"
  | "unknown" {
  const httpStatus = getHttpStatus(code);
  const subCode = code % 100;

  switch (httpStatus) {
    case 400:
      return "validation";
    case 401:
      return "auth";
    case 403:
      return subCode >= 71 ? "security" : "permission";
    case 404:
      return "resource";
    case 409:
      return "conflict";
    case 422:
      return "business";
    case 429:
      return "rateLimit";
    case 500:
    case 503:
      return "server";
    default:
      return "unknown";
  }
}

// Get default error message by HTTP status code
export function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Invalid request.";
    case 401:
      return "Authentication required.";
    case 403:
      return "Access denied.";
    case 404:
      return "Requested resource not found.";
    case 409:
      return "Resource conflict occurred.";
    case 422:
      return "Unable to process request.";
    case 429:
      return "Too many requests.";
    case 500:
      return "Server error occurred.";
    case 503:
      return "Service temporarily unavailable.";
    default:
      return "An error occurred.";
  }
}

// Determine log level based on error status
export function getLogLevel(
  status: number,
): "debug" | "info" | "warn" | "error" {
  if (status < 400) return "info";
  if (status < 500) return "warn";
  return "error";
}

// Get all error codes list (for documentation)
export function getAllErrorCodes(): IErrorCodeInfo[] {
  return Object.values(ERROR_CODES);
}

// Get error codes list by category
export function getErrorCodesByCategory(
  category:
    | "validation"
    | "auth"
    | "permission"
    | "resource"
    | "conflict"
    | "business"
    | "rateLimit"
    | "server"
    | "security",
): IErrorCodeInfo[] {
  return Object.values(ERROR_CODES).filter(
    (e) => getErrorCategory(e.code) === category,
  );
}

// Format error message (code is separate field in response, not appended to message)
export function formatErrorMessage(
  code: number,
  customMessage?: string,
): string {
  const errorInfo = getErrorByCode(code);
  return (
    customMessage ||
    errorInfo?.message ||
    getDefaultErrorMessage(getHttpStatus(code))
  );
}

// ============================================================================
// Error Classification from Unknown Errors
// ============================================================================

/**
 * 알 수 없는 Error 인스턴스에서 에러 메시지/코드 패턴을 분석하여
 * 가장 적합한 에러코드를 반환하는 공통 함수.
 *
 * AppError.from(), processError(), resolveErrorCode() 등에서 공유.
 */
export function classifyError(error: Error): IErrorCodeInfo {
  const msg = error.message.toLowerCase();
  const errCode = (error as NodeJS.ErrnoException).code;

  // 메시지 기반 클라이언트 에러 분류
  if (msg.includes('not found')) return ERROR_CODES.NOT_FOUND;
  if (msg.includes('unauthorized')) return ERROR_CODES.UNAUTHORIZED;
  if (msg.includes('forbidden') || msg.includes('access denied')) return ERROR_CODES.FORBIDDEN;
  if (msg.includes('too many request') || msg.includes('rate limit')) return ERROR_CODES.RATE_LIMIT_EXCEEDED;

  // DB/Prisma 에러
  if (error.message.match(/P\d{4}/) || msg.includes('database') || msg.includes('prisma')) return ERROR_CODES.DATABASE_ERROR;

  // 네트워크/외부 ���비스 에러
  if (errCode === 'ECONNREFUSED' || errCode === 'ECONNRESET' || errCode === 'ETIMEDOUT' || errCode === 'ENOTFOUND'
    || msg.includes('fetch failed') || msg.includes('network')) return ERROR_CODES.EXTERNAL_SERVICE_ERROR;

  // Redis/캐시 에러
  if (msg.includes('redis') || msg.includes('cache') || msg.includes('upstash')) return ERROR_CODES.CACHE_ERROR;

  // 이메일 전송 에러
  if (msg.includes('email') && (msg.includes('send') || msg.includes('smtp'))) return ERROR_CODES.EMAIL_SEND_FAILED;

  // 파일 업로드 에러
  if (msg.includes('upload') || msg.includes('s3') || msg.includes('r2')) return ERROR_CODES.FILE_UPLOAD_FAILED;

  // 분류 불가
  return ERROR_CODES.SERVER_ERROR;
}

// ============================================================================
// URL Shortener Service Specific Error Code Usage
// ============================================================================
// To prevent circular dependencies, do not re-export directly from this file.
// Instead, import as follows:
//
// import { URL_SHORTENER_ERROR_CODES } from '@withwiz/extensions/url-shortener';
// OR
// import { URL_SHORTENER_ERROR_CODES } from '@withwiz/extensions/url-shortener/url-shortener-errors';
