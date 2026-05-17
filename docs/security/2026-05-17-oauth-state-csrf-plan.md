# O-1 OAuth state 쿠키 바인딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OAuth `state`를 HttpOnly 쿠키로 피해자 브라우저에 바인딩하고 콜백에서 query↔쿠키를 검증해 로그인 CSRF(O-1, Critical)를 차단한다.

**Architecture:** core 티어에 프레임워크 비의존 `state-cookie.ts`를 신설(`jwt/cookie.ts`의 제네릭 `CookieSettableResponse` 패턴 미러). authorize 핸들러가 nonce를 생성·쿠키 설정·IdP로 전달, callback 핸들러가 코드 교환 **이전**에 query state와 쿠키를 strict 비교해 불일치/부재 시 400. 핸들러는 인덱스 mock 회피를 위해 서브모듈 경로 `@withwiz/core/auth/oauth/state-cookie`에서 import.

**Tech Stack:** TypeScript(strict, ESM), Vitest, jose(무관), Next.js `next/server`(핸들러 한정).

설계 출처: `docs/security/2026-05-17-oauth-state-csrf-design.md`.

---

## File Structure

- Create `src/core/auth/oauth/state-cookie.ts` — state nonce 생성/쿠키 set·clear/검증. core 티어, `next` 비의존.
- Modify `src/core/auth/oauth/index.ts` — `state-cookie` 공개 심볼 re-export(소비자 재사용).
- Modify `src/next/auth-handlers/oauth-authorize.handler.ts` — nonce 생성을 `generateOAuthState()`로, 응답에 `setOAuthStateCookie`.
- Modify `src/next/auth-handlers/oauth-callback.handler.ts` — 코드교환 전 state 검증, 전 종료 경로 쿠키 clear.
- Create `__tests__/unit/auth/oauth-state-cookie.test.ts` — 순수 단위(검증/쿠키 속성).
- Create `__tests__/security/auth/oauth-state-csrf.test.ts` — 핸들러 레벨 CSRF 계약.
- Modify `__tests__/unit/auth/handlers/handlers.test.ts` — 기존 callback 테스트 8개를 새 보안 계약(유효 state 제공)으로 마이그레이션.

---

## Task 1: `validateOAuthState` (순수 함수, TDD)

**Files:**
- Create: `src/core/auth/oauth/state-cookie.ts`
- Test: `__tests__/unit/auth/oauth-state-cookie.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/auth/oauth-state-cookie.test.ts`:

```ts
/**
 * OAuth state-cookie 유닛 (O-1)
 */
import { validateOAuthState } from '@withwiz/core/auth/oauth/state-cookie';

describe('validateOAuthState', () => {
  it('returns true only when both are equal non-empty strings', () => {
    expect(validateOAuthState('abc', 'abc')).toBe(true);
  });

  it('returns false when cookie is missing', () => {
    expect(validateOAuthState(undefined, 'abc')).toBe(false);
    expect(validateOAuthState(null, 'abc')).toBe(false);
    expect(validateOAuthState('', 'abc')).toBe(false);
  });

  it('returns false when query state is missing', () => {
    expect(validateOAuthState('abc', undefined)).toBe(false);
    expect(validateOAuthState('abc', null)).toBe(false);
    expect(validateOAuthState('abc', '')).toBe(false);
  });

  it('returns false on mismatch', () => {
    expect(validateOAuthState('abc', 'abd')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/unit/auth/oauth-state-cookie.test.ts`
Expected: FAIL — cannot resolve `@withwiz/core/auth/oauth/state-cookie` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/core/auth/oauth/state-cookie.ts`:

```ts
/**
 * OAuth state(CSRF) 를 HttpOnly 쿠키로 설정/검증/삭제하는 유틸리티
 *
 * NextResponse 타입을 제네릭으로 처리하여 next 패키지 경로 충돌을
 * 방지한다 (core 티어 — next 비의존, jwt/cookie.ts 패턴 미러).
 */

/** cookies.set() 을 지원하는 Response 타입 */
interface CookieSettableResponse {
  cookies: {
    set(name: string, value: string, options?: Record<string, unknown>): void;
  };
}

export const OAUTH_STATE_COOKIE = 'oauth_state';

const STATE_COOKIE_MAX_AGE = 600; // 10분

