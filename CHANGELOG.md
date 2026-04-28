# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
