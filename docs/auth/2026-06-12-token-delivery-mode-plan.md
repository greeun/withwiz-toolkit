# tokenDelivery 모드(cookie/header/hybrid) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증 토큰 전달 방식(cookie/header/hybrid)을 초기화 또는 핸들러 옵션에서 선택 가능하게 한다.

**Architecture:** `TokenDelivery` 타입을 core auth config 에 추가하고, 우선순위(핸들러 옵션 > 전역 config > `'hybrid'`)를 해석하는 `resolveTokenDelivery` 헬퍼를 next/auth-types 에 둔다. 미들웨어와 login/refresh/me 핸들러가 요청 시점에 모드를 해석해 토큰 추출 소스·쿠키 설정·body 토큰 포함 여부를 분기한다. 기본값 `'hybrid'` 는 현행 동작과 동일하여 non-breaking.

**Tech Stack:** TypeScript 5 (strict), Vitest, Next.js 15 (NextRequest/NextResponse), jose 기반 JWTService.

**설계 문서:** `docs/auth/2026-06-12-token-delivery-mode-design.md`

**공통 규칙**

- 모드 해석은 항상 **요청 시점**에 수행한다. 핸들러 팩토리는 소비 앱의 모듈 스코프에서
  `initialize()` 보다 먼저 실행될 수 있으므로 팩토리 시점 해석은 금지.
- 기존 테스트는 수정하지 않는다. 전부 통과해야 하위호환 증명.
- 각 Task 완료 시 커밋. `npm publish` 는 절대 실행하지 않는다.

---

### Task 1: core — `TokenDelivery` 타입과 AuthConfig 확장

**Files:**
- Modify: `src/core/auth/config.ts`
- Test: `__tests__/unit/auth/auth-config-token-delivery.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/unit/auth/auth-config-token-delivery.test.ts`:

```typescript
import { initializeAuth, getAuthConfig, resetAuth } from '../../../src/core/auth/config';

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('AuthConfig tokenDelivery', () => {
  beforeEach(() => resetAuth());
  afterEach(() => resetAuth());

  it('미지정 시 hybrid 로 기본 해석된다', () => {
    initializeAuth({ jwtSecret: SECRET });
    expect(getAuthConfig().tokenDelivery).toBe('hybrid');
  });

  it('명시한 모드를 그대로 유지한다', () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'cookie' });
    expect(getAuthConfig().tokenDelivery).toBe('cookie');
  });

  it('header 모드도 허용한다', () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'header' });
    expect(getAuthConfig().tokenDelivery).toBe('header');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/auth/auth-config-token-delivery.test.ts`
Expected: FAIL — `tokenDelivery` 속성이 `AuthConfig`/`ResolvedAuthConfig` 에 없어 타입 에러 또는 `undefined !== 'hybrid'`.

- [ ] **Step 3: 구현**

`src/core/auth/config.ts` — 타입 추가 및 기본값 해석:

```typescript
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
```

`initializeAuth` 의 `globalThis.__withwiz_config.auth = {...}` 객체에 한 줄 추가:

```typescript
    tokenDelivery: config.tokenDelivery ?? 'hybrid',
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/auth/auth-config-token-delivery.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/core/auth/config.ts __tests__/unit/auth/auth-config-token-delivery.test.ts
git commit -m "feat(auth): AuthConfig 에 tokenDelivery 모드 추가 — 기본 hybrid"
```

---

### Task 2: next — `AuthHandlerOptions.tokenDelivery` + `resolveTokenDelivery` 헬퍼

**Files:**
- Modify: `src/next/auth-types/handler-types.ts`
- Test: `__tests__/unit/auth/token-delivery-resolve.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/unit/auth/token-delivery-resolve.test.ts`:

```typescript
import { resolveTokenDelivery } from '../../../src/next/auth-types/handler-types';
import { initializeAuth, resetAuth } from '../../../src/core/auth/config';

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('resolveTokenDelivery 우선순위', () => {
  beforeEach(() => resetAuth());
  afterEach(() => resetAuth());

  it('아무것도 없으면 hybrid', () => {
    expect(resolveTokenDelivery()).toBe('hybrid');
  });

  it('전역 config 를 읽는다', () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'cookie' });
    expect(resolveTokenDelivery()).toBe('cookie');
  });

  it('핸들러 옵션이 전역 config 보다 우선한다', () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'cookie' });
    expect(resolveTokenDelivery('header')).toBe('header');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/auth/token-delivery-resolve.test.ts`
Expected: FAIL — `resolveTokenDelivery` export 없음.

- [ ] **Step 3: 구현**

`src/next/auth-types/handler-types.ts` 상단 import 에 추가:

```typescript
import { getAuthConfig } from '@withwiz/core/auth/config';
import type { TokenDelivery } from '@withwiz/core/auth/config';
```

`AuthHandlerOptions` 에 필드 추가 (`cookie?` 필드 아래):

```typescript
  /** 토큰 전달 모드. 미지정 시 전역 AuthConfig → 'hybrid' 순으로 해석 */
  tokenDelivery?: TokenDelivery;
```

파일 끝에 헬퍼 추가:

```typescript
/**
 * tokenDelivery 모드 해석.
 * 우선순위: 핸들러 옵션 > 전역 AuthConfig > 'hybrid'
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/auth/token-delivery-resolve.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/next/auth-types/handler-types.ts __tests__/unit/auth/token-delivery-resolve.test.ts
git commit -m "feat(auth): AuthHandlerOptions.tokenDelivery + resolveTokenDelivery 헬퍼"
```

---

### Task 3: 미들웨어 토큰 추출 분기

**Files:**
- Modify: `src/next/middleware/auth.ts` (authMiddleware, optionalAuthMiddleware 의 추출 블록)
- Test: `__tests__/unit/middleware/auth-token-delivery-mode.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/unit/middleware/auth-token-delivery-mode.test.ts`
(기존 `auth-cookie-extraction.test.ts` 의 mock 패턴을 따른다):