export interface OAuthStateCookieOptions {
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  domain?: string;
}

/** CSRF 방지용 OAuth state nonce 생성 */
export function generateOAuthState(): string {
  return crypto.randomUUID();
}

function buildCookieOptions(
  options: OAuthStateCookieOptions,
  maxAge: number,
): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    httpOnly: true,
    secure: options.secure ?? false,
    sameSite: options.sameSite ?? 'lax',
    path: '/',
    maxAge,
  };
  if (options.domain) opts.domain = options.domain;
  return opts;
}

export function setOAuthStateCookie<T extends CookieSettableResponse>(
  response: T,
  state: string,
  options: OAuthStateCookieOptions = {},
): T {
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    state,
    buildCookieOptions(options, STATE_COOKIE_MAX_AGE),
  );
  return response;
}

export function clearOAuthStateCookie<T extends CookieSettableResponse>(
  response: T,
  options: OAuthStateCookieOptions = {},
): T {
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    '',
    buildCookieOptions(options, 0),
  );
  return response;
}

/**
 * 콜백 쿼리 state 와 쿠키 state 의 일치 검증.
 * 양쪽 모두 비공백 문자열이고 strict 일치일 때만 true.
 */
export function validateOAuthState(
  cookieValue: string | null | undefined,
  queryState: string | null | undefined,
): boolean {
  if (typeof cookieValue !== 'string' || typeof queryState !== 'string') {
    return false;
  }
  if (cookieValue.length === 0 || queryState.length === 0) return false;
  return cookieValue === queryState;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/unit/auth/oauth-state-cookie.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/oauth/state-cookie.ts __tests__/unit/auth/oauth-state-cookie.test.ts
git commit -m "$(printf 'feat(auth): O-1 OAuth state-cookie 유틸 — validateOAuthState\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 2: 쿠키 set/clear 속성 (TDD)

**Files:**
- Modify: `src/core/auth/oauth/state-cookie.ts` (이미 Task 1에서 구현됨 — 본 태스크는 동작 고정 테스트 추가)
- Test: `__tests__/unit/auth/oauth-state-cookie.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/unit/auth/oauth-state-cookie.test.ts`:

```ts
import {
  setOAuthStateCookie,
  clearOAuthStateCookie,
  generateOAuthState,
  OAUTH_STATE_COOKIE,
} from '@withwiz/core/auth/oauth/state-cookie';

function fakeResponse() {
  const calls: Array<{ name: string; value: string; opts: any }> = [];
  return {
    calls,
    cookies: {
      set: (name: string, value: string, opts: any) =>
        calls.push({ name, value, opts }),
    },
  };
}

describe('setOAuthStateCookie / clearOAuthStateCookie', () => {
  it('sets an HttpOnly, SameSite=lax, path=/, maxAge=600 cookie', () => {
    const res = fakeResponse();
    setOAuthStateCookie(res, 'nonce-1', { secure: true });
    expect(res.calls).toHaveLength(1);
    const { name, value, opts } = res.calls[0];
    expect(name).toBe(OAUTH_STATE_COOKIE);
    expect(value).toBe('nonce-1');
    expect(opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
  });

  it('clears the cookie with maxAge=0 and empty value', () => {
    const res = fakeResponse();
    clearOAuthStateCookie(res);
    const { name, value, opts } = res.calls[0];
    expect(name).toBe(OAUTH_STATE_COOKIE);
    expect(value).toBe('');
    expect(opts.maxAge).toBe(0);
    expect(opts.httpOnly).toBe(true);
  });

  it('omits domain when not provided, includes it when provided', () => {
    const a = fakeResponse();
    setOAuthStateCookie(a, 's');
    expect('domain' in a.calls[0].opts).toBe(false);

    const b = fakeResponse();
    setOAuthStateCookie(b, 's', { domain: '.example.com' });
    expect(b.calls[0].opts.domain).toBe('.example.com');
  });

  it('generateOAuthState returns a non-empty unique string', () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails first, then passes**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/unit/auth/oauth-state-cookie.test.ts`
Expected: Since Task 1 already implemented these, the new `describe` block PASSES immediately. If any assertion fails, fix `state-cookie.ts` (not the test) until green. (Note: this block characterizes Task 1 code; if it had been deferred it would RED on missing exports.)

- [ ] **Step 3: Run full file to verify all pass**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/unit/auth/oauth-state-cookie.test.ts`
Expected: PASS (8 tests total).

- [ ] **Step 4: Commit**

```bash
git add __tests__/unit/auth/oauth-state-cookie.test.ts
git commit -m "$(printf 'test(auth): O-1 state-cookie set/clear/generate 속성 고정\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 3: oauth/index.ts re-export + 빌드 확인

**Files:**
- Modify: `src/core/auth/oauth/index.ts`

- [ ] **Step 1: Add re-export**

In `src/core/auth/oauth/index.ts`, immediately after the line:

```ts
// Re-export OAUTH_PROVIDERS
export { OAUTH_PROVIDERS };
```

add:

```ts
// Re-export OAuth state-cookie (CSRF) 유틸 — 소비자 커스텀 흐름 재사용
export {
  OAUTH_STATE_COOKIE,
  generateOAuthState,
  setOAuthStateCookie,
  clearOAuthStateCookie,
  validateOAuthState,
} from './state-cookie';
export type { OAuthStateCookieOptions } from './state-cookie';
```

- [ ] **Step 2: Build to verify tsup + tsc emit the new file**

Run: `npm run build`
Expected: `Build success`. Then:

Run: `test -f dist/core/auth/oauth/state-cookie.js && test -f dist/core/auth/oauth/state-cookie.d.ts && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/core/auth/oauth/index.ts
git commit -m "$(printf 'feat(auth): O-1 state-cookie 유틸을 oauth 인덱스에서 re-export\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 4: authorize 핸들러가 state 쿠키를 설정 (TDD)

**Files:**
- Modify: `src/next/auth-handlers/oauth-authorize.handler.ts`
- Test: `__tests__/security/auth/oauth-state-csrf.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/security/auth/oauth-state-csrf.test.ts`:

```ts
/**
 * OAuth 로그인 CSRF — state 쿠키 바인딩 (O-1)
 *
 * 핸들러는 state-cookie 를 서브모듈 경로에서 import 하므로 여기서는
 * OAuthManager / OAuthCallbackService / jwt cookie 만 mock 한다.
 */
import type { AuthHandlerOptions } from '../../../src/next/auth-types/handler-types';

const mockGetLoginUrl = vi.fn();
const mockExchangeCodeForToken = vi.fn();
const mockGetUserInfo = vi.fn();
vi.mock('../../../src/core/auth/oauth', () => ({
  OAuthManager: vi.fn().mockImplementation(function (this: any) {
    this.getLoginUrl = mockGetLoginUrl;
    this.exchangeCodeForToken = mockExchangeCodeForToken;
    this.getUserInfo = mockGetUserInfo;
  }),
}));

const mockHandleCallback = vi.fn();
vi.mock('../../../src/core/auth/services/oauth-callback.service', () => ({
  OAuthCallbackService: vi.fn().mockImplementation(function (this: any) {
    this.handleCallback = mockHandleCallback;
  }),
}));

const mockSetTokenCookies = vi.fn();
vi.mock('../../../src/core/auth/jwt/cookie', () => ({
  setTokenCookies: (...a: any[]) => mockSetTokenCookies(...a),
  clearTokenCookies: vi.fn(),
}));

import { createOAuthAuthorizeHandler } from '../../../src/next/auth-handlers/oauth-authorize.handler';
import { createOAuthCallbackHandler } from '../../../src/next/auth-handlers/oauth-callback.handler';

function options(overrides: Partial<AuthHandlerOptions> = {}): AuthHandlerOptions {
  return {
    dependencies: {
      userRepository: {} as any,
      oauthAccountRepository: {} as any,
      emailTokenRepository: {} as any,
    },
    oauth: {
      google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/cb' },
    },
    jwt: { secret: 'a'.repeat(32) },
    urls: { baseUrl: 'http://localhost:3000' },
    ...overrides,
  };
}

function callbackReq(url: string, cookies: Record<string, string>): any {
  const req = new Request(url, { method: 'GET' }) as any;
  req.cookies = {
    get: (name: string) =>
      cookies[name] !== undefined ? { name, value: cookies[name] } : undefined,
  };
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('O-1 authorize: sets oauth_state HttpOnly cookie', () => {
  it('sets oauth_state cookie equal to the state returned in the body', async () => {
    mockGetLoginUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?x=1');
    const handler = createOAuthAuthorizeHandler(options());
    const req = new Request('http://localhost/api/auth/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google' }),
    }) as any;

    const res = await handler(req);
    const body = await res.json();
    const setCookie = res.headers.get('set-cookie') ?? '';

    expect(body.state).toBeTruthy();
    expect(setCookie).toContain(`oauth_state=${body.state}`);
    expect(setCookie.toLowerCase()).toContain('httponly');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/security/auth/oauth-state-csrf.test.ts -t "sets oauth_state"`
Expected: FAIL — `set-cookie` header absent / does not contain `oauth_state` (authorize 미수정).

- [ ] **Step 3: Modify authorize handler**

In `src/next/auth-handlers/oauth-authorize.handler.ts`:

Replace the import block top:

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '@withwiz/core/auth/oauth';
import type { AuthHandlerOptions } from '../auth-types/handler-types';
```

with:

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '@withwiz/core/auth/oauth';
import {
  generateOAuthState,
  setOAuthStateCookie,
} from '@withwiz/core/auth/oauth/state-cookie';
import type { AuthHandlerOptions } from '../auth-types/handler-types';
```

Replace:

```ts
      const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };
      const manager = new OAuthManager({ providers }, options.dependencies.logger ?? noopLogger);
      const state = crypto.randomUUID();
      const loginUrl = manager.getLoginUrl(provider, state);

      return NextResponse.json({ success: true, loginUrl, state });
```

with:

```ts
      const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };
      const manager = new OAuthManager({ providers }, options.dependencies.logger ?? noopLogger);
      const state = generateOAuthState();
      const loginUrl = manager.getLoginUrl(provider, state);

      const response = NextResponse.json({ success: true, loginUrl, state });
      setOAuthStateCookie(response, state, {
        secure: options.cookie?.secure,
        sameSite: options.cookie?.sameSite,
        domain: options.cookie?.domain,
      });
      return response;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/security/auth/oauth-state-csrf.test.ts -t "sets oauth_state"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/next/auth-handlers/oauth-authorize.handler.ts __tests__/security/auth/oauth-state-csrf.test.ts
git commit -m "$(printf 'fix(auth): O-1 authorize 핸들러가 oauth_state HttpOnly 쿠키 설정\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 5: callback 핸들러 state 검증 + 기존 테스트 마이그레이션 (TDD)

**Files:**
- Modify: `src/next/auth-handlers/oauth-callback.handler.ts`
- Test: `__tests__/security/auth/oauth-state-csrf.test.ts` (CSRF 계약 추가)
- Modify: `__tests__/unit/auth/handlers/handlers.test.ts` (기존 callback 8개 마이그레이션)

- [ ] **Step 1: Write the failing CSRF tests**

Append to `__tests__/security/auth/oauth-state-csrf.test.ts`:

```ts
describe('O-1 callback: state validation (always strict)', () => {
  it('rejects with 400 and does NOT exchange code when state cookie is absent', async () => {
    const handler = createOAuthCallbackHandler(options());
    const req = callbackReq(
      'http://localhost/api/auth/oauth/callback?code=abc&provider=google&state=S1',
      {}, // no oauth_state cookie
    );
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid OAuth state');
    expect(mockExchangeCodeForToken).not.toHaveBeenCalled();
  });

  it('rejects with 400 when cookie and query state mismatch', async () => {
    const handler = createOAuthCallbackHandler(options());
    const req = callbackReq(
      'http://localhost/api/auth/oauth/callback?code=abc&provider=google&state=S1',
      { oauth_state: 'S2' },
    );
    const res = await handler(req);
    expect(res.status).toBe(400);
    expect(mockExchangeCodeForToken).not.toHaveBeenCalled();
  });

  it('proceeds when cookie matches query state', async () => {
    mockExchangeCodeForToken.mockResolvedValue('tok');
    mockGetUserInfo.mockResolvedValue({
      id: 'gid', email: 'u@example.com', name: 'U', image: null,
    });
    mockHandleCallback.mockResolvedValue({
      user: { id: 'u1', email: 'u@example.com', name: 'U', role: 'USER' },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
      isNewUser: false,
    });
    const handler = createOAuthCallbackHandler(options());
    const req = callbackReq(
      'http://localhost/api/auth/oauth/callback?code=abc&provider=google&state=S1',
      { oauth_state: 'S1' },
    );
    const res = await handler(req);
    expect(res.status).toBe(307);
    expect(mockExchangeCodeForToken).toHaveBeenCalledWith('google', 'abc');
  });
});
```

- [ ] **Step 2: Run to verify the new CSRF tests fail**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/security/auth/oauth-state-csrf.test.ts -t "state validation"`
Expected: FAIL — callback 미검증이라 "absent/mismatch" 케이스가 400 대신 코드교환을 진행(307/500), `mockExchangeCodeForToken` 호출됨.

- [ ] **Step 3: Modify callback handler**

In `src/next/auth-handlers/oauth-callback.handler.ts`:

Replace import block:

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '@withwiz/core/auth/oauth';
import { OAuthCallbackService } from '@withwiz/core/auth/services/oauth-callback.service';
import { setTokenCookies } from '@withwiz/core/auth/jwt/cookie';
import { AuthError } from '@withwiz/core/auth/errors';
import type { AuthHandlerOptions } from '../auth-types/handler-types';
```

with:

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OAuthManager } from '@withwiz/core/auth/oauth';
import {
  OAUTH_STATE_COOKIE,
  validateOAuthState,
  clearOAuthStateCookie,
} from '@withwiz/core/auth/oauth/state-cookie';
import { OAuthCallbackService } from '@withwiz/core/auth/services/oauth-callback.service';
import { setTokenCookies } from '@withwiz/core/auth/jwt/cookie';
import { AuthError } from '@withwiz/core/auth/errors';
import type { AuthHandlerOptions } from '../auth-types/handler-types';
```

Replace the whole `return async (request: NextRequest)` body. Current:

```ts
  return async (request: NextRequest): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const provider = url.searchParams.get('provider') ?? url.pathname.split('/').pop();

      if (!code || !provider || !oauth?.[provider]) {
        return NextResponse.json({ success: false, error: 'Invalid callback' }, { status: 400 });
      }

      const providers: Record<string, { clientId: string; clientSecret: string; redirectUri: string }> = {};
      for (const [name, config] of Object.entries(oauth)) {
        providers[name] = config;
      }

      const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };
      const manager = new OAuthManager({ providers }, dependencies.logger ?? noopLogger);
      const accessToken = await manager.exchangeCodeForToken(provider, code);
      const userInfo = await manager.getUserInfo(provider, accessToken);

      if (hooks?.allowEmail) {
        const allowed = await hooks.allowEmail(userInfo.email);
        if (!allowed) return NextResponse.json({ success: false, error: 'Email not allowed' }, { status: 403 });
      }

      const result = await callbackService.handleCallback({
        provider,
        providerAccountId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.image,
        accessToken,
      });

      if (hooks?.onAfterOAuth) await hooks.onAfterOAuth(result.user, provider, result.isNewUser);

      if (result.isNewUser && hooks?.onOAuthFirstLogin) {
        const redirect = await hooks.onOAuthFirstLogin(result.user, provider);
        if (redirect) {
          const response = NextResponse.redirect(redirect);
          setTokenCookies(response, result.tokens, { secure: cookie?.secure });
          return response;
        }
      }

      const redirectUrl = urls.afterOAuth ?? urls.afterLogin ?? '/';
      const response = NextResponse.redirect(new URL(redirectUrl, urls.baseUrl));
      setTokenCookies(response, result.tokens, { secure: cookie?.secure });
      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
      }
      return NextResponse.json({ success: false, error: 'OAuth callback failed' }, { status: 500 });
    }
  };
