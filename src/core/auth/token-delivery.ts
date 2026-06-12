/**
 * 토큰 전달 전략 — tokenDelivery 모드(cookie/header/hybrid)별 구현체.
 *
 * 분기 대신 주입: 미들웨어·핸들러는 모드 문자열을 직접 비교하지 않고
 * getTokenDeliveryStrategy() 가 돌려주는 구현체의 메서드를 호출한다.
 * oauth-callback 은 redirect 응답 특성상 전략 비적용(항상 쿠키).
 */
import type { TokenDelivery } from './config';
import { getAuthConfig } from './config';
import type { TokenPair } from './types';
import { setTokenCookies } from './jwt/cookie';
import type { CookieOptions } from './jwt/cookie';

/** cookies/headers/json 만 구조적으로 요구 — NextRequest 미의존 (core 티어 규칙) */
export interface TokenSource {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
  json?(): Promise<unknown>;
}

/** setTokenCookies 가 요구하는 최소 Response 형태 */
interface CookieSettableResponse {
  cookies: {
    set(name: string, value: string, options?: Record<string, unknown>): void;
  };
}

export interface TokenDeliveryStrategy {
  /** access token 추출. Authorization 헤더 파싱은 호출측 JWT 구현에 위임 */
  extractAccessToken(
    source: TokenSource,
    parseHeader: (header: string | null) => string | null,
  ): string | null;
  /** refresh token 추출 (header/hybrid 는 body { refreshToken } 허용) */
  extractRefreshToken(source: TokenSource): Promise<string | undefined>;
  /** 응답 body 에 토큰 조각 포함 여부 결정 — cookie 모드는 body 그대로 */
  buildTokenResponse(
    body: Record<string, unknown>,
    fragment: Record<string, unknown>,
  ): Record<string, unknown>;
  /** 토큰 쿠키 설정 — header 모드는 no-op */
  attachCookies<T extends CookieSettableResponse>(
    response: T,
    tokens: TokenPair,
    options?: CookieOptions,
  ): T;
}

async function readBodyRefreshToken(source: TokenSource): Promise<string | undefined> {
  if (!source.json) return undefined;
  try {
    const body = (await source.json()) as { refreshToken?: unknown } | null;
    return typeof body?.refreshToken === 'string' ? body.refreshToken : undefined;
  } catch {
    return undefined;
  }
}

const cookieStrategy: TokenDeliveryStrategy = {
  extractAccessToken: (source) => source.cookies.get('access_token')?.value ?? null,
  extractRefreshToken: async (source) => source.cookies.get('refresh_token')?.value,
  buildTokenResponse: (body) => body,
  attachCookies: (response, tokens, options) => setTokenCookies(response, tokens, options),
};

const headerStrategy: TokenDeliveryStrategy = {
  extractAccessToken: (source, parseHeader) => parseHeader(source.headers.get('authorization')),
  extractRefreshToken: (source) => readBodyRefreshToken(source),
  buildTokenResponse: (body, fragment) => ({ ...body, ...fragment }),
  attachCookies: (response) => response,
};

const hybridStrategy: TokenDeliveryStrategy = {
  extractAccessToken: (source, parseHeader) =>
    source.cookies.get('access_token')?.value ??
    parseHeader(source.headers.get('authorization')),
  // 쿠키 우선 — 쿠키가 있으면 body 를 소비하지 않는다 (빈 body 요청 보호)
  extractRefreshToken: async (source) =>
    source.cookies.get('refresh_token')?.value ?? (await readBodyRefreshToken(source)),
  buildTokenResponse: (body, fragment) => ({ ...body, ...fragment }),
  attachCookies: (response, tokens, options) => setTokenCookies(response, tokens, options),
};

const strategies: Record<TokenDelivery, TokenDeliveryStrategy> = {
  cookie: cookieStrategy,
  header: headerStrategy,
  hybrid: hybridStrategy,
};

/**
 * tokenDelivery 모드 해석.
 * 우선순위: 옵션 > 전역 AuthConfig > 'hybrid'
 * 요청 시점에 호출할 것 — 핸들러 팩토리는 initialize() 이전에 실행될 수 있다.
 */
export function resolveTokenDelivery(optionValue?: TokenDelivery): TokenDelivery {
  if (optionValue) return optionValue;
  try {
    return getAuthConfig().tokenDelivery;
  } catch {
    return 'hybrid';
  }
}

/** 해석된 모드의 전략 구현체 반환 */
export function getTokenDeliveryStrategy(optionValue?: TokenDelivery): TokenDeliveryStrategy {
  return strategies[resolveTokenDelivery(optionValue)];
}
