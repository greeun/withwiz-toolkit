# MFA(TOTP 인증 앱 + 복구 코드) 설계

**날짜**: 2026-11-08
**상태**: 설계 승인 대기 (검토 반영 2026-11-08)
**대상 버전**: toolkit 0.30.0 (minor — 기능은 기본 꺼짐) / auth-ui 0.10.0
**관련 패키지**: `@withwiz/auth-ui`(로그인 2단계 화면·MFA 설정 화면), 첫 소비자 binder(정책 연동은 별도 설계서)

## 배경과 목적

binder 는 여러 서비스의 로그인을 맡는 IdP 다. 계정 하나가 털리면 연동된 모든 앱이 함께 뚫리므로 2단계 인증이
필요하다. 로그인 흐름(비밀번호 검증 → 토큰·쿠키 발급)은 toolkit `createAuthHandlers` 안에 있고, 지금 있는 훅으로는
비밀번호 검증 뒤에 세션 발급을 멈출 수 없다(`onBeforeLogin` 은 검증 전, `onAfterLogin` 은 반환값이 `void`).
그래서 MFA 의 **수단**(TOTP 검증·복구 코드·로그인 중간 단계·화면)은 toolkit 과 auth-ui 가 맡고, **정책**(누구에게
요구할지, 앱에 어떻게 알릴지)은 소비자(binder)가 맡는다.

## 결정 사항 (사용자 결정)

- **대상: 모든 사용자.** 누구나 계정 설정에서 직접 켜고 끈다. 특정 사용자 강제는 소비자 정책이다.
- **로그인 방식과 무관하게 적용.** MFA 를 켠 사용자는 비밀번호 로그인과 OAuth(Google·GitHub 등) 로그인 모두에서
  코드를 입력해야 세션을 받는다.
- **방식 A — 대기 토큰과 확인 단계 분리.** 1차 인증이 끝나면 세션 대신 짧은 "MFA 대기" 쿠키만 주고, 코드 검증에
  성공해야 세션을 발급한다.

## 목표 · 비목표 · 반목표

**목표**
- RFC 6238 TOTP(인증 앱: Google Authenticator·Microsoft Authenticator·1Password 등) 등록·검증·해제.
- 일회용 복구 코드(기기 분실 대비) 발급·사용·재발급.
- 비밀번호·OAuth 두 로그인 경로 모두에 MFA 단계를 넣는다.
- 토큰에 인증 방식(`amr`)을 담고 refresh 뒤에도 유지한다(소비자가 OIDC `amr`·`acr` 로 옮길 수 있게).
- auth-ui: 로그인 폼의 코드 입력 단계, OAuth 뒤 코드 입력 화면, MFA 설정 구성 요소. 언어는 ko/en/ja.

**비목표 (이번 범위 밖)**
- 패스키(WebAuthn), SMS·이메일 OTP.
- "이 기기 기억하기"(일정 기간 MFA 생략).
- 민감 작업 전 재인증(step-up).
- 등록 강제 정책·운영자의 MFA 초기화 화면(소비자 몫. toolkit 은 초기화 함수만 제공).
- MFA 를 켤 때 다른 기기의 기존 세션 종료(toolkit 에 사용자별 세션 목록이 없다).
- binder 연동(정책·ID 토큰 `amr`·설정 화면) — 별도 설계서.

**반목표 (기술적으로 동작해도 실패로 본다)**
- MFA 를 켠 사용자에게 어떤 경로로든 MFA 없이 세션이 발급되는 것.
- MFA 를 켜지 않은 소비자(tavlet·galpi·showcasehub)의 동작이 바뀌는 것.
- TOTP 비밀 키를 평문으로 저장하거나 응답·로그에 다시 노출하는 것.

## 제약