```

Replace with (adds state validation before code exchange and clears the state cookie on every exit):

```ts
  return async (request: NextRequest): Promise<Response> => {
    const stateCookieOpts = {
      secure: cookie?.secure,
      sameSite: cookie?.sameSite,
      domain: cookie?.domain,
    };
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const provider = url.searchParams.get('provider') ?? url.pathname.split('/').pop();

      if (!code || !provider || !oauth?.[provider]) {
        return NextResponse.json({ success: false, error: 'Invalid callback' }, { status: 400 });
      }

      // O-1: 코드 교환 이전에 state(query) 와 쿠키를 strict 검증.
      const stateParam = url.searchParams.get('state');
      const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
      if (!validateOAuthState(stateCookie, stateParam)) {
        const res = NextResponse.json(
          { success: false, error: 'Invalid OAuth state' },
          { status: 400 },
        );
        return clearOAuthStateCookie(res, stateCookieOpts);
      }

      const providers: Record<string, { clientId: string; clientSecret: string; redirectUri: string }> = {};
      for (const [name, config] of Object.entries(oauth)) {
        providers[name] = config;
      }

      const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };
      const manager = new OAuthManager({ providers }, dependencies.logger ?? noopLogger);
      const accessToken = await manager.exchangeCodeForToken(provider, code);
      const userInfo = await manager.getUserInfo(provider, accessToken);

      if (hooks?.allowEmail) {
        const allowed = await hooks.allowEmail(userInfo.email);
        if (!allowed) {
          const res = NextResponse.json({ success: false, error: 'Email not allowed' }, { status: 403 });
          return clearOAuthStateCookie(res, stateCookieOpts);
        }
      }

      const result = await callbackService.handleCallback({
        provider,
        providerAccountId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.image,
        accessToken,
      });

      if (hooks?.onAfterOAuth) await hooks.onAfterOAuth(result.user, provider, result.isNewUser);

      if (result.isNewUser && hooks?.onOAuthFirstLogin) {
        const redirect = await hooks.onOAuthFirstLogin(result.user, provider);
        if (redirect) {
          const response = NextResponse.redirect(redirect);
          setTokenCookies(response, result.tokens, { secure: cookie?.secure });
          return clearOAuthStateCookie(response, stateCookieOpts);
        }
      }

      const redirectUrl = urls.afterOAuth ?? urls.afterLogin ?? '/';
      const response = NextResponse.redirect(new URL(redirectUrl, urls.baseUrl));
      setTokenCookies(response, result.tokens, { secure: cookie?.secure });
      return clearOAuthStateCookie(response, stateCookieOpts);
    } catch (error) {
      if (error instanceof AuthError) {
        const res = NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        return clearOAuthStateCookie(res, stateCookieOpts);
      }
      const res = NextResponse.json({ success: false, error: 'OAuth callback failed' }, { status: 500 });
      return clearOAuthStateCookie(res, stateCookieOpts);
    }
  };