```typescript
/**
 * authMiddleware / optionalAuthMiddleware 의 tokenDelivery 모드별 토큰 추출 검증.
 * cookie: 쿠키만 (헤더 무시) / header: 헤더만 (쿠키 무시) / hybrid: 쿠키 → 헤더 폴백
 */
import { JWTService } from "@withwiz/core/auth/jwt";
import type { JWTConfig } from "@withwiz/core/auth/types";
import type { IApiContext } from "@withwiz/next/middleware/types";
import { NextResponse } from "next/server";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "@withwiz/next/middleware/auth";
import { initializeAuth, resetAuth } from "../../../src/core/auth/config";
import type { TokenDelivery } from "../../../src/core/auth/config";

const testConfig: JWTConfig = {
  secret: "test-secret-key-that-is-at-least-32-characters-long",
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "7d",
  algorithm: "HS256",
};

let validToken: string;

beforeAll(async () => {
  const jwtService = new JWTService(testConfig);
  validToken = await jwtService.createAccessToken({
    id: "user-mode-test",
    userId: "user-mode-test",
    email: "mode@example.com",
    role: "USER",
    emailVerified: new Date(),
  });
});

function initMode(mode: TokenDelivery) {
  resetAuth();
  initializeAuth({
    jwtSecret: testConfig.secret,
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    tokenDelivery: mode,
  });
}

afterEach(() => resetAuth());

function createMockContext(options: {
  authHeader?: string;
  cookieToken?: string;
}): IApiContext {
  const headers = new Headers();
  if (options.authHeader) headers.set("authorization", options.authHeader);
  const request = {
    headers,
    cookies: {
      get: (name: string) =>
        name === "access_token" && options.cookieToken
          ? { name, value: options.cookieToken }
          : undefined,
    },
    method: "GET",
    url: "http://localhost:3000/api/test",
  };
  return { request } as unknown as IApiContext;
}

const next = () => Promise.resolve(NextResponse.json({ ok: true }));

describe("authMiddleware tokenDelivery 모드", () => {
  it("cookie 모드: 쿠키 토큰으로 인증된다", async () => {
    initMode("cookie");
    const ctx = createMockContext({ cookieToken: validToken });
    await authMiddleware(ctx, next);
    expect(ctx.user?.id).toBe("user-mode-test");
  });

  it("cookie 모드: Authorization 헤더는 무시된다", async () => {
    initMode("cookie");
    const ctx = createMockContext({ authHeader: `Bearer ${validToken}` });
    await expect(authMiddleware(ctx, next)).rejects.toThrow();
  });

  it("header 모드: 헤더 토큰으로 인증된다", async () => {
    initMode("header");
    const ctx = createMockContext({ authHeader: `Bearer ${validToken}` });
    await authMiddleware(ctx, next);
    expect(ctx.user?.id).toBe("user-mode-test");
  });

  it("header 모드: 쿠키는 무시된다", async () => {
    initMode("header");
    const ctx = createMockContext({ cookieToken: validToken });
    await expect(authMiddleware(ctx, next)).rejects.toThrow();
  });

  it("hybrid 모드: 쿠키 우선, 헤더 폴백 둘 다 동작한다", async () => {
    initMode("hybrid");
    const viaCookie = createMockContext({ cookieToken: validToken });
    await authMiddleware(viaCookie, next);
    expect(viaCookie.user?.id).toBe("user-mode-test");

    const viaHeader = createMockContext({ authHeader: `Bearer ${validToken}` });
    await authMiddleware(viaHeader, next);
    expect(viaHeader.user?.id).toBe("user-mode-test");
  });
});

describe("optionalAuthMiddleware tokenDelivery 모드", () => {
  it("cookie 모드: 헤더만 있으면 user 미설정으로 통과한다", async () => {
    initMode("cookie");
    const ctx = createMockContext({ authHeader: `Bearer ${validToken}` });
    await optionalAuthMiddleware(ctx, next);
    expect(ctx.user).toBeUndefined();
  });

  it("header 모드: 쿠키만 있으면 user 미설정으로 통과한다", async () => {
    initMode("header");
    const ctx = createMockContext({ cookieToken: validToken });
    await optionalAuthMiddleware(ctx, next);
    expect(ctx.user).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/middleware/auth-token-delivery-mode.test.ts`
Expected: FAIL — "cookie 모드: Authorization 헤더는 무시된다", "header 모드: 쿠키는 무시된다" 등 4건 실패 (현행은 항상 hybrid 추출).

- [ ] **Step 3: 구현**

`src/next/middleware/auth.ts`:

(a) import 추가:

```typescript
import { resolveTokenDelivery } from "../auth-types/handler-types";
import type { IApiContext } from "./types";
```

(b) `authMiddleware` 정의 직전에 공용 추출 함수 추가:

```typescript
/**
 * tokenDelivery 모드에 따라 요청에서 access token 추출.
 * cookie: 쿠키만 / header: Authorization 헤더만 / hybrid: 쿠키 → 헤더 폴백
 */
function extractRequestToken(
  context: IApiContext,
  jwtManager: JWTManager,
): string | null {
  const mode = resolveTokenDelivery();
  let token: string | null = null;
  if (mode !== "header") {
    token = context.request.cookies.get("access_token")?.value ?? null;
  }
  if (!token && mode !== "cookie") {
    const authHeader = context.request.headers.get("authorization");
    token = jwtManager.extractTokenFromHeader(authHeader);
  }
  return token;
}
```

(c) `authMiddleware` 의 기존 추출 블록:

```typescript
    // 쿠키에서 토큰 추출 (Authorization 헤더 폴백 — OAPI 호환)
    let token: string | null = context.request.cookies.get("access_token")?.value ?? null;
    if (!token) {
      const authHeader = context.request.headers.get("authorization");
      token = jwtManager.extractTokenFromHeader(authHeader);
    }
```

를 다음으로 교체:

