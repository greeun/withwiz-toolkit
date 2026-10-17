# 인증 계약 표준화 설계 (오류 응답 · signup · 비밀번호 정책 · 토큰 email 보완)

**날짜**: 2026-10-17
**상태**: 확정 (구현 대기)
**대상 버전**: toolkit 0.21 (minor — 추가만, 기본 동작 유지) → 0.22 (기본값 전환) / auth-ui 0.7
**관련 패키지**: `@withwiz/auth-ui` (같은 계약의 소비자 — 별도 설계서에서 상세화)

## 배경

인증 계약(경로·요청 본문·오류 응답)이 toolkit 안에서도, toolkit 과 auth-ui 사이에서도 일치하지 않는다.
그 결과 소비자가 차이를 각자 메우는 코드를 두게 되고, 메우는 방식도 소비자마다 달라진다.
이 문서는 **계약을 toolkit 이 정본으로 소유하고, auth-ui 와 소비자는 그 계약을 따르기만 하는 구조**를
설계한다. 오류 응답은 toolkit 이 표준을 정의하고, 소비자는 toolkit 이 제공하는 어댑터로 변환한다.

### 문제 1 — toolkit 안에 오류 응답 형태가 세 가지다

| 생성 위치 | 형태 |
|---|---|
| `next/auth-handlers/*` | `{ success:false, error:"문자열", code?:"EMAIL_NOT_VERIFIED", details?: zod.flatten() }` |
| `next/middleware/error-handler.ts` (`with*Api` 래퍼) | `{ success:false, error:{ code:40305, message, userMessage:{title,description,action}, requestId, metadata? } }` |
| `next/error/error-handler.ts` (`errorToResponse`) | `{ success:false, error:{ code, message, details? } }` — `userMessage` 없음 |

공식 타입은 이미 선언되어 있다: `core/types/api.ts` 의 `IApiResponse.error`(`code`·`message`·`userMessage`·
`requestId`·`details`). 래퍼만 이 타입을 따르고, 인증 핸들러와 `errorToResponse` 는 따르지 않는다.

형태가 섞이면 다음 결함이 생긴다.

- 객체형 `error` 를 문자열로 보고 화면에 그대로 넘기면 `[object Object]` 가 표시된다.
- `error` 필드에서 오류 코드를 비교하는데 서버는 코드를 다른 필드에 담으면 분기가 항상 빗나간다.
- auth-ui 폼은 문자열 `error` 만 표시한다. 서버가 구체적인 사유를 `details` 에만 담으면 화면에는 "Invalid input" 만 남는다.

### 문제 2 — auth-ui 의 `/signup` 에 대응하는 핸들러가 없다

auth-ui `SignupForm` 은 `${apiBasePath}/signup` 으로 요청한다. toolkit 에는 `register`(201, 쿠키 없음)만 있다.
그래서 소비자는 다음 중 하나를 직접 구현해야 한다.

- `register` 를 호출한 뒤 201 이면 `login` 을 다시 호출해 자동 로그인하고, 실패하면 가입 응답으로 폴백한다.
- `RegisterService` 를 직접 쓰고 토큰 발급까지 자체 구현한다.
- `register` 를 `/signup` 에도 그대로 연결한다(자동 로그인 없음).

어느 것도 하지 않으면 화면 가입이 404 로 떨어진다.

### 문제 3 — 비밀번호 정책을 주입할 곳이 없다

register·reset-password 스키마는 `z.string().min(8)` + 72바이트 제한으로 고정되어 있다. 더 강한 정책이
필요한 소비자는 핸들러 앞에 별도 검사를 두거나 핸들러를 쓰지 않고 자체 구현한다. 같은 서비스 안에서도
가입과 재설정이 서로 다른 정책을 쓰게 되기 쉽다.

### 문제 4 — reset·verify 가 `email` 을 필수로 요구한다

메일 링크에 `?email=` 을 넣지 않는 소비자는 토큰 해시로 email 을 찾아 요청 본문에 채우는 우회 코드를 둔다.
`EmailTokenRepository` 에는 토큰만으로 행을 찾는 메서드가 없다.