- toolkit 계층 규칙: `core` 는 프레임워크를 import 하지 않는다. `next`·`prisma` 는 `core` 만 import 한다.
- `package.json` exports 는 수기 목록이므로 새 모듈마다 항목을 추가한다(`exports-integrity` 테스트가 검사).
- 오류 응답은 standard 형식(`{success:false,error:{code,key,message,userMessage}}`)을 따르고 `ERROR_CODES` 에 등록한다.
- auth-ui 계약 테스트(`__tests__/contract/toolkit-contract.test.tsx`)가 실제 toolkit 처리기로 폼을 검증한다.

## 접근 방식

| 방식 | 내용 | 판단 |
|---|---|---|
| **A. 대기 토큰 + 확인 단계 (채택)** | 1차 인증 성공 시 MFA 를 켠 사용자에게는 세션 대신 5분짜리 서명된 대기 쿠키만 준다. 코드 검증 성공 시 세션 발급 | 세션이 아예 없으므로 소비자의 기존 인증 검사를 고칠 필요가 없다 |
| B. 제한된 세션 | 일반 세션에 `mfa:"pending"` 표시를 붙인다 | 세션을 확인하는 모든 곳(toolkit 미들웨어·binder proxy·IdP·tavlet)이 검사해야 하고, 하나만 빠져도 우회된다 |
| C. 외부 라이브러리로 교체 | better-auth 2FA 플러그인 등 | toolkit 인증 전체를 바꿔야 한다 |

## 설계

### 1. 설정 (`AuthHandlerOptions.mfa`, 없으면 기능 꺼짐)

```ts
mfa?: {
  enabled: boolean;
  issuer: string;                 // 인증 앱에 표시될 서비스 이름 (예: "binder")
  encryptionKeys: string[];       // base64 (32 bytes). 첫 키로 암호화, 나머지는 복호화만(키 교체용)
  repository: MfaRepository;      // dependencies 로 옮겨도 무방 — 빌더 판단
  attemptStore?: MfaAttemptStore; // 없으면 메모리 저장소 + 기동 경고(단일 인스턴스 전용)
}
urls.mfaChallenge?: string        // OAuth 뒤 코드 입력 화면 경로. mfa.enabled 면 필수
```

`mfa.enabled` 가 거짓이거나 `mfa` 가 없으면 로그인·OAuth·refresh 의 동작과 응답은 0.29 와 바이트 단위로 같다.

### 2. 저장 (`core/auth/mfa` 의 `MfaRepository` + Prisma 어댑터)

모델 두 개를 새로 둔다(사용자 테이블의 고정 필드 목록은 건드리지 않는다).

- `UserMfa`: `userId`(PK·FK), `secretEnc`(암호문), `enabledAt`(null 이면 등록 진행 중), `lastUsedStep`(재사용 방지),
  `createdAt`, `updatedAt`.
- `MfaRecoveryCode`: `id`, `userId`, `codeHash`, `usedAt`.

저장소 인터페이스(이름은 빌더가 다듬어도 된다):
`findByUserId`, `savePendingSecret`, `enable(userId, recoveryCodeHashes)`, `disable(userId)`,
`markStepUsed(userId, step)`(원자적: `lastUsedStep < step` 일 때만 갱신, 성공 여부 반환),
`consumeRecoveryCode(userId, hash)`(원자적: 미사용일 때만 `usedAt` 기록), `replaceRecoveryCodes`, `countUnusedRecoveryCodes`.
Prisma 스키마 조각은 `docs/MODULE_USAGE.md` 에 싣는다.

### 3. TOTP · 복구 코드 · 암호화 (`core`)

- **TOTP:** SHA-1, 6자리, 30초, 앞뒤 1스텝 허용. 외부 의존성 없이 `node:crypto` HMAC 과 base32 를 직접 구현하고
  RFC 6238 부록 B 테스트 벡터로 검증한다. 비밀 키는 20바이트 무작위 값.
- **재사용 방지:** 검증된 스텝이 `lastUsedStep` 이하이면 거부한다(같은 코드로 두 번 로그인 불가).
- **복구 코드:** 10개, `xxxx-xxxx` 형식(소문자 base32, 약 40비트). 무작위성이 충분하므로 SHA-256 해시로 저장하고
  비교 전에 하이픈·대소문자를 정규화한다. 한 번 쓰면 끝이다.