```typescript
    // tokenDelivery 모드에 따라 토큰 추출 (기본 hybrid: 쿠키 → 헤더 폴백)
    const token = extractRequestToken(context, jwtManager);
```

(d) `optionalAuthMiddleware` 의 동일 패턴 블록(`let token: string | null = ...` ~ 폴백 if 블록)도 같은 한 줄로 교체:

```typescript
      const token = extractRequestToken(context, jwtManager);
```

(`if (token) { ... }` 이하 로직은 그대로 유지)

- [ ] **Step 4: 신규 + 기존 미들웨어 테스트 통과 확인**

Run: `npm test -- __tests__/unit/middleware/`
Expected: PASS — 신규 파일 포함 전체. 특히 `auth-cookie-extraction.test.ts` (hybrid 기본 동작) 무수정 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/next/middleware/auth.ts __tests__/unit/middleware/auth-token-delivery-mode.test.ts
git commit -m "feat(middleware): tokenDelivery 모드별 토큰 추출 분기"
```

---

### Task 4: login 핸들러 분기 + 핸들러 테스트 스캐폴드

**Files:**
- Modify: `src/next/auth-handlers/login.handler.ts`
- Test: `__tests__/unit/auth/handlers/token-delivery.test.ts` (신규 — Task 5, 6 에서 확장)

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/unit/auth/handlers/token-delivery.test.ts`
(기존 `handlers.test.ts` 의 mock 패턴을 따른다):

