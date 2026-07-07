import { ConfigurationError } from '@withwiz/toolkit/core/config/errors';
import { configWarn } from '@withwiz/toolkit/core/config/warn';
import { JWT_DEFAULTS } from '@withwiz/toolkit/core/constants/security';
import { durationToSeconds } from '@withwiz/toolkit/core/auth/duration';

/** 이 값을 초과하는 access 만료면 표준(짧은 access) 유도 경고. */
const LONG_ACCESS_WARN_THRESHOLD_SEC = 24 * 3600;

export type TokenDelivery = 'cookie' | 'header' | 'hybrid';

export interface AuthConfig {
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  cookieSecure?: boolean;
  tokenDelivery?: TokenDelivery;
}

export interface ResolvedAuthConfig {
  jwtSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  cookieSecure: boolean;
  tokenDelivery: TokenDelivery;
}

export function initializeAuth(config: AuthConfig): void {
  globalThis.__withwiz_config ??= {};
  if (globalThis.__withwiz_config.auth) return;
  if (!config.jwtSecret) {
    throw new ConfigurationError('Auth', 'jwtSecret is required');
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

export function resetAuth(): void {
  if (globalThis.__withwiz_config) delete globalThis.__withwiz_config.auth;
}
