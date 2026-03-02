/**
 * 범용 메시지 상수
 *
 * 프로젝트 독립적인 에러, 성공, 정보 메시지
 */

// ===== 범용 에러 메시지 =====
export const GENERIC_ERROR_MESSAGES = {
  // 인증 관련 (범용)
  AUTH: {
    UNAUTHORIZED: 'Authentication required',
    INVALID_TOKEN: 'Invalid or expired token',
    TOKEN_EXPIRED: 'Token has expired',
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_NOT_VERIFIED: 'Email verification required',
    ACCOUNT_DISABLED: 'Account is disabled',
    ADMIN_REQUIRED: 'Admin privileges required',
    PASSWORD_NOT_SET: 'Password not set. Please use OAuth login or set a password first.',
  },

  // 리소스 관련 (범용)
  RESOURCE: {
    NOT_FOUND: 'Resource not found',
    USER_NOT_FOUND: 'User not found',
  },

  // 검증 관련 (범용)
  VALIDATION: {
    INVALID_INPUT: 'Invalid input data',
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_URL: 'Please enter a valid URL',
    PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
    PASSWORD_TOO_LONG: 'Password must be 128 characters or less',
    PASSWORD_REQUIRED: 'Password is required',
    INVALID_FORMAT: 'Invalid format',
  },

  // 서버 관련 (범용)
  SERVER: {
    INTERNAL_ERROR: 'Internal server error',
    SERVER_ERROR: 'Server error occurred',
    DATABASE_ERROR: 'Database error occurred',
    EXTERNAL_SERVICE_ERROR: 'External service unavailable',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  },

  // Rate Limiting (범용)
  RATE_LIMIT: {
    EXCEEDED: 'Too many requests. Please try again later.',
    TRY_AGAIN_LATER: 'Please try again in {seconds} seconds',
  },

  // 보안 (범용)
  SECURITY: {
    CORS_VIOLATION: 'CORS policy violation',
    CSRF_VALIDATION_FAILED: 'CSRF validation failed',
    FORBIDDEN: 'Access denied',
  },
} as const;

// ===== 범용 성공 메시지 =====
export const GENERIC_SUCCESS_MESSAGES = {
  // 인증 관련 (범용)
  AUTH: {
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    REGISTER_SUCCESS: 'Registration successful',
    PASSWORD_CHANGED: 'Password changed successfully',
    EMAIL_VERIFIED: 'Email verified successfully',
    PASSWORD_RESET_SENT: 'Password reset email sent',
  },

  // 리소스 관련 (범용)
  RESOURCE: {
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
  },

  // 일반 (범용)
  GENERAL: {
    OPERATION_SUCCESS: 'Operation completed successfully',
    SAVED: 'Changes saved successfully',
    SENT: 'Sent successfully',
  },
} as const;

// ===== 범용 확인 메시지 =====
export const GENERIC_CONFIRM_MESSAGES = {
  DELETE: 'Are you sure you want to delete this?',
  LOGOUT: 'Are you sure you want to logout?',
  DISCARD_CHANGES: 'Are you sure you want to discard changes?',
  DEACTIVATE: 'Are you sure you want to deactivate this?',
} as const;

// ===== 범용 안내 메시지 =====
export const GENERIC_INFO_MESSAGES = {
  NO_DATA: 'No data available',
  LOADING: 'Loading...',
  PROCESSING: 'Processing...',
  PLEASE_WAIT: 'Please wait...',
  NO_RESULTS: 'No results found',
  EMPTY_LIST: 'The list is empty',
} as const;

// ===== 타입 정의 =====
export type GenericErrorMessageKey = keyof typeof GENERIC_ERROR_MESSAGES;
export type GenericSuccessMessageKey = keyof typeof GENERIC_SUCCESS_MESSAGES;