```

- [ ] **Step 4: Run the CSRF tests — expect PASS**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/security/auth/oauth-state-csrf.test.ts`
Expected: PASS (authorize + 3 callback CSRF tests).

- [ ] **Step 5: Run the existing handler suite — expect the 8 legacy callback tests to now FAIL**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/unit/auth/handlers/handlers.test.ts`
Expected: FAIL — `describe('createOAuthCallbackHandler')` 의 8개 테스트가 state 부재로 400(또는 cookies API 부재로 500)이 되어 기대(307/403/409/500/hook)와 불일치. 이는 구 계약(취약)이 새 보안 계약으로 바뀐 정상 결과. 다음 스텝에서 마이그레이션.

- [ ] **Step 6: Migrate the 8 legacy callback tests to the new contract**

In `__tests__/unit/auth/handlers/handlers.test.ts`, inside `describe('createOAuthCallbackHandler', ...)`, apply this mechanical transform to **each** of the 8 test cases listed below: replace its request construction

```ts
const req = new Request('<URL>', { method: 'GET' }) as any;
```

with

```ts
const req = makeRequestWithCookies('<URL>&state=test-state', { oauth_state: 'test-state' }, { method: 'GET' });
```

(`makeRequestWithCookies` already exists in this file at the Helpers section and simulates `req.cookies.get`.) The 8 test cases and their exact current `<URL>` literals:

1. `'should return redirect response on successful OAuth callback'` — URL `http://localhost/api/auth/oauth/callback?code=abc123&provider=google` → use `...?code=abc123&provider=google&state=test-state`, cookies `{ oauth_state: 'test-state' }`.
2. `'should return 403 when allowEmail hook blocks the email'` — same URL → add `&state=test-state` + cookie.
3. `'should return AuthError status when callbackService throws AuthError'` — same URL → add `&state=test-state` + cookie.
4. `'should return 500 on generic error'` — same URL → add `&state=test-state` + cookie.
5. `'should call onAfterOAuth hook after successful callback'` — same URL → add `&state=test-state` + cookie.
6. `'should redirect to onOAuthFirstLogin URL for new users'` — same URL → add `&state=test-state` + cookie.
7. `'should use afterOAuth URL when configured'` — same URL → add `&state=test-state` + cookie.
8. `'should extract provider from URL path when not in query params'` — URL `http://localhost/api/auth/oauth/callback/google?code=abc123` → use `http://localhost/api/auth/oauth/callback/google?code=abc123&state=test-state`, cookies `{ oauth_state: 'test-state' }`.