## 목표

1. 오류 응답 형태를 `IApiResponse.error` 하나로 정한다. 인증 핸들러와 `errorToResponse` 도 이 형태를 낸다.
2. 소비자가 기존 응답을 표준으로 바꿀 수 있도록 **toolkit 이 어댑터를 제공**한다(서버용·클라이언트용).
3. `signup` 핸들러(가입 + 자동 로그인)를 추가한다.
4. 비밀번호 정책 주입점을 추가하고 register·signup·reset 에 같은 정책을 적용한다.
5. reset·verify 에서 email 을 선택 항목으로 바꾸고, 없으면 토큰으로 찾는다.

## 비목표

- 소비자의 비즈니스 정책(IP 한도·계정 잠금·동의 기록·계정 연결)을 toolkit 으로 옮기지 않는다. 주입점만 보장한다.
- toolkit 인증 모듈과 auth-ui 를 하나의 패키지로 합치지 않는다.
- auth-ui 가 toolkit 에 의존하게 만들지 않는다. 두 패키지가 공유하는 것은 코드가 아니라 이 문서의 계약이다.
- 매직링크 핸들러는 이번 범위가 아니다. `features.magicLinkEnabled` 는 타입만 있고 읽는 코드가 없다는 점만 문서화한다.

## 설계

### 1. 표준 오류 응답

```ts
// core/types/api.ts — 기존 IApiResponse.error 에 key 만 추가(추가 필드라 호환됨)
interface IApiError {
  code: number;            // 5자리 확장 코드 (40305)
  key: string;             // ERROR_CODES 의 key ("EMAIL_NOT_VERIFIED") — 기계 분기용. 신규
  message: string;         // 개발자용 영어 메시지. 화면 표시용이 아니다
  userMessage?: { title?: string; description: string; action?: string }; // 요청 로케일 문구
  requestId?: string;
  details?: {
    fieldErrors?: Record<string, string[]>; // 필드별 사용자 문구(요청 로케일). 폼이 필드 아래에 표시
    [k: string]: unknown;
  };
}
```

규칙은 다음과 같다.

- **분기는 `key` 로 한다.** 숫자 `code` 는 HTTP 상태 추출과 로그용이다. 문자열 `key` 는 `ERROR_CODES` 에 이미 있어 새로 정의할 필요가 없다.
- **화면에 표시할 문구는 `userMessage.description` 이다.** 소비자가 구체적인 사유(비밀번호 정책 등)를 줄 때는 이 값을 덮어쓴다. `message` 는 표시하지 않는다.
- **필드 오류는 `details.fieldErrors` 에 담는다.** zod `flatten().fieldErrors` 와 같은 모양이다.
- 소비자 전용 오류는 가장 가까운 `ERROR_CODES` 항목의 `code` 를 쓰고 `key` 에 고유 문자열을 지정할 수 있다. `key` 는 열린 문자열이다.

### 2. toolkit 이 제공하는 어댑터

소비자가 변환 코드를 직접 작성하지 않도록 세 가지를 공개한다.

| API | 계층 | 역할 |
|---|---|---|
| `buildErrorResponse(key, opts?)` | `next/error` | 표준 응답을 만든다. `opts`: `userMessage`·`fieldErrors`·`status`·`headers`·`request`(로케일 감지용). 지금 비공개인 미들웨어의 `createErrorResponse` 와 `errorToResponse` 가 이 함수를 공유하게 한다 |
| `withStandardErrors(handler)` | `next/error` | 응답 본문이 **문자열형 `error`** 이면 표준 형태로 다시 써서 돌려준다. 성공 응답과 이미 표준인 응답은 그대로 통과시킨다. 인증 디스패치 라우트나 자체 라우트를 감싸는 용도다 |
| `readApiError(body)` | `core/error` (프레임워크 무관) | 클라이언트용 판독기. 표준·문자열형 모두 받아 `{ key, code, text, fieldErrors, requestId }` 로 정규화한다. `text` 는 `userMessage.description` → 문자열 `error` → `message` 순 |