- **암호화:** AES-256-GCM. 저장 형식은 `v1.<keyId>.<iv>.<ciphertext>.<tag>`(base64url), `keyId` 는 키의 SHA-256 앞 8자.
  복호화는 `keyId` 로 키를 고른다.
- **otpauth URI:** `otpauth://totp/<issuer>:<email>?secret=…&issuer=…&algorithm=SHA1&digits=6&period=30`.

### 4. 로그인 흐름

**대기 쿠키(`mfa_pending`)**: 서명된 JWT(`tokenType:"mfa_pending"`, `userId`, `jti`, `amr`(1차 인증 방식), `origin`
(`password`|`oauth`), 만료 5분). HttpOnly, SameSite=Lax(OAuth 리디렉션 뒤 최상위 GET 에서도 실린다), 경로 `/api/auth`,
`authCookieName` 의 `__Host-` 접두사 옵션을 따른다. 기존 `verifyAccessToken` 은 이 토큰을 거부한다(tokenType 검사).

- **비밀번호 로그인:** 기존 순서(비밀번호 검증 → 이메일 인증 확인)를 그대로 지난 뒤, MFA 가 켜진 사용자면
  `issueSession` 대신 대기 쿠키를 붙여 **401 `MFA_REQUIRED`** 를 응답한다. 2xx 를 쓰지 않는 이유: 구버전 auth-ui 는
  2xx 를 로그인 성공으로 보고 이동하므로 세션 없는 상태로 빠진다. 오류 응답이면 구버전에서도 메시지만 보인다.
  `onAfterLogin`·`updateLastLoginAt` 은 MFA 성공 뒤에 호출한다.
- **OAuth 콜백:** 계정 연결·생성과 `onAfterOAuth` 까지는 그대로 진행한다(사용자를 알아야 하므로). MFA 가 켜진
  사용자면 세션 쿠키 대신 대기 쿠키를 붙여 `urls.mfaChallenge` 로 리디렉션한다. 새로 만든 사용자는 MFA 가
  꺼져 있으므로 `onOAuthFirstLogin` 과 충돌하지 않는다.
- **`POST /mfa/verify`** `{code}` 또는 `{recoveryCode}`: 대기 쿠키 검증 → 시도 제한 확인 → 코드 검증(재사용 방지
  포함) → 대기 쿠키 삭제 + `jti` 사용 처리 → `issueSession`(`amr` 포함). 응답 본문은 로그인 성공과 같고,
  `origin:"oauth"` 이면 `redirectTo`(= `urls.afterOAuth ?? urls.afterLogin`)를 더한다.
- **시도 제한:** 대기 토큰당 실패 5회면 그 토큰을 폐기한다(다시 로그인). 사용자당 15분에 실패 10회면 15분 동안
  **429 `MFA_LOCKED`**. 같은 사용자의 새 대기 토큰을 계속 받아 우회하는 것을 막기 위해 사용자 단위로도 센다.
  저장소는 기존 `cache-token-stores` 패턴(캐시 주입)을 따른다.

### 4-1. 검토에서 정한 세부 규칙 (설계자 판단)

- **토큰 전달 방식별 대기 토큰:** 대기 토큰은 `tokenDelivery` 를 따른다. cookie 는 `mfa_pending` 쿠키만,
  header 는 응답 본문의 `mfaToken` 만, hybrid 는 둘 다 준다. `/mfa/verify` 는 쿠키 또는 본문 `mfaToken` 을 받는다.
  OAuth 는 지금처럼 항상 쿠키다.