```typescript
/**
 * auth 핸들러의 tokenDelivery 모드 분기 검증 (login / refresh / me)
 */
import type { AuthHandlerOptions } from '../../../../src/next/auth-types/handler-types';
import { initializeAuth, resetAuth } from '../../../../src/core/auth/config';

const mockCompare = vi.fn();
vi.mock('bcryptjs', () => ({
  compare: (...args: any[]) => mockCompare(...args),
}));

const mockCreateTokenPair = vi.fn();
const mockVerifyAccessToken = vi.fn();
const mockExtractTokenFromHeader = vi.fn();
vi.mock('../../../../src/core/auth/jwt', () => ({
  JWTService: vi.fn().mockImplementation(function (this: any) {
    this.createTokenPair = mockCreateTokenPair;
    this.verifyAccessToken = mockVerifyAccessToken;
    this.extractTokenFromHeader = mockExtractTokenFromHeader;
  }),
}));

const mockSetTokenCookies = vi.fn();
const mockClearTokenCookies = vi.fn();
vi.mock('../../../../src/core/auth/jwt/cookie', () => ({
  setTokenCookies: (...args: any[]) => mockSetTokenCookies(...args),
  clearTokenCookies: (...args: any[]) => mockClearTokenCookies(...args),
}));

const mockRefresh = vi.fn();
vi.mock('../../../../src/core/auth/services/token-refresh.service', () => ({
  TokenRefreshService: vi.fn().mockImplementation(function (this: any) {
    this.refresh = mockRefresh;
  }),
}));

import { createLoginHandler } from '../../../../src/next/auth-handlers/login.handler';
import { createRefreshHandler } from '../../../../src/next/auth-handlers/refresh.handler';
import { createMeHandler } from '../../../../src/next/auth-handlers/me.handler';

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

const testUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'User One',
  role: 'USER',
  emailVerified: new Date(),
  isActive: true,
  password: 'hashed',
};

const tokenPair = { accessToken: 'at-123', refreshToken: 'rt-456' };

function createMockOptions(overrides: Partial<AuthHandlerOptions> = {}): AuthHandlerOptions {
  return {
    dependencies: {
      userRepository: {
        findById: vi.fn().mockResolvedValue(testUser),
        findByEmail: vi.fn().mockResolvedValue(testUser),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateLastLoginAt: vi.fn(),
        verifyEmail: vi.fn(),
      } as any,
      oauthAccountRepository: {} as any,
      emailTokenRepository: {} as any,
    },
    jwt: { secret: SECRET },
    urls: { baseUrl: 'http://localhost:3000' },
    ...overrides,
  };
}

function createMockRequest(init: {
  body?: unknown;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): any {
  return {
    json: async () => {
      if (init.body === undefined) throw new Error('no body');
      return init.body;
    },
    cookies: {
      get: (name: string) =>
        init.cookies?.[name] !== undefined
          ? { name, value: init.cookies[name] }
          : undefined,
    },
    headers: new Headers(init.headers ?? {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAuth();
  mockCompare.mockResolvedValue(true);
  mockCreateTokenPair.mockResolvedValue(tokenPair);
  mockRefresh.mockResolvedValue({ accessToken: 'new-at', user: { id: 'u1' } });
  mockVerifyAccessToken.mockResolvedValue({ userId: 'u1', email: 'u1@example.com' });
  mockExtractTokenFromHeader.mockImplementation((h?: string) =>
    h?.startsWith('Bearer ') ? h.slice(7) : null,
  );
});

afterEach(() => resetAuth());

const loginRequest = () =>
  createMockRequest({ body: { email: 'u1@example.com', password: 'pw123456' } });

describe('login 핸들러 tokenDelivery', () => {
  it('cookie 모드: body 에 tokens 없음 + 쿠키 설정', async () => {
    const handler = createLoginHandler(createMockOptions({ tokenDelivery: 'cookie' }));
    const res = await handler(loginRequest());
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tokens).toBeUndefined();
    expect(mockSetTokenCookies).toHaveBeenCalledTimes(1);
  });

  it('header 모드: body 에 tokens 포함 + 쿠키 미설정', async () => {
    const handler = createLoginHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(loginRequest());
    const body = await res.json();
    expect(body.tokens).toEqual(tokenPair);
    expect(mockSetTokenCookies).not.toHaveBeenCalled();
  });

  it('기본(hybrid): body tokens + 쿠키 둘 다', async () => {
    const handler = createLoginHandler(createMockOptions());
    const res = await handler(loginRequest());
    const body = await res.json();
    expect(body.tokens).toEqual(tokenPair);
    expect(mockSetTokenCookies).toHaveBeenCalledTimes(1);
  });

  it('전역 config 의 cookie 모드를 따른다 (옵션 미지정 시)', async () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'cookie' });
    const handler = createLoginHandler(createMockOptions());
    const res = await handler(loginRequest());
    const body = await res.json();
    expect(body.tokens).toBeUndefined();
    expect(mockSetTokenCookies).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/auth/handlers/token-delivery.test.ts`
Expected: FAIL — cookie 모드 `body.tokens` 존재, header 모드 `setTokenCookies` 호출됨 (3건 실패, hybrid 1건만 통과).

- [ ] **Step 3: 구현**

`src/next/auth-handlers/login.handler.ts`:

(a) import 변경:

```typescript
import type { AuthHandlerOptions } from '../auth-types/handler-types';
import { resolveTokenDelivery } from '../auth-types/handler-types';
```

(b) 구조분해에 `tokenDelivery` 추가:

```typescript
  const { dependencies, jwt, hooks, features, cookie, tokenDelivery } = options;
```

(c) 기존 응답 생성부:

```typescript
      const response = NextResponse.json({ success: true, user: userResponse, tokens });
      setTokenCookies(response, tokens, { secure: cookie?.secure });
      return response;
```

를 다음으로 교체:

```typescript
      const mode = resolveTokenDelivery(tokenDelivery);
      const responseBody: Record<string, unknown> = { success: true, user: userResponse };
      if (mode !== 'cookie') {
        responseBody.tokens = tokens;
      }
      const response = NextResponse.json(responseBody);
      if (mode !== 'header') {
        setTokenCookies(response, tokens, { secure: cookie?.secure });
      }
      return response;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/auth/handlers/`