`withStandardErrors` 의 문자열형 → 표준 변환 규칙:

- `error`(문자열) → `message` 와 `userMessage.description` 모두에 넣는다(이전 동작 보존 — 문자열형을 쓰던 쪽은 이미 사용자 문구를 담아 왔다).
- `code`(문자열) → `key`. `ERROR_CODES[key]` 가 있으면 숫자 `code` 를 채우고, 없으면 HTTP 상태로 대표 코드를 고른다(400→`BAD_REQUEST`, 401→`UNAUTHORIZED`…).
- `details.fieldErrors` 는 그대로 옮긴다.

### 3. 인증 핸들러의 응답 형태 전환

```ts
interface AuthHandlerOptions {
  // ...
  /** 오류 응답 형태. 0.21 기본 'legacy', 0.22 기본 'standard', 1.0 에서 'legacy' 제거 */
  errorFormat?: 'legacy' | 'standard';
}
```

- 핸들러 안의 `NextResponse.json({ success:false, error:'...' })` 를 모두 내부 헬퍼 하나(`authError(key, status, opts)`)로 모은다. 헬퍼가 `errorFormat` 에 따라 형태를 고른다.
- `'standard'` 에서 핸들러가 내는 `key` 는 `ERROR_CODES` 의 기존 항목을 쓴다: `VALIDATION_ERROR`·`INVALID_CREDENTIALS`·`EMAIL_NOT_VERIFIED`·`ACCOUNT_DISABLED`·`EMAIL_ALREADY_EXISTS`·`INVALID_TOKEN`·`TOKEN_EXPIRED`·`PASSWORD_TOO_WEAK` 등. zod 실패는 `details.fieldErrors` 를 채운다(지금 register 만 `details` 를 주고 나머지는 버린다).
- `errorToResponse` 는 `userMessage`·`key` 를 추가로 싣는다. 추가 필드라 기존 소비자는 영향이 없다.

### 4. `signup` 핸들러

```ts
handlers.signup(req)   // POST /signup
```

1. register 와 같은 검증(비밀번호 정책 포함) → 가입.
2. 가입 직후 로그인이 가능한 상태면(`emailVerificationRequired` 가 false 이거나 이미 인증됨) login 과 같은 경로로 토큰을 발급하고 쿠키를 싣는다. 응답은 `{ success:true, user, verificationSent:false }` + Set-Cookie.
3. 인증이 필요하면 쿠키 없이 `{ success:true, user, verificationSent:true }`(201)를 돌려준다. "register 후 login, 실패하면 가입 응답으로 폴백" 패턴과 같은 결과다.
4. 옵션 `signup?: { autoLogin?: boolean }`(기본 true). 자동 로그인을 원하지 않는 소비자는 끈다.

훅 확장(추가 인자라 기존 훅과 호환):

- `onBeforeRegister(data, ctx)` — `ctx = { body, request }`. 동의 검사·추가 필드 검증을 서버에서 할 수 있게 원본 본문을 넘긴다. 지금은 `{email, name}` 만 받아 동의 여부를 볼 수 없다.
- `onAfterRegister(user, ctx)` — 같은 `ctx`. 동의 기록·기본 역할 부여 같은 가입 후처리 자리다.

### 5. 비밀번호 정책 주입

```ts
interface AuthHandlerOptions {
  passwordPolicy?:
    | Partial<PasswordConfig>                       // 기존 PasswordValidator 규칙으로 검사
    | ((password: string, ctx: { purpose: 'register' | 'reset'; locale: TLocale })
        => { ok: true } | { ok: false; message: string });  // 소비자 규칙(사유 문구는 소비자가 로케일로 만든다)
}
```

- register·signup·reset-password 가 같은 정책을 쓴다. 72바이트 제한은 정책과 별개로 항상 적용한다.
- 위반 시 400 `PASSWORD_TOO_WEAK`, `details.fieldErrors.password = [message]`, `userMessage.description = message`.
- 미지정이면 지금과 같은 `min(8)` 이다(기본 동작 유지).

### 6. 토큰으로 email 보완

