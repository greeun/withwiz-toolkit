# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.1]

### Performance
- `InMemoryCacheManager` now tracks LRU order through the entry `Map`'s
  insertion order instead of a parallel `accessOrder` array. Cache hits
  re-insert the entry and eviction pops the oldest key, making both paths
  O(1) and removing the previous O(n) `indexOf`/`splice` scans. Per-op
  debug logging in the hot path was also dropped.
- `HybridCacheManager.invalidate*` skips the `Promise.allSettled` wrapper
  when only one backend is active (the common memory-only path); the Redis
  branch remains independently error-guarded.

### Docs
- Added `docs/FEATURES.md`: a feature catalog for all source modules.

## [0.9.0]

### Added
- Raw SQL auth adapter (`@withwiz/toolkit/core/auth/adapters/sql`): built-in
  `SqlUserRepository`, `SqlOAuthAccountRepository`, `SqlEmailTokenRepository`
  implementing the `core/auth` repository interfaces over raw SQL. Supports
  PostgreSQL and MySQL via a driver-independent `QueryExecutor`, with
  overridable table/column names (snake_case defaults). The auth module can now
  run with Prisma or raw SQL.

## [0.8.0] - 2026-06-15

### Breaking — React layer removed (extracted to `@withwiz/ui`)

- The entire `react` tier — UI components (`react/components/ui/*`), hooks
  (`useDataTable` / `useDebounce` / `useExitIntent` / `useTimezone`),
  `react/error/error-display`, and browser-context utils
  (`react/utils/client-utils`, `react/utils/qr-code`) — was extracted to the
  standalone [`@withwiz/ui`](https://github.com/greeun) package and **removed**
  from this package.
- All `./react/*` subpaths were removed from `exports`. `@withwiz/ui` mirrors
  the same `react/*` namespace, so migration is a prefix swap:
  `@withwiz/toolkit/react/*` → `@withwiz/ui/react/*`.
- `@radix-ui/react-select` dropped from dependencies (only the react tier used it).
- `react` / `react-dom` peers are **retained** (still `optional`) — `next/error/ErrorBoundary`
  is a React component, so the `next` tier still needs React.
- The package is now three tiers: `core` / `next` / `prisma`.

```bash
# Migration codemod (macOS sed)
grep -rl '@withwiz/toolkit/react' src | xargs sed -i '' 's|@withwiz/toolkit/react|@withwiz/ui/react|g'
# then add @withwiz/ui to dependencies
```

### Added

- **tokenDelivery 모드** — 인증 토큰 전달 방식을 `'cookie' | 'header' | 'hybrid'` 중 선택 가능 (`AuthConfig.tokenDelivery`, `AuthHandlerOptions.tokenDelivery`). 우선순위: 핸들러 옵션 > 전역 config > `'hybrid'`(기존 동작, non-breaking).
  - `cookie`: 응답 body 에서 토큰 제거, HttpOnly 쿠키 전용. 미들웨어 헤더 폴백 비활성.
  - `header`: 쿠키 미설정, body/Authorization 헤더 전용. refresh 가 body `{ refreshToken }` 입력 지원 (신규).
  - `hybrid`: 기존 동작 + refresh 의 body 폴백 추가 (쿠키 우선, additive).
- 설계 문서: `docs/auth/2026-06-12-token-delivery-mode-design.md`

### Notes

- 기본값이 `'hybrid'` 이므로 기존 소비 프로젝트는 무수정 동작.
- OAuth callback 은 redirect 특성상 모드와 무관하게 쿠키 전달 — header 모드 앱은 hybrid 권장.

## [0.7.1] - 2026-06-11

### Fixed

- `next/utils` csv-export 의 date-fns optional peer 정합 수정.

## [0.7.0] - 2026-05-26

### Breaking — 프레임워크 티어 재구조화

`src/` 전체와 모든 npm subpath를 프레임워크 의존성에 따라 **4개 티어**로 분리:

```
core/   ← 프레임워크 독립 (pure TS, zero framework dep)
next/   ← Next.js 의존
react/  ← React 의존
prisma/ ← Prisma 어댑터
```

- **Hard cut**: 구 subpath에 대한 alias를 제공하지 않음 (deprecate 사이클 없음). 모든 소비 프로젝트는 import 경로를 일괄 치환해야 함.
- `core`는 어떤 프레임워크도 import하지 않음. `next`/`react`/`prisma`는 `core`만 import 가능하며 서로 import 불가. `./initialize`는 모든 티어를 조립하는 composition root 예외.
- `error` 배럴 **3-way 분할**: `core/error`(AppError·코드·i18n 메시지·`extractErrorInfo`) / `next/error`(error-handler·LocaleDetector·ErrorBoundary) / `react/error`(error-display).
- `utils` 배럴 **2-way 분할**: `core/utils`(sanitizer·type-guards 등 pure) / `next/utils`(api-helpers·cors·csv-export·error-processor) / `react/utils`(client-utils·qr-code).
- `extractErrorInfo`는 의존성 없는 순수 함수로, `react`에서 `core/error`로 강등 (티어 규칙 준수).

### Added

- **`peerDependenciesMeta`**: `next`/`react`/`react-dom`를 `optional`로 선언 → `core` 티어만 쓰는 소비자(백엔드·CLI)가 프레임워크 미설치 경고 없이 사용 가능.
- **`"type": "module"`**: ESM-only 출력에 맞춘 선언 (기존 누락으로 인한 bare-node `MODULE_TYPELESS_PACKAGE_JSON` 경고·reparse 오버헤드 제거).
- **`docs/FRAMEWORK_TIERS.md`** 신설: 티어 모델·규칙·티어별 모듈표·마이그레이션 매핑.
- OAuth provider `microsoft`/`meta` subpath 추가 (기존 누락분).
- **dev 스크립트**: `build:watch` (tsup --watch), `build:types:watch` (tsc --watch) 추가 — 소비처에서 link 사용 시 변경 감지 빌드 편의.

### Fixed

- **DataTable `ColumnDef`** 에 `minWidth` / `maxWidth` 정식 선언, `as any` 캐스트 제거. 컬럼 폭 제약을 타입 시스템 안으로 끌어들여 컴파일 타임 검증 가능.

### Migration

구 → 신 경로 일괄 치환. macOS는 `sed -i ''`, Linux는 `sed -i`. **순서 중요 — 구체적 패턴부터, core 광역 치환은 마지막**:

> ⚠️ **적용 범위 — 가장 흔한 누락**: `src/`뿐 아니라 `tests/`, `__tests__/`,
> 스크립트 등 **`@withwiz/toolkit`을 import하는 모든 디렉토리**가 대상입니다.
> 테스트 파일도 toolkit을 직접 import하므로, 테스트 디렉토리를 빼고 치환하면
> 옛 경로가 잔존해 0.7에서 모듈 해석 실패(빌드/테스트 깨짐)합니다. 아래 `find .`는
> 프로젝트 루트 전체를 잡으니 디렉토리를 임의로 좁히지 마세요.

```bash
# 프로젝트 루트에서. node_modules만 제외, 나머지(src/tests/...) 전부 포함
F=$(find . \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*")

# 1. 티어 이동 (가장 구체적)
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/auth/adapters/prisma|@withwiz/toolkit/prisma/auth-adapter|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/auth/handlers|@withwiz/toolkit/next/auth-handlers|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/auth/handler-types|@withwiz/toolkit/next/auth-types|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/auth/core/|@withwiz/toolkit/core/auth/|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/middleware/cors-config|@withwiz/toolkit/core/cors|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/middleware|@withwiz/toolkit/next/middleware|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/error/error-handler|@withwiz/toolkit/next/error/error-handler|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/error/error-display|@withwiz/toolkit/react/error/error-display|g"
for m in api-helpers cors csv-export error-processor; do
  echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/utils/$m|@withwiz/toolkit/next/utils/$m|g"
done
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/utils/client/|@withwiz/toolkit/react/utils/|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/components/ui|@withwiz/toolkit/react/components/ui|g"
echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/hooks|@withwiz/toolkit/react/hooks|g"

# 2. core 광역 (마지막 — 위 1번이 모두 끝난 뒤). 개별 모듈로 풀어 sed 방언 차이 회피
for m in auth cache config constants error geolocation logger storage system types utils validators; do
  echo "$F" | xargs sed -i '' "s|@withwiz/toolkit/$m|@withwiz/toolkit/core/$m|g"
done
```

> 참고: macOS sed(BRE)는 `\|` alternation을 지원하지 않으므로 위처럼 `for` 루프로
> 풀어 쓰는 것이 sed 방언(BSD/GNU) 차이에 안전합니다. 또한 `zsh`에서는 `$F` 같은
> 변수가 단어 분리되지 않으니 `find ... -print0 | xargs -0 sed` 형태 권장.

- `./initialize`는 변경 없음 (composition root).
- **barrel 분할 주의**: 한 import 문에서 여러 티어 심볼을 함께 꺼내쓰던 코드는 sed로 자동 분리되지 않으므로 **수동 분리** 필요:
  ```ts
  // 구
  import { AppError, errorHandlerMiddleware } from '@withwiz/toolkit/error';
  // 신 (티어별 분리)
  import { AppError } from '@withwiz/toolkit/core/error';
  import { errorHandlerMiddleware } from '@withwiz/toolkit/next/error';
  ```
- 전체 매핑표·티어 규칙은 [`docs/FRAMEWORK_TIERS.md`](docs/FRAMEWORK_TIERS.md) 참조.
- 치환 후 **빌드 + 타입체크 + 소비처 자체 테스트 스위트**를 재실행해 검증할 것.
  특히 테스트 파일도 toolkit을 import하므로, 테스트 디렉토리 누락 시 단위
  테스트에서 옛 경로 import 실패가 발생합니다 (이를 통해 누락을 역으로 탐지 가능).
- 실소비처 검증 결과:
  - 소규모(Next 16, 부분 티어): sed + `tsc --noEmit` 클린 통과
  - 대규모(Next 16 + React 19 + Prisma 7, 823 소스 + 844 테스트, 4티어 전부):
    `src` + `tests` 완전 마이그레이션 후 Turbopack 프로덕션 빌드 컴파일 성공,
    단위 테스트 7576/7587 통과, **toolkit 0.7 관련 회귀 0건**
    (잔여 실패는 DB·`next/server` 등 소비처 인프라 의존으로 0.7 무관).

## [0.6.5] - 2026-05-15

### Removed
- **BREAKING**: `auth/types` 배럴에서 `handler-types` 재내보내기 제거 (`src/auth/types/index.ts`)
  - 기존: `auth/types/index.ts`가 마지막 줄 `export * from './handler-types'`로 `AuthHandlerOptions` / `AuthHandlerDependencies` / `AuthHandlerHooks` / `AuthHandlerUrls` / `AuthHandlerResult`를 `@withwiz/toolkit/auth/types`에서도 접근 가능하게 했음
  - 변경: `auth/types` 배럴은 이제 framework-독립적 타입만 노출. handler-types(Next.js `NextRequest` 의존)는 **별도 subpath `@withwiz/toolkit/auth/handler-types`로 분리**
  - 이유: `auth/types` 배럴은 core/JWT/OAuth/Password처럼 프레임워크-독립적 타입을 모은 진입점인데, Next.js `NextRequest`를 의존하는 handler-types를 transitive하게 끌어들이고 있어 비-Next 환경에서 타입 해석 실패 위험이 있었음. 0.7 티어 분할의 사전 정리.

### Added
- **`./auth/handler-types` subpath**: `package.json` exports에 `./dist/auth/types/handler-types.js`로 신규 추가

### Migration
- **`@withwiz/toolkit/auth/types`에서 `AuthHandlerOptions` 등을 import하던 소비 프로젝트**: 새 subpath로 교체:
  ```diff
  - import type { AuthHandlerOptions } from '@withwiz/toolkit/auth/types';
  + import type { AuthHandlerOptions } from '@withwiz/toolkit/auth/handler-types';
  ```
- 영향받는 타입: `AuthHandlerOptions`, `AuthHandlerDependencies`, `AuthHandlerHooks`, `AuthHandlerUrls`, `AuthHandlerResult`
- `JWTConfig` / `JWTPayload` / `TokenPair` / `OAuthConfig` / `PasswordConfig` 등 다른 타입은 그대로 `@withwiz/toolkit/auth/types`에서 import (변경 없음)
- 본 패키지의 모든 내부 사용처는 이미 `../types/handler-types` 상대 경로를 쓰고 있어 내부 동작 차이 없음.

## [0.6.4] - 2026-05-15

### Docs
- **`docs/MODULE_USAGE.md` §3.5 "Auth Database Adapter (Prisma)" 신설**
  - 그동안 export되어 있었지만 사용 가이드가 비어있던 `PrismaUserRepository` / `PrismaOAuthAccountRepository` / `PrismaEmailTokenRepository` 사용법을 문서화
  - 요구 Prisma 스키마(기본값 기준) 전체를 모델 정의로 명시
  - `PrismaAdapterConfig.userFields` / `tokenTables` 외부화 항목과 적용 범위 명확화
  - **원칙 명문화**: `userFields`는 **Prisma 모델 필드명** 기준이며 DB 컬럼 변형은 소비 프로젝트의 `@map`으로 처리
  - **⚠️ OAuth Account 스키마 가정 경고 섹션 추가**: `PrismaOAuthAccountRepository`가 NextAuth.js v4 Adapter 호환 스키마를 강제하는 구조적 가정(4개) 명시
    1. `Account.type` 필드 + `String` 타입 (값 `'oauth'` 리터럴)
    2. `Account ↔ AccountToken` 1:1 분리
    3. `AccountToken.expiresAt`는 `Int` (epoch seconds), `DateTime` 아님
    4. 복합 unique 인덱스명 `provider_providerAccountId` (Prisma 기본 명명 규칙)
  - 위 가정에 맞지 않는 스키마를 쓰는 프로젝트가 `OAuthAccountRepository` 인터페이스를 자체 구현해 주입하는 우회로 예시 포함

### Changed
- **JWT 기본값 단일 진실 원천화** — `constants/security.ts`의 `JWT_DEFAULTS`를 실제로 사용하도록 통일 (동작 변경 없음)
  - 기존: `'7d'` / `'30d'` / `'HS256'` 리터럴이 `auth/config.ts`, `auth/handlers/{login,me}.handler.ts`, `auth/services/{login,oauth-callback,token-refresh}.service.ts` 6개 파일에 inline 복사돼 있었고, `JWT_DEFAULTS` 상수는 선언만 되고 어디서도 import되지 않는 고아 상수였음
  - 변경: 6개 파일이 `JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES` / `DEFAULT_REFRESH_TOKEN_EXPIRES` / `ALGORITHM`을 import하여 사용
  - `auth/config.ts`의 `configWarn` 메시지도 템플릿 리터럴로 변경해 기본값 변경 시 메시지가 자동 동기화되도록 정리
  - 효과: 향후 JWT 기본 만료/알고리즘 정책 변경 시 `JWT_DEFAULTS` 한 곳만 수정하면 됨

### Fixed
- **Prisma 어댑터 `PrismaUserRepository.verifyEmail` 자기모순 수정** (`src/auth/adapters/prisma/index.ts:138`)
  - 동일 어댑터의 `create` / `update` / `mapToBaseUser`는 이미 `config.userFields.emailVerified`를 사용 중이었으나, `verifyEmail`만 리터럴 `emailVerified` 컬럼에 쓰고 있던 회귀를 해소
  - 변경 전: `data: { emailVerified: new Date() }` (리터럴)
  - 변경 후: `data: { [this.config.userFields.emailVerified]: new Date() }` (설정 기반)
  - 회귀 테스트 추가: `__tests__/unit/auth/prisma-adapter-config.test.ts` → `describe('verifyEmail — userFields.emailVerified 일관성')` 2건 (기본값/커스텀)

### Migration
- **기본 `userFields`(`emailVerified` 컬럼명 그대로) 를 쓰는 소비 프로젝트**: 동작 차이 없음. 별도 작업 불필요.
- **`PrismaAdapterConfig.userFields.emailVerified` 를 다른 Prisma 모델 필드명으로 오버라이드한 소비 프로젝트** (예: `'verifiedAt'`, `'isEmailVerified'` 등):
  - 이번 버전부터 `userRepository.verifyEmail(email)` 호출이 **오버라이드한 Prisma 모델 필드**에 쓰여집니다 (이전에는 항상 `emailVerified` 리터럴에 쓰여졌음).
  - 점검 권장 사항:
    1. 실제 Prisma 모델에 오버라이드한 필드(`verifiedAt` 등)만 존재하는지 확인 — 만약 `emailVerified` 필드가 함께 남아있었고 이메일 인증이 의도와 다르게 그쪽에 기록돼 왔다면, 이번 업데이트 후 정상 필드에 기록되기 시작합니다.
    2. 양쪽 필드 데이터가 어긋나 있던 경우 일회성 백필(backfill) 마이그레이션 필요 여부 검토.
    3. 이메일 인증 상태를 읽는 화면/로직이 동일한 `userFields.emailVerified` 설정값을 사용하고 있는지 재확인.

### Notes
- 본 패키지의 `userFields` 설정은 **Prisma 모델 필드명** 기준입니다. DB 컬럼명 변형은 소비 프로젝트의 Prisma 스키마에서 `@map`으로 처리하세요 (예: `verifiedAt DateTime? @map("verified_at")`).

## [0.6.3] - 2026-05-14

### Added
- **Microsoft OAuth Provider** (`@withwiz/toolkit/auth/core/oauth/providers/microsoft`)
  - Microsoft Entra v2.0 `common` 테넌트 기반 server-side authorization code flow
  - `id_token` 클레임 디코딩 방식으로 사용자 정보 추출 (Graph `/me` 호출 없음)
  - `iss` / `aud` / `exp` / `oid` 검증 — `oid` 누락 시 INVALID_RESPONSE (sub 폴백 안 함, 식별자 안정성 보장)
  - `email_verified === true`일 때만 `emailVerified: true` (보수적)
  - 인터페이스 우회: `OAuthTokenResponse.access_token` 필드에 id_token 담아 반환 (`MODULE_USAGE.md` 경고 참조)
- **Meta(Facebook) OAuth Provider** (`@withwiz/toolkit/auth/core/oauth/providers/meta`)
  - Graph API **v25.0** (`META_GRAPH_VERSION` 모듈 상수)
  - GET + query string 방식 token exchange (Meta 공식 권고)
  - `/me?fields=id,name,email,picture` 응답 매핑, `picture.data.url` 폴백 처리
  - `emailVerified`: Graph API가 이메일 검증 신호를 제공하지 않아 `email` 존재 시 `true` 처리 — Microsoft(`email_verified`)·Kakao(`is_email_verified`)와 달리 strict 검증 불가(provider 한계)
  - `exchangeCodeForToken`: HTTP 200 + `{ error }` 응답 대비 `access_token` 부재 시 `OAuthError(INVALID_RESPONSE)` (미검증 캐스팅 차단)
- **`OAUTH_PROVIDERS`** 상수에 `MICROSOFT: 'microsoft'`, `META: 'meta'` 추가
- **`OAuthManager`** 가 microsoft / meta 자동 등록
- **`OAUTH_PROVIDERS` lint 테스트** — 상수에 등록된 모든 provider가 OAuthManager에 자동 등록되어 있는지 회귀 검증

### Changed
- **Kakao OAuth Provider** 응답 처리 안전성 강화 (기능 변경 없음)
  - 토큰/사용자 응답에 file-local 타입(`KakaoTokenResponse`, `KakaoAccount`, `KakaoUserResponse`) 부여
  - HTTP 200 + `error` 필드 응답에서 `error_description` 포함 `OAuthError(TOKEN_EXCHANGE_FAILED)` 발생
  - `emailVerified`: `is_email_valid === true && is_email_verified === true` 둘 다 strict true일 때만 true
  - `data.id` 누락 시 `OAuthError(INVALID_RESPONSE)` (이전엔 `TypeError`)
- **`MODULE_USAGE.md`**에 Microsoft 어댑터의 id_token-in-access_token 시맨틱 경고 추가

### Spec
- `docs/superpowers/specs/2026-05-14-oauth-providers-design.md` (2 라운드 외부 평가자 검증 완료)

## [0.5.0] - 2026-04-28

### Removed
- **BREAKING**: 도메인 특화 캐시 카테고리/상수/타입을 패키지에서 제거. 본 패키지는 보편 카테고리(ANALYTICS, USER, GEOIP, SETTINGS, RATE_LIMIT)만 다루며, 도메인 카테고리는 각 프로젝트의 extension에서 자체 정의하세요.
  - `getCacheConfig` 도메인 헬퍼 제거: `link`, `alias`, `reservedWords`, `community`, `urlToken`, `apiKey`, `apiConfig`
  - `getCacheTTL` 도메인 헬퍼 제거: `reservedWords`, `alias`, `community`, `link`
  - `CACHE_TTL_DEFAULTS` 도메인 키 제거: `LINK`, `ALIAS`, `COMMUNITY`, `RESERVED_WORDS`
  - `CACHE_DURATION_DEFAULTS` 도메인 키 제거: `LINK`, `ALIAS`, `RESERVED_WORDS`, `COMMUNITY`, `URL_TOKEN`, `API_KEY`, `API_CONFIG`
  - `CACHE_ENV_VARS` 도메인 키 제거: `CACHE_TTL_LINK/ALIAS/COMMUNITY/RESERVED_WORDS`
  - `ICacheTTLConfig`, `ICacheEnv` 타입에서 도메인 필드 제거 (LINK, ALIAS, COMMUNITY, RESERVED_WORDS, URL_TOKEN, API_KEY, API_CONFIG)
- **BREAKING**: `cache/cache-keys-legacy.ts` 모듈 통째 제거 (기존 `@deprecated`이던 `cacheKeys` export)
- **BREAKING**: `constants/security.ts`의 `API_KEY = { LENGTH, PREFIX: 'tlog_' }` 상수 제거 — `tlog_` prefix는 도메인 종속이므로 소비 프로젝트가 자체 정의해야 함
- **BREAKING**: `constants/pagination.ts`의 `PAGE_SIZES`에서 도메인 키 제거: `LINKS`, `RESERVED_WORDS`, `NOTICES`, `TAGS`, `CLICK_HISTORY`. 보편 키만 유지: `USERS`, `ACTIVITY`, `SEARCH_RESULTS`
- **BREAKING**: `types/qr-code.ts` `IQRCodeStats.aliasClicks` → `clicks`로 일반화

### Changed
- 가이드 주석에서 "URL Shortener 서비스 특화" 표현을 "도메인 특화 (소비 프로젝트의 extension에 정의)"로 일반화
- `utils/README.md`에서 별칭(Alias) 검증 섹션 제거 (해당 코드는 본 패키지에 존재하지 않으며 도메인 특화)
- `utils/optimistic-lock.ts`의 docstring 예시를 `prisma.link` → `prisma.entity`로 일반화

### Migration
- 도메인 캐시 카테고리는 소비 프로젝트의 extension에서 자체 정의:
  ```ts
  // 예시 — extensions/url-shortener/cache-config.ts
  import { isCacheEnabled } from '@withwiz/toolkit/cache';
  import { ENV } from '@/lib/env';
  export const getDomainCacheConfig = {
    link: { enabled: () => ENV.CACHE.LINK.ENABLED && isCacheEnabled(),
            duration: () => ENV.CACHE.LINK.DURATION },
    // ...
  };
  ```
- `initializeCache({ categories })`에는 보편 카테고리만 전달하면 됩니다 (도메인 카테고리는 내부 ENV에서 자체 사용).
- `IQRCodeStats.aliasClicks`를 사용하던 코드는 `.clicks`로 변경.

## [0.4.0] - 2026-04-28

### Removed
- **BREAKING**: 도메인 특화 에러 코드/헬퍼/메시지를 패키지에서 제거. 본 패키지는 보편적 에러만 다루며, 확장 코드는 각 프로젝트/서비스의 extension 영역에서 처리합니다.
  - 코드 키 제거: `INVALID_ALIAS_FORMAT` (40008), `LINK_PASSWORD_REQUIRED` (40104), `LINK_PASSWORD_INCORRECT` (40105), `LINK_NOT_FOUND` (40403), `TAG_NOT_FOUND` (40408), `GROUP_NOT_FOUND` (40410), `ALIAS_ALREADY_EXISTS` (40907), `LINK_EXPIRED` (42204), `LINK_INACTIVE` (42205), `RESERVED_WORD_USED` (42208), `CANNOT_DELETE_OWN_ACCOUNT` (42210), `FAVORITE_NOT_FOUND` (40409), `ALREADY_FAVORITED` (42209)
  - `AppError` 헬퍼 제거: `invalidAlias`, `linkPasswordRequired`, `linkPasswordIncorrect`, `linkNotFound`, `tagNotFound`, `groupNotFound`, `aliasExists`, `linkExpired`, `linkInactive`, `reservedWord`, `cannotDeleteOwnAccount`, `favoriteNotFound`, `alreadyFavorited`
  - `ErrorResponse` 헬퍼 제거: 위 헬퍼 대응 항목 전부
  - i18n 메시지(`messages/en.ts`, `messages/ko.ts`, `friendly-messages.ts`)에서 해당 코드 항목 제거

### Migration
- 소비 프로젝트는 `AppError`를 직접 생성하거나, 자체 확장 클래스(예: `LinkAppError`)를 정의해 사용하세요.
- 보편 헬퍼(`notFound(message)`, `businessRule(message)`, `conflict(message)`, `unauthorized(message)`)로 대체 가능합니다.
- 예시: `throw AppError.linkNotFound()` → `throw LinkAppError.linkNotFound()` 또는 `throw AppError.notFound('Link not found')`

## [0.2.4] - 2026-03-28

### Added
- `classifyError()` 공통 에러 분류 함수 (`constants/error-codes.ts`)
  - DB, 네트워크, 캐시, 이메일, 파일업로드 등 패턴 기반 자동 분류
  - `AppError.from()`, `processError()`, 미들웨어에서 공유
- `AUTH_ERROR_CODE_MAP` — AuthError(JWT/OAuth/Password) → 5자리 에러코드 매핑
- `AppError.corsViolation()` 팩토리 메서드
- `ErrorResponse` 유틸리티에 누락된 팩토리 메서드 추가 (invalidInput, missingField, tagNotFound 등)
- `./error/messages` subpath export (package.json)
- `classifyError()` 및 AuthError 통합 테스트 29개

### Changed
- **BREAKING**: `LINK_PASSWORD_REQUIRED` 코드 42206→40104, `LINK_PASSWORD_INCORRECT` 코드 42207→40105 (422→401)
- `error-display.ts`: v1→v2 메시지 시스템으로 전환
- `error-display.ts`: `handleApiResponse()`에서 `throw new Error` → `throw new AppError`
- `JWTManager` 생성자: `throw new Error` → `throw new JWTError`
- `r2-storage.ts`: `throw new Error` → `AppError.serviceUnavailable()` (3곳)
- `AppError` 생성자에 5자리 코드 유효성 검증 추가 (10000~59999)
- `middleware/error-handler.ts`에서 AuthError를 `AUTH_ERROR_CODE_MAP` 기반으로 정밀 매핑
- 에러코드 번호 갭에 `Reserved:` 주석 문서화

### Fixed
- catch 블록에서 모든 에러가 500으로 뭉개지던 문제 — 식별 가능한 에러에 명시적 상태코드 사용
- JWTError/OAuthError가 500으로 fallback되던 문제
- `error-handler.ts`와 `middleware/error-handler.ts`에서 동일 AuthError의 응답 코드 불일치 수정
- `friendly-messages.ts` v1 deprecated 처리

## [0.1.1] - 2025-03-03

### Added
- New cache environment configuration module (`cache/cache-env.ts`)
- Batch processor for geolocation operations (`geolocation/batch-processor.ts`)
- Enhanced provider support for geolocation services
- Additional type exports for better TypeScript integration
- Comprehensive package.json exports for subpath imports

### Changed
- Updated package structure with additional entry points
- Improved cache manager factory pattern
- Enhanced error recovery mechanisms

### Fixed
- Cache invalidation edge cases
- Error handler response formatting

### Documentation
- Added test plan and progress tracking
- Enhanced README files in modules
- Improved API documentation

## [0.1.0] - 2025-02-XX

### Initial Release

#### Core Features
- **Authentication** (`auth/`)
  - JWT token management
  - Password hashing (bcryptjs)
  - OAuth2 support
  - Prisma adapter for user persistence
  - Email token generation

- **Caching** (`cache/`)
  - Multiple cache backends (In-memory, Redis, Hybrid, Noop)
  - Cache invalidation strategies
  - Factory pattern for cache manager selection
  - LRU cache with size limits

- **Error Handling** (`error/`)
  - Centralized error management
  - Recovery strategies (retry, circuit-breaker, degradation)
  - Multi-language error messages (EN, KO)
  - Error logging with Winston
  - Error display components for React

- **Geolocation** (`geolocation/`)
  - Multi-provider support (IP-API, ipapi.co, MaxMind, IPGeolocation)
  - Batch processing for bulk lookups
  - Geographic data aggregation

- **Utilities** (`utils/`)
  - Input sanitization
  - URL normalization
  - CSV export
  - IP utilities
  - Type guards
  - Timezone handling
  - Short code generation
  - QR code generation (client-side)

- **React Components** (`components/ui/`)
  - Data table with sorting and filtering
  - Pagination component
  - Badge, Button, Alert, Tooltip
  - Loading bar and skeletons
  - Timezone and domain displays
  - World map chart

- **React Hooks** (`hooks/`)
  - `useDataTable` - Table state management
  - `useDebounce` - Debounced values
  - `useExitIntent` - Detect user exit intent
  - `useTimezone` - Timezone detection

- **Next.js Middleware** (`middleware/`)
  - Authentication middleware
  - Rate limiting
  - CORS handling
  - Security headers
  - Request initialization
  - Error handling
  - Response logging
  - Middleware composition

- **Storage** (`storage/`)
  - Cloudflare R2 (S3-compatible) integration
  - File upload and retrieval

- **System Monitoring** (`system/`)
  - Health checks
  - CPU, Memory, Disk monitoring
  - Network diagnostics
  - Environment detection

- **Validators** (`validators/`)
  - Password strength validation

- **Logging** (`logger/`)
  - Winston-based structured logging

### Technical Details
- **TypeScript** v5 with strict mode
- **Build**: tsup (ESM) + tsc (type declarations)
- **Testing**: vitest with >80% coverage
- **Package**: Public npm package (@withwiz/toolkit)
- **Peer Dependencies**: Next.js 15, React 18+

---

## Release Guidelines

### Version Bumping
```bash
# Patch (0.1.1 -> 0.1.2)
npm version patch

# Minor (0.1.0 -> 0.2.0)
npm version minor

# Major (0.1.0 -> 1.0.0)
npm version major
```

### Pre-Release
```bash
# Alpha: 0.1.0-alpha.0
npm version prerelease --preid=alpha
```

### Publishing
```bash
npm publish
```