- **대기 쿠키 경로:** `mfa.cookiePath`(기본 `/api/auth`)로 바꿀 수 있게 한다. auth-ui `apiBasePath` 를 바꾼 소비자용.
- **OAuth 부수 효과의 시점:** MFA 를 켠 사용자는 `updateLastLoginAt`·`onAfterOAuth`·토큰 생성을 코드 검증 성공 뒤로
  미룬다. 그러려고 `OAuthCallbackService` 를 "사용자 확인·계정 연결"과 "토큰 발급"으로 나눈다. 대기 토큰에
  `provider` 를 담고, OAuth 출신 검증 성공 시 `onAfterOAuth(user, provider, false)` 를 부른다. 비밀번호 출신만
  `onAfterLogin` 을 부른다(지금의 훅 의미를 유지). MFA 를 켜지 않은 사용자의 OAuth 동작은 그대로다.
- **관리 엔드포인트도 시도 제한:** `/mfa/disable`·`/mfa/recovery-codes`·`/mfa/enable` 의 코드 실패도 같은
  사용자 단위 실패 횟수에 포함한다. 세션을 훔친 사람이 코드를 대입해 MFA 를 끄는 것을 막는다.
- **일회성 `jti` 와 실패 횟수 저장:** 둘 다 `attemptStore` 에 둔다. 공유 캐시가 없으면 메모리 저장소로 동작하고
  기동 시 "여러 인스턴스에서는 공유 캐시 필요" 경고를 남긴다. TOTP 재사용은 DB 의 `lastUsedStep` 이 막으므로,
  인스턴스 간 `jti` 재사용이 생겨도 코드 없이 세션을 얻을 수는 없다.
- **auth-ui `AuthProvider.login()`:** MFA 가 필요하면 `key:"MFA_REQUIRED"` 인 `AuthError` 를 던지고, 컨텍스트에
  `verifyMfa({code}|{recoveryCode})` 를 추가한다. README Migration 절에 적는다.
- **코드 입력 화면의 로케일:** `urls.mfaChallenge` 는 경로 하나다. 로케일 접두사는 소비자의 라우팅(binder proxy)이 붙인다.

### 4-2. 잠금 정책 (사용자 결정: 사용자 단위 잠금 + 알림)

- 사용자당 15분 안에 코드 실패 10회(로그인 검증과 관리 엔드포인트 합산)면 그 사용자의 코드 입력을 15분 막는다.
- 잠긴 동안에도 `/login`·OAuth 는 지금처럼 `MFA_REQUIRED`·코드 입력 화면으로 보낸다(잠금 여부를 1차 인증
  단계에서 드러내지 않는다). `/mfa/verify` 와 관리 엔드포인트가 **429 `MFA_LOCKED`** 와 `retryAfter`(초)를 준다.
- 잠기는 순간 훅 `onMfaLocked(user)` 를 한 번 부른다. 소비자는 "비밀번호가 노출된 것 같으니 바꾸라"는 메일을
  보낸다. 비밀번호 재설정이 끝나면 잠금과 실패 횟수를 지운다.
- 받아들인 비용: 비밀번호를 아는 공격자는 진짜 사용자를 15분씩 반복해서 잠글 수 있다. 비밀번호를 바꾸면 멈춘다.

### 5. `amr` 와 refresh

- access·refresh 토큰에 `amr: string[]` 을 더한다. 값: 비밀번호 `"pwd"`, OAuth `"fed"`, TOTP `"otp"`, 복구 코드 `"rec"`,
  2단계를 거쳤으면 `"mfa"`(예: `["pwd","otp","mfa"]`). `"fed"`·`"rec"` 는 toolkit 내부 값이며, OIDC 로 내보낼 때의
  변환은 소비자 몫이다.
- refresh 회전 시 기존 refresh 토큰의 `amr` 을 새 access·refresh 토큰에 그대로 옮긴다. `amr` 이 없는 옛 토큰은
  없는 채로 둔다.
- `/me` 응답과 `extendUserResponse` 에 `mfaEnabled` 를 더한다(설정 화면용).

### 6. MFA 관리 엔드포인트 (로그인 세션 필요)

