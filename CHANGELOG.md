# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
