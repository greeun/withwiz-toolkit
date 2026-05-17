# O-1: OAuth 로그인 CSRF 차단 — state 쿠키 바인딩 설계

- 작성일: 2026-05-17
- 출처: harness Evaluator 보안 감사 `critique_security.md` O-1 (Critical)
- 상태: 승인됨 (구현 대기)

## 1. 문제

`createOAuthAuthorizeHandler`는 `state = crypto.randomUUID()`를 생성해 IdP
로그인 URL과 JSON 응답에 담아 클라이언트로 반환하지만, 서버 측에 어떤
형태로도 바인딩하지 않는다. `createOAuthCallbackHandler`는 콜백에서
`code`/`provider`만 읽고 `state`를 **읽지도 검증하지도 않는다**. 세션/쿠키
바인딩이 전혀 없으므로 공격자가 자신의 IdP 계정으로 발급된 `code`를
피해자에게 전달(로그인 CSRF)하면 피해자 브라우저가 공격자 계정으로
로그인된다. 소비자 측 설정 오류 없이 토큰의 핸들러 경로만으로 악용 가능.

근거: `src/next/auth-handlers/oauth-authorize.handler.ts:25`,
`src/next/auth-handlers/oauth-callback.handler.ts:20-52`.

## 2. 목표 / 비목표

목표
- OAuth `state`를 피해자 브라우저에 HttpOnly 쿠키로 바인딩하고, 콜백에서
  쿼리 `state`와 쿠키 값을 검증해 불일치/부재 시 인증 코드 교환 전에
  거부한다.
- 토큰 제공 핸들러를 쓰는 소비자에게 투명하게 적용된다.

비목표
- PKCE(`code_verifier`/`code_challenge`) 도입 — 별도 후속 hardening.
  (Critical 근본원인은 state 미검증이며, PKCE는 provider별 `getLoginUrl`
  /`exchangeCodeForToken` 전면 변경으로 surface가 크다.)
- 서버 측 세션 스토어 도입 — 무상태 핸들러 설계 유지.

## 3. 접근

선택: **A. 불투명 랜덤 nonce를 HttpOnly 쿠키에 저장하고 콜백 쿼리
`state`와 strict 비교** (OAuth 2.0 Security BCP). 무상태, 최소 surface,
"피해자 브라우저 바인딩"이라는 목표를 정확히 충족.

기각:
- B. HMAC 서명 state(쿠키 없음) — 브라우저 세션에 바인딩되지 않아 로그인
  CSRF를 실제로 막지 못함.
- C. 서버 세션 스토어 — stateful 인프라 의존 추가, 과함.

## 4. 컴포넌트

### 4.1 신규: `src/core/auth/oauth/state-cookie.ts` (core 티어)

`src/core/auth/jwt/cookie.ts`의 제네릭 `CookieSettableResponse` 패턴을
미러링한다(= `next` import 없음 → core 티어 규칙 준수).

- `OAUTH_STATE_COOKIE = 'oauth_state'` (상수)
- `generateOAuthState(): string` — `crypto.randomUUID()` 반환. 생성을
  중앙화하여 테스트 가능하게 한다.
- `setOAuthStateCookie<T extends CookieSettableResponse>(response, state, options?): T`
  - 쿠키 속성: `httpOnly: true`, `secure: options.secure ?? false`,
    `sameSite: options.sameSite ?? 'lax'`, `path: '/'`, `maxAge: 600` (10분)
  - `options`: `{ secure?, sameSite?, domain? }` (기존 `CookieOptions`와
    동형; `domain` 전달 시 설정)
- `clearOAuthStateCookie<T extends CookieSettableResponse>(response, options?): T`
  - 동일 name/path로 `maxAge: 0`, 빈 값 (1회용 — 모든 콜백 종료 경로에서 호출)
- `validateOAuthState(cookieValue: string | null | undefined, queryState: string | null | undefined): boolean`
  - 양쪽 모두 비공백 문자열이고 strict 일치(`===`)일 때만 `true`.
    하나라도 부재/빈문자열이면 `false`.

### 4.2 수정: `oauth-authorize.handler.ts`

- 인라인 `crypto.randomUUID()`를 `generateOAuthState()` 호출로 대체.
- `NextResponse.json({ success, loginUrl, state })` 생성 후 반환 전
  `setOAuthStateCookie(response, state, { secure: options.cookie?.secure,
  sameSite: options.cookie?.sameSite, domain: options.cookie?.domain })`.
- 응답 JSON에 `state`는 **계속 포함**(가산적, 하위호환).

### 4.3 수정: `oauth-callback.handler.ts`

- `const stateParam = url.searchParams.get('state')`
- `const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value`
- **코드 교환 이전**에 `if (!validateOAuthState(stateCookie, stateParam))`
  → `clearOAuthStateCookie` 적용한 `400 { success:false,
  error:'Invalid OAuth state' }` 반환 (인증 코드 교환·userInfo 호출 없음).
