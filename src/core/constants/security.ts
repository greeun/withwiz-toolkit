/**
 * 보안 관련 상수
 * 프레임워크 독립적인 보안 설정
 */

// ============================================================================
// JWT 설정 (환경 독립적)
// ============================================================================

export const JWT_DEFAULTS = {
  /** 알고리즘 */
  ALGORITHM: 'HS256' as const,
  /** 기본 액세스 토큰 만료 기간 */
  DEFAULT_ACCESS_TOKEN_EXPIRES: '7d',
  /** 기본 리프레시 토큰 만료 기간 */
  DEFAULT_REFRESH_TOKEN_EXPIRES: '30d',
  /** 토큰 타입 */
  TOKEN_TYPE: 'Bearer' as const,
} as const;

// ============================================================================
// 역할(Role) 기본값
// ============================================================================

/**
 * 역할 관련 기본값의 단일 소스.
 *
 * toolkit 은 고정 role 어휘를 **소유하지 않는다** — 이 값들은 소비자가 role 을
 * 명시하지 않았을 때의 *기본값*일 뿐이다. 자체 어휘(`PATIENT`/`DOCTOR` 등)를
 * 쓰는 소비자는 항상 role 을 세팅하므로 `DEFAULT_ROLE` 은 발화하지 않으며,
 * `adminMiddleware`/`requireAdmin` 대신 `createRoleMiddleware(MyRole.ADMIN)` 처럼
 * 자체 역할을 직접 넘기면 된다.
 */
export const ROLE_DEFAULTS = {
  /** role 미지정/누락 시 적용되는 기본 역할. */
  DEFAULT_ROLE: 'USER',
  /** `adminMiddleware`·`requireAdmin` 의 기본 관리자 역할 이름. */
  ADMIN_ROLE: 'ADMIN',
} as const;

// ============================================================================
// 이메일 인증 토큰 설정
// ============================================================================

export const EMAIL_VERIFICATION = {
  /** 토큰 만료 시간 (시간 단위) */
  TOKEN_EXPIRES_HOURS: 24,
  /** 토큰 길이 (바이트) */
  TOKEN_LENGTH: 32,
} as const;

// ============================================================================
// 비밀번호 재설정 토큰 설정
// ============================================================================

export const PASSWORD_RESET = {
  /** 토큰 만료 시간 (시간 단위) */
  TOKEN_EXPIRES_HOURS: 1,
  /** 토큰 길이 (바이트) */
  TOKEN_LENGTH: 32,
} as const;

// ============================================================================
// 매직 링크 설정
// ============================================================================

export const MAGIC_LINK = {
  /** 토큰 만료 시간 (분 단위) */
  TOKEN_EXPIRES_MINUTES: 15,
  /** 토큰 길이 (바이트) */
  TOKEN_LENGTH: 32,
} as const;

// ============================================================================
// 세션 설정
// ============================================================================

export const SESSION = {
  /** 세션 쿠키 이름 */
  COOKIE_NAME: 'session',
  /** 세션 만료 시간 (일 단위) */
  EXPIRES_DAYS: 30,
} as const;

// ============================================================================
// OAuth 설정
// ============================================================================

export const OAUTH = {
  /** 상태 토큰 길이 */
  STATE_LENGTH: 32,
  /** 상태 토큰 만료 시간 (분) */
  STATE_EXPIRES_MINUTES: 10,
} as const;

// ============================================================================
// CSRF 설정
// ============================================================================

export const CSRF = {
  /** 토큰 길이 */
  TOKEN_LENGTH: 32,
  /** 헤더 이름 */
  HEADER_NAME: 'X-CSRF-Token',
} as const;

// ============================================================================
// 보안 헤더
// ============================================================================

export const SECURITY_HEADERS = {
  /** Content Security Policy */
  CSP: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  /** X-Frame-Options */
  X_FRAME_OPTIONS: 'DENY',
  /** X-Content-Type-Options */
  X_CONTENT_TYPE_OPTIONS: 'nosniff',
  /** Referrer-Policy */
  REFERRER_POLICY: 'strict-origin-when-cross-origin',
} as const;