```ts
interface EmailTokenRepository {
  // ...기존 메서드
  /** 해시된 토큰으로 발급 대상 email 을 찾는다. 선택 메서드 — 미구현 저장소는 지금처럼 email 필수 */
  findEmailByToken?(hashedToken: string, type: TokenType): Promise<string | null>;
}
```

- reset-password·verify-email 의 `email` 을 선택 항목으로 바꾼다. 없으면 `findEmailByToken(TokenGenerator.hash(token), type)` 으로 찾는다.
- 찾지 못하면 400 `INVALID_TOKEN` 이다. 만료 검사는 지금처럼 서비스가 한다.
- 기본 제공 어댑터(prisma auth-adapter, raw SQL adapter)는 이 메서드를 구현한다. 토큰 종류 경계는 `type` 조건으로 지킨다.
- 선택 메서드라서 소비자의 자체 저장소 구현은 깨지지 않는다.

## auth-ui 쪽 변경 (요약 — 별도 설계서)

- 오류 판독을 `readApiError` 와 같은 규칙으로 바꾼다(표준·문자열형 모두 수용). toolkit 이 기본값을 바꾸는 0.22 보다 먼저 발행해야 한다. toolkit 을 import 하지 않고 같은 규칙을 자체 구현한다.
- `details.fieldErrors` 를 필드 아래에 표시한다.
- `LoginForm` 의 미인증 판정을 `key === 'EMAIL_NOT_VERIFIED'` 로 하고, `hooks.onError` 에 `{ text, key, fieldErrors }` 를 넘긴다. 지금은 문구만 넘겨 소비자가 문구 비교로 판정해야 한다.
- 하드코딩 경로 `'/auth/magic-link'` 를 `magicLinkUrl` prop 으로 바꾼다.
- `OAuthProvider` 타입을 toolkit 제공자 5종(google·github·kakao·meta·microsoft)과 맞춘다.

## 배포 순서와 호환성

| 단계 | 내용 | 깨지는 것 |
|---|---|---|
| 1 | **auth-ui 0.7** — 두 형태 모두 판독, fieldErrors, `onError` 확장, `magicLinkUrl`, 제공자 5종 | 없음 |
| 2 | **toolkit 0.21** — 표준 타입 `key`, 어댑터 3종, `errorFormat`(기본 legacy), `signup`, `passwordPolicy`, `findEmailByToken`, 훅 `ctx` | 없음 |
| 3 | **toolkit 0.22** — `errorFormat` 기본값을 `'standard'` 로 전환 | 문자열 `error` 를 직접 읽는 소비자 코드(0.x minor 의 breaking — CHANGELOG 에 이전 방법 명시) |
| 4 | **toolkit 1.0** — `'legacy'` 제거 | — |

0.x 의 caret 범위(`^0.20.0` = `<0.21.0`)는 minor 를 고정하므로, 소비자는 각자 버전을 올리기 전까지 영향을
받지 않는다. 버전을 `latest` 로 지정한 소비자는 0.22 의 기본값 전환을 곧바로 받으므로 CHANGELOG 에 경고한다.

## 테스트 계획

- **단위**: 어댑터 3종의 변환 표(문자열형·표준·성공 응답·알 수 없는 `code`), `authError` 헬퍼의 두 형태, 정책 함수형·설정형, `findEmailByToken` 유무에 따른 분기.
- **핸들러**: 각 핸들러의 오류 경로를 `errorFormat` 두 값으로 검증. signup 의 세 갈래(자동 로그인·인증 필요·autoLogin false).
- **계약 테스트(신규)**: auth-ui 레포에 실제 toolkit 핸들러와 폼을 연결하는 테스트를 둔다. 양쪽 단위 테스트가 각자 통과해도 둘 사이의 계약 불일치는 잡히지 않는다.

## 구현 메모 (2026-10-18, 0.21.0)

설계와 달라졌거나 구현하면서 정한 사항이다.