Expected: PASS — 신규 login 4건 + 기존 `handlers.test.ts` 무수정 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/next/auth-handlers/login.handler.ts __tests__/unit/auth/handlers/token-delivery.test.ts
git commit -m "feat(auth): login 핸들러 tokenDelivery 분기 — cookie 모드 body 토큰 제거"
```

---

### Task 5: refresh 핸들러 분기 (body 입력 신규 지원)

**Files:**
- Modify: `src/next/auth-handlers/refresh.handler.ts`
- Test: `__tests__/unit/auth/handlers/token-delivery.test.ts` (describe 블록 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`token-delivery.test.ts` 파일 끝에 추가:

```typescript
describe('refresh 핸들러 tokenDelivery', () => {
  it('cookie 모드: 쿠키 입력 + body 에 accessToken 없음 + 쿠키 재설정', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'cookie' }));
    const res = await handler(createMockRequest({ cookies: { refresh_token: 'rt-456' } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.accessToken).toBeUndefined();
    expect(mockSetTokenCookies).toHaveBeenCalledTimes(1);
  });

  it('header 모드: body {refreshToken} 입력 + body accessToken 반환 + 쿠키 미설정', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(createMockRequest({ body: { refreshToken: 'rt-456' } }));
    const body = await res.json();
    expect(body.accessToken).toBe('new-at');
    expect(mockSetTokenCookies).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledWith('rt-456');
  });

  it('header 모드: 쿠키는 무시한다', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(createMockRequest({ cookies: { refresh_token: 'rt-456' } }));
    expect(res.status).toBe(401);
  });

  it('hybrid 모드: 쿠키 없으면 body 로 폴백한다 (신규 동작)', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'hybrid' }));
    const res = await handler(createMockRequest({ body: { refreshToken: 'rt-456' } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.accessToken).toBe('new-at');
  });

  it('hybrid 모드: 쿠키가 body 보다 우선한다', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'hybrid' }));
    await handler(
      createMockRequest({
        cookies: { refresh_token: 'rt-cookie' },
        body: { refreshToken: 'rt-body' },
      }),
    );
    expect(mockRefresh).toHaveBeenCalledWith('rt-cookie');
  });

  it('토큰이 어디에도 없으면 401', async () => {
    const handler = createRefreshHandler(createMockOptions({ tokenDelivery: 'hybrid' }));
    const res = await handler(createMockRequest({}));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/auth/handlers/token-delivery.test.ts`
Expected: FAIL — refresh 블록에서 cookie 모드 `body.accessToken` 존재, header/hybrid body 입력 401 등.

- [ ] **Step 3: 구현**

`src/next/auth-handlers/refresh.handler.ts`:

(a) import 변경:

```typescript
import type { AuthHandlerOptions } from '../auth-types/handler-types';
import { resolveTokenDelivery } from '../auth-types/handler-types';
```

(b) 구조분해에 `tokenDelivery` 추가:

```typescript
  const { dependencies, jwt, hooks, cookie, tokenDelivery } = options;
```

(c) 요청 처리부 — 기존:

```typescript
      const refreshToken = request.cookies.get('refresh_token')?.value;
      if (!refreshToken) {
        return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 });
      }
```

를 다음으로 교체:

```typescript
      const mode = resolveTokenDelivery(tokenDelivery);

      let refreshToken: string | undefined;
      if (mode !== 'header') {
        refreshToken = request.cookies.get('refresh_token')?.value;
      }
      if (!refreshToken && mode !== 'cookie') {
        try {
          const body = await request.json();
          if (typeof body?.refreshToken === 'string') {
            refreshToken = body.refreshToken;
          }
        } catch {
          // body 없음 또는 JSON 아님 — 아래에서 401 처리
        }
      }
      if (!refreshToken) {
        return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 });
      }
```

(d) 응답 생성부 — 기존:

```typescript
      const response = NextResponse.json({
        success: true,
        accessToken: result.accessToken,
        user: result.user,
      });
      setTokenCookies(response, { accessToken: result.accessToken, refreshToken }, { secure: cookie?.secure });
      return response;