Do NOT modify `'should return 400 when code is missing'` or `'should return 400 when provider is missing or not configured'` — they return before the state check and must stay as-is.

- [ ] **Step 7: Run the handler suite — expect PASS**

Run: `npx vitest run -c __tests__/vitest.config.ts __tests__/unit/auth/handlers/handlers.test.ts`
Expected: PASS (all, including the 8 migrated callback tests and the 2 unchanged 400 tests).

- [ ] **Step 8: Full suite + build**

Run: `npm test`
Expected: all test files pass (prior 92 files + 2 new = 94, all green).

Run: `npm run build`
Expected: `Build success`.

- [ ] **Step 9: Commit**

```bash
git add src/next/auth-handlers/oauth-callback.handler.ts __tests__/security/auth/oauth-state-csrf.test.ts __tests__/unit/auth/handlers/handlers.test.ts
git commit -m "$(printf 'fix(auth): O-1 callback state 검증(always-strict) + 레거시 테스트 마이그레이션\n\n코드 교환 이전 query state 와 oauth_state 쿠키 strict 비교, 불일치/\n부재 시 400 + 쿠키 clear. 모든 종료 경로에서 state 쿠키 1회용 소거.\n기존 callback 테스트 8개를 새 보안 계약(유효 state 제공)으로 갱신.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 6: 회귀/커버리지 최종 점검

**Files:** (없음 — 검증만)

- [ ] **Step 1: Spec coverage 확인**

설계 문서 §4(컴포넌트)·§5(흐름)·§6(에러표)·§8(테스트)·§9(호환성) 각 항목이 Task 1–5에 대응되는지 점검:
- §4.1 state-cookie.ts → Task 1,2
- §4.2 authorize → Task 4
- §4.3 callback → Task 5
- §6 에러표(부재/부재/불일치/일치/AuthError·500 + clear) → Task 5 핸들러 코드 + CSRF 테스트
- §8 테스트(검증 단위/쿠키 속성/authorize/callback) → Task 1,2,4,5
- §10 export → Task 3

- [ ] **Step 2: 전체 스위트 + 빌드 최종 실행**

Run: `npm test && npm run build`
Expected: 전체 통과 + `Build success`.

- [ ] **Step 3: (커밋 없음)** Task 5에서 이미 커밋됨. 변경 없으면 종료.

---

## Self-Review (작성자 점검 결과)

- **Spec coverage:** 설계 §4/§5/§6/§8/§9/§10 모두 Task 1–5에 매핑됨(Task 6 Step 1에 명시). 누락 없음.
- **Placeholder scan:** TBD/TODO/"적절히 처리" 없음. 모든 코드 스텝에 실제 코드·정확한 명령·기대 출력 포함.
- **Type consistency:** `OAUTH_STATE_COOKIE`, `generateOAuthState`, `setOAuthStateCookie`, `clearOAuthStateCookie`, `validateOAuthState`, `OAuthStateCookieOptions` 시그니처가 Task 1 정의와 Task 3/4/5 사용처에서 일치. callback 의 `stateCookieOpts` 키(secure/sameSite/domain)는 `OAuthStateCookieOptions` 와 동형.
- **알려진 제약:** handlers.test.ts 의 `vi.mock('.../core/auth/oauth')` 가 인덱스를 가리므로 핸들러는 서브모듈 경로 `@withwiz/core/auth/oauth/state-cookie` 에서 import(Task 4/5 import 블록에 반영). 신규 보안 테스트는 동일 mock 전략을 자체 적용.
