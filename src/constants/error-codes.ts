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
  INVALID_ALIAS_FORMAT: {
    code: 40008,
    key: "INVALID_ALIAS_FORMAT",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Alias can only contain English letters, numbers, -, and _.",
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
  LINK_NOT_FOUND: {
    code: 40403,
    key: "LINK_NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "Link not found.",
  },
  TAG_NOT_FOUND: {
    code: 40408,
    key: "TAG_NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "Tag not found.",
  },
  FAVORITE_NOT_FOUND: {
    code: 40409,
    key: "FAVORITE_NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "Favorite not found.",
  },
  GROUP_NOT_FOUND: {
    code: 40410,
    key: "GROUP_NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "Group not found.",
  },

  // ============================================
  // Conflict (409xx)
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
  ALIAS_ALREADY_EXISTS: {
    code: 40907,
    key: "ALIAS_ALREADY_EXISTS",
    status: HTTP_STATUS.CONFLICT,
    message: "Alias is already in use.",
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
  LINK_EXPIRED: {
    code: 42204,
    key: "LINK_EXPIRED",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Link has expired.",
  },
  LINK_INACTIVE: {
    code: 42205,
    key: "LINK_INACTIVE",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Link is inactive.",
  },
  LINK_PASSWORD_REQUIRED: {
    code: 42206,
    key: "LINK_PASSWORD_REQUIRED",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Link password is required.",
  },
  LINK_PASSWORD_INCORRECT: {
    code: 42207,
    key: "LINK_PASSWORD_INCORRECT",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Incorrect link password.",
  },
  RESERVED_WORD_USED: {
    code: 42208,
    key: "RESERVED_WORD_USED",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Reserved words cannot be used as aliases.",
  },
  ALREADY_FAVORITED: {
    code: 42209,
    key: "ALREADY_FAVORITED",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "Already added to favorites.",
  },
  CANNOT_DELETE_OWN_ACCOUNT: {
    code: 42210,
    key: "CANNOT_DELETE_OWN_ACCOUNT",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "You cannot delete your own account.",
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
// URL Shortener Service Specific Error Code Usage
// ============================================================================
// To prevent circular dependencies, do not re-export directly from this file.
// Instead, import as follows:
//
// import { URL_SHORTENER_ERROR_CODES } from '@withwiz/extensions/url-shortener';
// OR
// import { URL_SHORTENER_ERROR_CODES } from '@withwiz/extensions/url-shortener/url-shortener-errors';
