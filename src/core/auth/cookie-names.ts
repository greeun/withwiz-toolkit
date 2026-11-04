/** 인증 쿠키명 단일 소스 (순수 상수 — node/edge 양쪽 안전) */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
/** `cookieHostPrefix` 를 켰을 때 쿠키 이름 앞에 붙는 접두사. 엣지 코드가 이름을 만들 때도 이 값을 쓴다. */
export const HOST_COOKIE_PREFIX = '__Host-';
