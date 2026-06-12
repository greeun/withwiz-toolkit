# 인증 토큰 전달 모드(tokenDelivery) 설계

- 날짜: 2026-06-12
- 상태: 설계 승인됨 (구현 전)
- 대상 버전: 0.8.0 (minor, non-breaking)

## 1. 배경

c4000db(2026-04-10)에서 Authorization 헤더 기반 인증에 HttpOnly 쿠키 방식이 추가된 이후,
toolkit 의 인증은 항상 "하이브리드"로 동작한다.

- 미들웨어(`src/next/middleware/auth.ts`): 쿠키 우선 → Authorization 헤더 폴백. 끌 수 없음.
- login 핸들러: 쿠키 설정과 동시에 응답 body 에 `tokens` 포함. 둘 다 항상 발생.
- refresh 핸들러: `refresh_token` 쿠키 전용. body 입력 없음.

이로 인한 문제 두 가지:

1. **선택 불가** — 쿠키 모드로 쓰는 앱도 login 응답 body 에 토큰이 노출된다.
   HttpOnly 쿠키의 XSS 방어 이점이 body 토큰 때문에 약화된다.
2. **header 모드 불완전** — refresh 가 쿠키 전용이라 순수 헤더 클라이언트는
   toolkit refresh 핸들러를 쓸 수 없다.

### 소비 프로젝트 실태 (2026-06-12 워크스페이스 조사)

| 프로젝트 | 실제 모드 | 근거 |
|---|---|---|
| withwiz-academic-affairs | 순수 header | localStorage 에 access+refresh 저장, Bearer 첨부, refresh 를 body `{refreshToken}` 으로 POST — toolkit 핸들러로 불가능해 자체 라우트 운용 |
| tlog.net/profilehub | header | login/magic-link/OAuth callback 응답 body 토큰을 localStorage 저장 |
| job-sync | header | toolkit 미들웨어 + Bearer 클라이언트 |
| showcasehub-mvp(-old) | hybrid | toolkit `createLoginHandler` + Bearer 클라이언트 |
| agent-extensions, blp-ai-poc | cookie | `credentials: 'include'` 만 사용 |
| lms-mvp, withwiz-cms-kit | cookie 추정 | toolkit 미들웨어만, 클라이언트 Bearer 없음 |
| remote-scheduler, url-shortener-mvp 등 | 혼재 | 양쪽 신호 (일부 Bearer 는 외부 API 호출) |

세 모드 모두 실사용 중 → 어느 것도 제거할 수 없고, 선택 메커니즘이 필요하다.

## 2. 목표 / 비목표

**목표**

- `tokenDelivery: 'cookie' | 'header' | 'hybrid'` 모드를 초기화 시 선택 가능하게 한다.
- cookie 모드: 응답 body 에서 토큰 제거 (XSS 노출 면 축소).
- header 모드: body 기반 refresh 를 정식 지원 (academic-affairs 패턴 흡수).
- 기본값 `'hybrid'` 로 기존 소비 앱 전부 무수정 동작.

**비목표**

- 커스텀 전달 전략 주입(전략 객체 패턴) — 3모드 고정 수요에 과설계. 4번째 모드
  수요가 생기면 그때 리팩터링한다.
- refresh token rotation 변경 — 현행 유지(동일 refreshToken 재사용).
- OAuth callback 의 header 모드 토큰 전달 — redirect 응답엔 body 가 없고,
  URL 토큰 전달은 히스토리/로그 노출 위험으로 배제.

## 3. 설계

### 3.1 타입과 설정 표면

```typescript
type TokenDelivery = 'cookie' | 'header' | 'hybrid';

// src/core/auth/config.ts
export interface AuthConfig {
  // ...기존 필드
  tokenDelivery?: TokenDelivery;
}
export interface ResolvedAuthConfig {
  // ...기존 필드
  tokenDelivery: TokenDelivery; // 기본 'hybrid'
}

// src/next/auth-types/handler-types.ts
export interface AuthHandlerOptions {
  // ...기존 필드
  tokenDelivery?: TokenDelivery;
}
```

**우선순위**: 핸들러 옵션 > `getAuthConfig()` 전역 > `'hybrid'`.
기존 `cookie.secure` 해석 패턴과 동일. 미들웨어는 전역 config 만 참조한다
(핸들러 팩토리를 거치지 않으므로).

resolve 헬퍼는 `src/next/auth-types/handler-types.ts` 에 하나만 둔다
(next 티어이므로 core 의 `getAuthConfig` import 가능 — 티어 규칙 준수):

```typescript
function resolveTokenDelivery(optionValue?: TokenDelivery): TokenDelivery {
  if (optionValue) return optionValue;
  try {
    return getAuthConfig().tokenDelivery;
  } catch {
    return 'hybrid'; // auth 미초기화 시
  }
}
```

### 3.2 모드별 동작