| 경로 | 동작 |
|---|---|
| `GET /mfa` | `{enabled, recoveryCodesRemaining}` |
| `POST /mfa/setup` | 새 비밀 키를 만들어 암호화 저장(`enabledAt` null), `{secret, otpauthUri}` 반환. 이미 켜져 있으면 409 |
| `POST /mfa/enable` `{code}` | 코드가 맞으면 켜고 복구 코드 10개를 **한 번만** 반환 |
| `POST /mfa/disable` `{code}`·`{recoveryCode}` | 유효한 코드가 있어야 끈다. 비밀 키·복구 코드 삭제 |
| `POST /mfa/recovery-codes` `{code}` | TOTP 코드 확인 후 복구 코드 재발급(기존 것은 무효) |

`AuthRouteHandlers` 에 `mfaVerify`·`mfaStatus`·`mfaSetup`·`mfaEnable`·`mfaDisable`·`mfaRecoveryCodes` 를 더하고,
소비자는 디스패치 라우트에 한 줄씩 연결한다. 훅: `onMfaEnabled(user)`, `onMfaDisabled(user, by)`,
`onMfaFailed(userId, reason)`(감사 로그용), `onMfaLocked(user)`(4-2절). 운영자 초기화용으로 `core` 에 `resetMfa(repository, userId)` 를 내보낸다.

### 7. 오류 코드 (`ERROR_CODES`·`AUTH_ERROR_CODE_MAP`·ko/en/ja 메시지)

`MFA_REQUIRED`(401), `MFA_INVALID_CODE`(401), `MFA_PENDING_EXPIRED`(401, 대기 쿠키 없음·만료·폐기),
`MFA_LOCKED`(429), `MFA_ALREADY_ENABLED`(409), `MFA_NOT_ENABLED`(409), `MFA_NOT_CONFIGURED`(404, 기능 꺼짐).
숫자 코드는 기존 대역 규칙에 맞춰 빌더가 정한다.

### 8. auth-ui (0.10.0)

- **`LoginForm`:** `MFA_REQUIRED` 를 받으면 같은 카드 안에서 코드 입력 단계로 바뀐다(6자리 입력, "복구 코드 사용"
  전환, 뒤로 가기). `/mfa/verify` 성공 시 기존 `onSuccess`·리디렉션 규칙을 그대로 따른다. `MFA_PENDING_EXPIRED` 면
  1단계로 돌아가 안내한다.
- **`MfaChallengeScreen`:** OAuth 뒤 `urls.mfaChallenge` 에 놓는 독립 화면. 성공 시 응답의 `redirectTo` 로 이동.
- **`MfaSettings`:** 상태 표시 → 켜기(QR 코드 + 수동 입력용 키 + 확인 코드 → 복구 코드 표시·복사·내려받기,
  "저장했습니다" 확인 후 닫기) → 끄기 → 복구 코드 재발급. QR 은 클라이언트에서 그린다(`qrcode-generator` 등
  의존성 없는 소형 라이브러리 — 빌더 판단).
- i18n: `AuthMessages` 에 `mfa` 구역을 더하고 `mergeMessages` 의 구역 목록에도 추가한다. ko/en/ja.
- 계약 테스트에 MFA 흐름(로그인 → `MFA_REQUIRED` → verify → 세션)을 추가한다.

### 9. 출시

1. toolkit 0.30.0(기본 꺼짐, CHANGELOG·MODULE_USAGE·MODULE_STRUCTURE·FRAMEWORK_TIERS·auth README 갱신).
2. auth-ui 0.10.0(README Migration 절).
3. binder 연동은 별도 설계서. tavlet·galpi 등은 버전을 올려도 `mfa` 를 설정하지 않으면 영향이 없다.

## 빌더에게 맡기는 것

- 저장소 메서드 이름·파일 분할, `repository` 를 `mfa` 아래 둘지 `dependencies` 아래 둘지.
- 오류 숫자 코드, QR 라이브러리 선택, 화면의 세부 배치.
- 시도 제한 저장소의 키 이름과 메모리 구현 방식.