```

를 다음으로 교체:

```typescript
      const responseBody: Record<string, unknown> = { success: true, user: result.user };
      if (mode !== 'cookie') {
        responseBody.accessToken = result.accessToken;
      }
      const response = NextResponse.json(responseBody);
      if (mode !== 'header') {
        setTokenCookies(
          response,
          { accessToken: result.accessToken, refreshToken },
          { secure: cookie?.secure },
        );
      }
      return response;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/auth/handlers/`
Expected: PASS — refresh 6건 포함 전체. 기존 `handlers.test.ts` 의 refresh 테스트(쿠키 입력, hybrid 기본) 무수정 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/next/auth-handlers/refresh.handler.ts __tests__/unit/auth/handlers/token-delivery.test.ts
git commit -m "feat(auth): refresh 핸들러 tokenDelivery 분기 + body refreshToken 입력 지원"
```

---

### Task 6: me 핸들러 추출 분기

**Files:**
- Modify: `src/next/auth-handlers/me.handler.ts`
- Test: `__tests__/unit/auth/handlers/token-delivery.test.ts` (describe 블록 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`token-delivery.test.ts` 파일 끝에 추가:

```typescript
describe('me 핸들러 tokenDelivery', () => {
  it('cookie 모드: 쿠키 토큰으로 조회된다', async () => {
    const handler = createMeHandler(createMockOptions({ tokenDelivery: 'cookie' }));
    const res = await handler(createMockRequest({ cookies: { access_token: 'at-123' } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.id).toBe('u1');
  });

  it('cookie 모드: Authorization 헤더는 무시된다', async () => {
    const handler = createMeHandler(createMockOptions({ tokenDelivery: 'cookie' }));
    const res = await handler(
      createMockRequest({ headers: { authorization: 'Bearer at-123' } }),
    );
    expect(res.status).toBe(401);
  });

  it('header 모드: 헤더 토큰으로 조회된다', async () => {
    const handler = createMeHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(
      createMockRequest({ headers: { authorization: 'Bearer at-123' } }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('header 모드: 쿠키는 무시된다', async () => {
    const handler = createMeHandler(createMockOptions({ tokenDelivery: 'header' }));
    const res = await handler(createMockRequest({ cookies: { access_token: 'at-123' } }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/auth/handlers/token-delivery.test.ts`
Expected: FAIL — "cookie 모드: Authorization 헤더는 무시된다", "header 모드: 쿠키는 무시된다" 2건.

- [ ] **Step 3: 구현**

`src/next/auth-handlers/me.handler.ts`:

(a) import 변경:

```typescript
import type { AuthHandlerOptions } from '../auth-types/handler-types';
import { resolveTokenDelivery } from '../auth-types/handler-types';
```

(b) 기존 추출부:

```typescript
      const token = request.cookies.get('access_token')?.value
        ?? jwtService.extractTokenFromHeader(request.headers.get('authorization') ?? undefined);
```

를 다음으로 교체:

```typescript
      const mode = resolveTokenDelivery(options.tokenDelivery);
      let token: string | null | undefined;
      if (mode !== 'header') {
        token = request.cookies.get('access_token')?.value;
      }
      if (!token && mode !== 'cookie') {
        token = jwtService.extractTokenFromHeader(
          request.headers.get('authorization') ?? undefined,
        );
      }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/auth/handlers/`
Expected: PASS — me 4건 포함 전체.

- [ ] **Step 5: 커밋**

```bash
git add src/next/auth-handlers/me.handler.ts __tests__/unit/auth/handlers/token-delivery.test.ts
git commit -m "feat(auth): me 핸들러 tokenDelivery 추출 분기"
```

---

### Task 7: 문서 + 버전 0.8.0

**Files:**
- Modify: `README.md` (auth 핸들러/미들웨어 사용법 섹션 끝에 추가)
- Modify: `CHANGELOG.md` (최상단에 0.8.0 항목)
- Modify: `package.json` (`"version": "0.7.1"` → `"0.8.0"`)

- [ ] **Step 1: README 에 tokenDelivery 섹션 추가**

README.md 의 auth 사용법을 다루는 섹션(미들웨어/핸들러 예시가 있는 곳) 끝에 추가:

````markdown
### 토큰 전달 모드 (tokenDelivery)

인증 토큰 전달 방식을 초기화 시 선택할 수 있습니다. 기본값은 `'hybrid'`(쿠키 + 헤더 동시 지원, 기존 동작)입니다.

```typescript
import { initialize } from '@withwiz/toolkit/initialize';

initialize({
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    tokenDelivery: 'cookie', // 'cookie' | 'header' | 'hybrid' (기본)
  },
});
```

핸들러별로 덮어쓸 수도 있습니다 (옵션 > 전역 > `'hybrid'` 순):

```typescript
createAuthHandlers({ ...options, tokenDelivery: 'header' });
```

| 모드 | 토큰 위치 | 특징 |
|---|---|---|
| `cookie` | HttpOnly 쿠키 전용 | 응답 body 에서 토큰 제거 — XSS 노출 면 최소. 브라우저 앱 권장 |
| `header` | `Authorization: Bearer` + body | refresh 는 body `{ refreshToken }` 으로 전달. 클라이언트 저장소는 XSS 에 상대적으로 취약 — 비브라우저 클라이언트용 |
| `hybrid` | 둘 다 | 기존 동작. 쿠키 우선, 헤더/body 폴백 |

**제약**: OAuth callback 은 redirect 응답이라 모드와 무관하게 쿠키로만 토큰을 전달합니다. OAuth 를 쓰는 앱은 `'cookie'` 또는 `'hybrid'` 를 사용하세요.
````

- [ ] **Step 2: CHANGELOG 0.8.0 항목 추가**

CHANGELOG.md 최상단(기존 0.7.1 항목 위)에 추가:

```markdown
## [0.8.0] - 2026-06-12

### Added

- **tokenDelivery 모드** — 인증 토큰 전달 방식을 `'cookie' | 'header' | 'hybrid'` 중 선택 가능 (`AuthConfig.tokenDelivery`, `AuthHandlerOptions.tokenDelivery`). 우선순위: 핸들러 옵션 > 전역 config > `'hybrid'`(기존 동작, non-breaking).
  - `cookie`: 응답 body 에서 토큰 제거, HttpOnly 쿠키 전용. 미들웨어 헤더 폴백 비활성.
  - `header`: 쿠키 미설정, body/Authorization 헤더 전용. refresh 가 body `{ refreshToken }` 입력 지원 (신규).
  - `hybrid`: 기존 동작 + refresh 의 body 폴백 추가 (쿠키 우선, additive).
- 설계 문서: `docs/auth/2026-06-12-token-delivery-mode-design.md`

### Notes

- 기본값이 `'hybrid'` 이므로 기존 소비 프로젝트는 무수정 동작.
- OAuth callback 은 redirect 특성상 모드와 무관하게 쿠키 전달 — header 모드 앱은 hybrid 권장.
```

- [ ] **Step 3: package.json 버전 범프**

`"version": "0.7.1"` → `"version": "0.8.0"`

- [ ] **Step 4: 커밋**

```bash
git add README.md CHANGELOG.md package.json
git commit -m "chore(release): 0.8.0 — tokenDelivery 모드 문서·버전"
```

(`npm publish` 는 실행하지 않는다 — 사용자 결정 사항)

---

### Task 8: 전체 검증

- [ ] **Step 1: 풀 테스트**

Run: `npm test`
Expected: 전체 PASS, 기존 테스트 무수정 통과 (하위호환 증명).

- [ ] **Step 2: 타입 빌드**

Run: `npm run build:types`
Expected: 에러 0.

- [ ] **Step 3: JS 빌드**

Run: `npm run build:js`
Expected: 에러 0.

- [ ] **Step 4: 실패 시**

실패 항목은 superpowers:systematic-debugging 으로 원인 규명 후 수정. 수정 후 본 Task 재실행.