| 지점 | cookie | header | hybrid (기본 = 현행) |
|---|---|---|---|
| login 응답 | 쿠키만 설정. body 에서 `tokens` 제거 | body `tokens` 만. 쿠키 미설정 | 쿠키 + body 둘 다 |
| 미들웨어·me 토큰 추출 | 쿠키만 (헤더 폴백 끔) | Authorization 헤더만 | 쿠키 → 헤더 폴백 |
| refresh 입력 | `refresh_token` 쿠키 | body `{refreshToken}` (신규) | 쿠키 → body 폴백 |
| refresh 응답 | 쿠키 재설정. body 에서 `accessToken` 제거 | body `accessToken` 만. 쿠키 미설정 | 쿠키 + body 둘 다 |
| logout | 쿠키 소거 | 쿠키 소거 그대로 수행 (무해, 블랙리스트 훅 별개) | 동일 |
| oauth-callback | 쿠키 + redirect | 쿠키 + redirect (제약: 아래) | 쿠키 + redirect |

**oauth-callback 제약**: redirect 응답에는 body 가 없으므로 header 모드에서도
쿠키를 설정한다(에러 대신). 단 header 모드 미들웨어는 쿠키를 읽지 않으므로
OAuth 가 필요한 앱은 `'hybrid'` 사용을 권장한다. README 에 명시한다.

**hybrid refresh 입력 폴백 (신규 동작)**: 현행은 쿠키 전용이지만, hybrid 에서
쿠키 부재 시 body `{refreshToken}` 을 받도록 확장한다. 기존 쿠키 클라이언트
동작은 변하지 않는다(쿠키 우선).

### 3.3 변경 파일

| 파일 | 변경 |
|---|---|
| `src/core/auth/config.ts` | `tokenDelivery` 필드 추가, resolve 시 기본 `'hybrid'` |
| `src/next/auth-types/handler-types.ts` | `AuthHandlerOptions.tokenDelivery` + resolve 헬퍼 |
| `src/next/middleware/auth.ts` | `authMiddleware`·`optionalAuthMiddleware` 토큰 추출 분기 |
| `src/next/auth-handlers/login.handler.ts` | 모드별 쿠키 설정/body 토큰 포함 분기 |
| `src/next/auth-handlers/refresh.handler.ts` | 모드별 입력 소스·응답 분기, body 입력 신규 |
| `src/next/auth-handlers/me.handler.ts` | 토큰 추출 분기 (미들웨어와 동일 규칙) |
| `src/next/auth-handlers/logout.handler.ts` | 변경 없음 (모든 모드에서 쿠키 소거) |
| `src/next/auth-handlers/oauth-callback.handler.ts` | 변경 없음 (모든 모드에서 쿠키) |
| `src/core/auth/jwt/cookie.ts` | 변경 없음 |

구현 접근은 "모드 필드 + 내부 분기"(A안). 전략 객체(B안)는 과설계,
모드별 팩토리 분리(C안)는 API 표면 3배 증가로 배제했다.

## 4. 호환성·버전

- 기본 `'hybrid'` 는 현행 동작과 동일 → 기존 소비 앱 전부 무수정 동작. non-breaking.
- 버전: **0.8.0** (minor).
- 하위호환 증명: 기존 테스트 무수정 통과.
- hybrid refresh 의 body 폴백은 입력 허용 범위가 넓어지는 변경(additive)이라
  기존 클라이언트에 영향 없음.

## 5. 보안

- **cookie 모드**: body 토큰 제거로 XSS 토큰 탈취 면 축소. HttpOnly 이점이 온전해짐.
  CSRF 방어는 현행 유지 (`sameSite: 'lax'` + OAuth state 쿠키).
- **header 모드**: 클라이언트 저장소(localStorage 등)는 XSS 에 상대적으로 취약.
  소비자 선택 책임이며 README 에 트레이드오프를 명시한다.
- refresh body 입력(header/hybrid)은 Content-Type `application/json` 의 POST 만
  허용 — 기존 핸들러와 동일한 파싱 경로.

## 6. 테스트 전략 (TDD)

- 모드별 unit 테스트 신규 작성: 미들웨어 추출 분기, login body/쿠키 유무,
  refresh 입력 소스·응답 형태, me 추출 분기.
- 우선순위 해석 테스트: 핸들러 옵션 > 전역 config > 기본값.
- 기존 테스트는 수정하지 않고 통과해야 한다 (hybrid 기본값 검증).
- 테스트 위치: `__tests__/unit/middleware/`, `__tests__/unit/auth/` (현행 구조 준수).

## 7. 소비 프로젝트 마이그레이션 (참고, 강제 아님)

| 프로젝트군 | 권장 모드 | 작업 | 주의 |
|---|---|---|---|
| agent-extensions, blp-ai-poc, lms-mvp, cms-kit | `'cookie'` | 설정 1줄 | login 응답 body `tokens` 를 읽는 코드가 없는지 사전 확인 — cookie 모드에서 body 토큰이 사라짐 |
| academic-affairs, profilehub, job-sync | `'header'` | 설정 1줄. academic-affairs 는 자체 refresh 라우트를 toolkit 핸들러로 교체 가능 | — |
| showcasehub 등 혼재 | `'hybrid'` (기본) | 없음 | — |
