import { ConfigurationError } from '@withwiz/toolkit/core/config/errors';
import { configWarn } from '@withwiz/toolkit/core/config/warn';
import { JWT_DEFAULTS } from '@withwiz/toolkit/core/constants/security';
import { durationToSeconds } from '@withwiz/toolkit/core/auth/duration';
import { HOST_COOKIE_PREFIX } from '@withwiz/toolkit/core/auth/cookie-names';

/** 이 값을 초과하는 access 만료면 표준(짧은 access) 유도 경고. */
const LONG_ACCESS_WARN_THRESHOLD_SEC = 24 * 3600;

export type TokenDelivery = 'cookie' | 'header' | 'hybrid';

export interface AuthConfig {
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  cookieSecure?: boolean;
  /**
   * 인증 쿠키(access·refresh·OAuth state)에 `__Host-` 접두사를 쓴다. 기본 false.
   * 같은 등록 도메인의 다른 서브도메인이 쿠키를 심어 공격자 계정으로 로그인시키는 것을 막는다.
   * `cookieSecure: true` 가 필요하고, 켜면 Path=/·Domain 없음으로 고정된다(refresh 쿠키도 모든 경로로 전송된다).
   * 쿠키 이름이 바뀌므로 켜는 시점에 기존 로그인 세션은 끊긴다.
   */
  cookieHostPrefix?: boolean;
  tokenDelivery?: TokenDelivery;
}

export interface ResolvedAuthConfig {
  jwtSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  cookieSecure: boolean;
  cookieHostPrefix: boolean;
  tokenDelivery: TokenDelivery;
}

export function initializeAuth(config: AuthConfig): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.auth) return;
  if (!config.jwtSecret) {
    throw new ConfigurationError('Auth', 'jwtSecret is required');
  }
  if (config.cookieHostPrefix && !config.cookieSecure) {
    throw new ConfigurationError('Auth', 'cookieHostPrefix requires cookieSecure: true');
  }
  if (!config.accessTokenExpiry) {
    configWarn('Auth', `accessTokenExpiry not provided, using default: ${JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES}`);
  }
  if (!config.refreshTokenExpiry) {
    configWarn('Auth', `refreshTokenExpiry not provided, using default: ${JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES}`);
  }
  const accessTokenExpiry = config.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES;
  const refreshTokenExpiry = config.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES;

  // 장수명 access 경고: 표준은 짧은 access(예: 15m) + refresh 회전/재사용탐지.
  // 기본 상수(7d)는 이번 버전에서 유지하되, 24h 초과면 표준을 유도하는 경고.
  // (initializeAuth 는 최초 1회만 실행되므로 경고도 프로세스당 1회.)
  try {
    if (durationToSeconds(accessTokenExpiry) > LONG_ACCESS_WARN_THRESHOLD_SEC) {
      configWarn(
        'Auth',
        `accessTokenExpiry(${accessTokenExpiry})가 24h를 초과합니다. refresh 토큰이 있다면 ` +
          '짧은 access(예: 15m)를 권장합니다 — revoke/만료 효과 극대화.',
      );
    }
  } catch {
    // duration 파싱 실패 시 경고만 건너뜀(초기화는 계속)
  }

  globalThis.__withwiz_config.auth = {
    jwtSecret: config.jwtSecret,
    accessTokenExpiry,
    refreshTokenExpiry,
    cookieSecure: config.cookieSecure ?? false,
    cookieHostPrefix: config.cookieHostPrefix ?? false,
    tokenDelivery: config.tokenDelivery ?? 'hybrid',
  };
}

export function getAuthConfig(): ResolvedAuthConfig {
  const auth = globalThis.__withwiz_config?.auth;
  if (!auth) {
    throw new ConfigurationError('Auth', 'Not initialized. Call initializeAuth() first.');
  }
  return auth;
}

/** `cookieHostPrefix` 가 켜져 있는지. 미초기화면 false. */
export function isCookieHostPrefixEnabled(): boolean {
  return globalThis.__withwiz_config?.auth?.cookieHostPrefix ?? false;
}

/** 설정을 반영한 인증 쿠키 이름. 읽고 쓰는 쪽이 모두 이 함수를 거쳐야 이름이 어긋나지 않는다. */
export function authCookieName(name: string): string {
  return isCookieHostPrefixEnabled() ? `${HOST_COOKIE_PREFIX}${name}` : name;
}

export function resetAuth(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.auth;
}