- **standard 의 key**: `ERROR_CODES` 에 맞는 항목이 있으면 그 key, 서비스의 `AuthError` 는 그 `code`(예: `TOKEN_INVALID`), 맞는 항목이 없으면 원인을 구분하는 고유 key(예: `EMAIL_NOT_ALLOWED`, `OAUTH_STATE_INVALID`)를 쓴다. 결과적으로 legacy 의 문자열 `code` 값은 모두 standard 의 `key` 와 같다 — 0.22 전환 뒤에도 분기 문자열이 바뀌지 않는다.
- **HTTP 상태**: standard 도 legacy 와 같은 상태로 응답한다(숫자 code 의 앞 세 자리와 다를 수 있다).
- **미들웨어·errorToResponse**: 공용 빌더로 다시 쓰지 않고 `key`(와 각각 `details.fieldErrors`, `userMessage`)만 추가했다. 기존 필드(`metadata` 등)를 바꾸지 않기 위해서다. `errorToResponse` 는 로케일을 위해 선택 인자 `request` 를 받는다.
- **signup 의 세션 발급 실패**: 가입은 이미 끝났으므로 실패로 응답하지 않고 세션 없는 가입 성공(201)으로 폴백하며 오류를 로그에 남긴다. 실패로 알리면 재시도가 "이미 가입된 이메일" 로 끝난다.
- **세션 발급 공유**: login 의 세션 발급부를 `session.ts` 로 분리해 signup 과 함께 쓴다.
- **메일 링크 토큰 오류**: 핸들러가 토큰을 찾지 못한 경우와 서비스가 `TOKEN_INVALID` 를 던진 경우 모두 key `TOKEN_INVALID`, 숫자 코드는 새 사전 항목 `LINK_INVALID`(40008)다. `TOKEN_INVALID` 의 일반 매핑(40102)은 로그인 세션 문구라 메일 링크에 맞지 않는다(결정 2 "빠진 키만 추가"에 따른 추가).
- **key 도출 통일**: `AuthError` 는 인증 핸들러·`errorToResponse`·미들웨어·`withStandardErrors` 모두에서 자기 `code` 를 key 로 쓴다.
- **서버 진입점**: `next/auth-handlers` 는 `next/error` 묶음(index)을 거치지 않는다. 묶음에 클라이언트 컴포넌트(ErrorBoundary)가 있어 서버 라우트 번들이 깨지기 때문이다. `__tests__/build/server-entry-graph.test.ts` 가 dist 의 import 그래프로 이를 검사한다.
- **훅 ctx**: `ctx.body` 에서 `password` 를 뺀다(훅이 로그를 남겨도 평문 비밀번호가 새지 않게).
- **정책이 있을 때 최소 길이**: 스키마의 `min(8)` 은 정책이 없을 때만 적용하고, 정책이 있으면 최소 길이도 정책이 정한다.
- **legacy 의 정책 위반 응답**: `error` 문자열에 사유를, `code` 에 `PASSWORD_TOO_WEAK` 를, `details.fieldErrors.password` 에 사유를 싣는다 — 문자열 `error` 만 읽는 클라이언트도 사유를 표시할 수 있다.

## 결정 사항

1. **`ACCOUNT_LOCKED` 의 HTTP 상태**: 403(40309)을 유지한다. 숫자 코드로 분기하는 소비자를 깨지 않고, `code/100 = status` 체계도 지킨다. 재시도 시점을 알려야 하는 소비자는 `buildErrorResponse` 의 `headers` 로 `retry-after` 를 지정한다. 요청 빈도 제한 성격의 거부는 기존 `RATE_LIMIT_EXCEEDED`(429)를 쓴다.
2. **`userMessage` 의 기본 문구**: 인증 핸들러도 미들웨어와 같은 `getErrorMessage(code, locale)` 사전을 쓴다. 사전을 둘로 나누면 같은 코드의 문구가 갈라진다. 인증 핸들러가 내는 키 중 사전에 빠진 항목만 구현 단계에서 추가한다.
3. **`errorToResponse`·`withErrorHandler`**: 이번에는 폐기하지 않고, 출력 형태만 표준(`key`·`userMessage` 포함)에 맞춘다. 출력이 같아지면 폐기로 얻는 이득이 작다.