- 성공 리다이렉트 응답, first-login 리다이렉트 응답, 실패(catch) 응답 등
  **모든 종료 경로에서 `clearOAuthStateCookie(response, ...)` 호출**
  (state는 1회용).

## 5. 데이터 흐름

```
[authorize]
  generateOAuthState() = S
  loginUrl = manager.getLoginUrl(provider, S)   # 기존: state를 IdP로 전달
  res = JSON{ success, loginUrl, state:S }
  setOAuthStateCookie(res, S)                    # 신규: HttpOnly 쿠키
  → 클라이언트는 IdP로 이동, 브라우저는 oauth_state=S 보유

[IdP] → redirect → /callback?code=...&provider=...&state=S

[callback]
  stateParam  = query.state
  stateCookie = req.cookies.oauth_state
  if !validateOAuthState(stateCookie, stateParam):
      return clearOAuthStateCookie(400 Invalid OAuth state)   # 코드교환 차단
  ... 기존 흐름 (exchangeCodeForToken → getUserInfo → handleCallback) ...
  clearOAuthStateCookie(finalResponse)                         # 1회용 소거
```

## 6. 에러 처리

| 조건 | 동작 |
|---|---|
| state 쿠키 부재 | 400, 쿠키 clear, 코드교환 안 함 |
| 쿼리 state 부재 | 400, 쿠키 clear, 코드교환 안 함 |
| 쿠키≠쿼리 (불일치) | 400, 쿠키 clear, 코드교환 안 함 |
| 일치 | 기존 흐름 진행, 종료 시 쿠키 clear |
| 기존 AuthError/500 경로 | 동작 유지 + 쿠키 clear |

## 7. 설계 근거

- **SameSite=Lax**: 콜백은 IdP가 트리거하는 top-level GET 내비게이션 →
  Lax에서 쿠키 전송됨. Strict면 누락되어 정상 로그인도 깨짐.
- **Path='/'**: 콜백 경로가 소비자마다 달라도 쿠키 전송 보장. 값은 단일
  랜덤 nonce(비밀 아님, 10분 TTL, 1회용)라 경로 광역화 위험 낮음.
- **maxAge=600**: 로그인 왕복은 보통 분 단위. 짧은 TTL로 stale nonce·
  고정 공격 표면 축소.
- **strict `===`**: state는 동등성 nonce(비밀 아님)이므로 timing-safe
  비교 불필요. 단순·명확.
- **core 티어 배치**: `jwt/cookie.ts`와 동일하게 제네릭 인터페이스로
  `next` 비의존 → 티어 규칙(criterion 5) 유지, 단위 테스트 용이.

## 8. 테스트 (TDD)

RED → GREEN → REFACTOR. 단위 우선, 핸들러 레벨로 계약 고정.

1. `validateOAuthState`
   - 동일 비공백 값 → `true`
   - 쿠키 부재 / 쿼리 부재 / 빈 문자열 / 불일치 → 각각 `false`
2. `setOAuthStateCookie` — `httpOnly:true`, `sameSite:'lax'`, `path:'/'`,
   `maxAge:600`, `secure` 옵션 반영. `clearOAuthStateCookie` — `maxAge:0`.
3. authorize 핸들러 — 응답에 `oauth_state` 쿠키(httpOnly) 설정되고 JSON에
   `state` 유지.
4. callback 핸들러
   - 쿠키 부재 → 400, `exchangeCodeForToken` 미호출
   - 쿠키≠쿼리 → 400, 미호출
   - 쿠키=쿼리 → 기존 흐름 진행(성공), 응답에 state 쿠키 clear
   - (회귀 가드) 기존 콜백 성공 케이스 무회귀

## 9. 호환성 영향

- authorize 응답: `Set-Cookie: oauth_state` 가산 — 기존 클라이언트
  무영향(비파괴).
- callback: state 없으면 실패 — **의도된 보안 강화**(동작 변경).
  토큰 핸들러를 함께 쓰는 소비자는 자동으로 정합. 커스텀 authorize를
  쓰며 이 쿠키를 안 심는 소비자는 실패(현재도 취약 — "핸들러를
  사용한다"는 계약 전제).
- 배포 직후 진행 중이던 구 OAuth 왕복은 1회 실패 후 재로그인으로 복구.

## 10. 영향 파일

- 신규 `src/core/auth/oauth/state-cookie.ts`
- 수정 `src/next/auth-handlers/oauth-authorize.handler.ts`
- 수정 `src/next/auth-handlers/oauth-callback.handler.ts`
- 신규 테스트 `__tests__/security/auth/oauth-state-csrf.test.ts`
  (+ 필요 시 `__tests__/unit/auth/oauth-state-cookie.test.ts`)
- export: `src/core/auth/oauth/index.ts`에 state-cookie 공개 심볼 추가
  (소비자가 커스텀 흐름에서 재사용 가능하도록)
