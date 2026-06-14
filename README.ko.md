# @withwiz/toolkit

[English](README.md) | **한국어**

Shared utility library for [withwiz](https://github.com/greeun) projects — 인증, 캐싱, 에러 처리, 미들웨어, 지오로케이션, 로깅 등 프로덕션 수준의 모듈 모음.

## Features

- **Composition root** — 단일 `initialize()`로 모든 티어 설정을 한 번에 조립
- **Framework tiers** — `core` / `next` / `prisma` 3개 티어로 의존성 분리 (0.8+)
- **Auth** — JWT, password hashing, OAuth helpers (Google / GitHub / Kakao / Microsoft / Meta), state-cookie CSRF 바인딩, Prisma adapter
- **Cache** — Redis / in-memory / hybrid / noop 백엔드, factory, invalidation, defaults
- **Constants** — Error codes, messages, pagination, security constants
- **Error** — Typed `AppError`, framework-aware error handler (core · next)
- **Geolocation** — GeoIP lookup, batch processing, provider factory
- **Logger** — Winston-based structured logger with daily rotation
- **Middleware** — Auth, rate-limiting, CORS, security middleware wrappers (Next.js)
- **Storage** — Cloudflare R2 (AWS S3-compatible) storage
- **System** — Health check, system monitoring
- **Types** — Shared TypeScript types (API, DB, env, GeoIP, user, i18n, QR)
- **Utils** — Sanitizer, type-guards, CSV export, URL normalizer, timezone, IP utils, ...
- **Validators** — Password strength validator

## Installation

```bash
npm install @withwiz/toolkit
# or
pnpm add @withwiz/toolkit
# or
yarn add @withwiz/toolkit
```

### Peer dependencies (optional)

`next` / `react` / `react-dom` 은 **optional** peer입니다 — 사용하는 티어가 요구하는 peer만 설치하세요.

```bash
# next 티어를 쓸 때
# (React 도 필요 — next/error/ErrorBoundary 가 React 컴포넌트)
npm install next react react-dom

# core 티어만 쓰는 백엔드 / CLI
# (별도 peer 설치 불필요)
```

> **React 컴포넌트 분리 (0.8).** `react` 티어(UI 컴포넌트, hooks, `error-display`)는
> 독립 패키지 [`@withwiz/ui`](https://github.com/greeun) 로 추출되었습니다.
> `@withwiz/toolkit/react/*` → `@withwiz/ui/react/*` 로 import 경로를 치환하세요.

## Quick start

```ts
// Auth — JWT
import { signToken, verifyToken } from '@withwiz/toolkit/core/auth/jwt'

const token = await signToken({ userId: 'u_123' })
const payload = await verifyToken(token)
```

```ts
// Cache — Redis wrapper
import { withCache } from '@withwiz/toolkit/core/cache'

const data = await withCache('my-key', async () => fetchData(), 3600)
```

```ts
// Error — typed error class
import { AppError } from '@withwiz/toolkit/core/error'

throw new AppError('NOT_FOUND', 'Resource not found', 404)
```

```ts
// Logger
import { logInfo, logError } from '@withwiz/toolkit/core/logger/logger'

logInfo('Server started', { port: 3000 })
logError('Something went wrong', { error })
```

```ts
// Geolocation
import { getGeoLocation } from '@withwiz/toolkit/core/geolocation'

const geo = await getGeoLocation('8.8.8.8')
// { country: 'US', city: 'Mountain View', ... }
```

```ts
// Utils
import { sanitizeInput } from '@withwiz/toolkit/core/utils/sanitizer'
import { formatNumber }  from '@withwiz/toolkit/core/utils/format-number'
import { normalizeUrl }  from '@withwiz/toolkit/core/utils/url-normalizer'
```

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

## Module reference

0.7부터 모든 subpath는 프레임워크 의존성에 따라 티어로 분리됩니다
(0.8부터 `core` / `next` / `prisma` 3개 — `react` 티어는 `@withwiz/ui` 로 이동).
자세한 티어 모델·규칙·마이그레이션 매핑은 [`docs/FRAMEWORK_TIERS.md`](docs/FRAMEWORK_TIERS.md)
및 [`CHANGELOG.md`](CHANGELOG.md) 의 0.7.0 / 0.8.0 항목을 참조하세요.

### Composition root

| Subpath | Description |
|---|---|
| `/initialize` | 모든 티어 설정을 단일 객체로 조립하는 통합 진입점 |

### `core` — 프레임워크 독립 (pure TS)

| Subpath | Description |
|---|---|
| `/core/auth` | Full auth (JWT + password + OAuth + services + email + types) |
| `/core/auth/jwt` | JWT sign / verify |
| `/core/auth/password` | bcrypt helpers |
| `/core/auth/oauth` | OAuth utilities (Google / GitHub / Kakao / Microsoft / Meta) |
| `/core/auth/oauth/providers/{google,github,kakao,microsoft,meta}` | Individual OAuth providers |
| `/core/auth/services` | Login / token-refresh / oauth-callback services |
| `/core/auth/email` | Email token generation |
| `/core/auth/types` | Framework-independent auth types |
| `/core/cache` | Cache facade (get / set / delete / withCache) |
| `/core/cache/cache-factory` | Cache backend factory (Redis / in-memory / hybrid / noop) |
| `/core/cache/cache-invalidation` | Pattern-based cache invalidation |
| `/core/config` | Config registry |
| `/core/constants/{error-codes,messages,pagination,security}` | Shared constants |
| `/core/cors` | Framework-independent CORS config |
| `/core/error` | `AppError`, error codes, i18n messages, `extractErrorInfo` |
| `/core/geolocation` | GeoIP lookup, batch processor, provider factory |
| `/core/logger/logger` | Winston-based structured logger |
| `/core/storage` | Cloudflare R2 / S3-compatible storage |
| `/core/system` | Health check, system monitoring |
| `/core/types/{api,database,env,geoip,i18n,qr-code,user}` | Shared TypeScript types |
| `/core/utils` | `sanitizer`, `type-guards`, `format-number`, `ip-utils`, `timezone`, ... |
| `/core/validators` | Password strength validator |

### `next` — Next.js 의존

| Subpath | Description |
|---|---|
| `/next/middleware` | Auth · rate-limit · CORS · security · wrappers |
| `/next/auth-handlers` | Route handlers (login / refresh / oauth callback / me) |
| `/next/auth-types` | Handler types (`NextRequest` signatures) |
| `/next/error` | `error-handler` (NextResponse), `LocaleDetector`, `ErrorBoundary` |
| `/next/utils` | `api-helpers`, `cors`, `csv-export`, `error-processor` |

### `react` — `@withwiz/ui` 로 이동 (0.8)

React 티어(UI 컴포넌트, hooks, `error-display`, 브라우저 컨텍스트 utils)는 독립 패키지
[`@withwiz/ui`](https://github.com/greeun) 로 추출되었습니다.
import 경로 치환: `@withwiz/toolkit/react/*` → `@withwiz/ui/react/*`.

### `prisma` — Prisma 의존

| Subpath | Description |
|---|---|
| `/prisma/auth-adapter` | `UserRepository` / `OAuthAccountRepository` / `EmailTokenRepository` Prisma 구현체 |

## Requirements

- Node.js >= 18
- TypeScript >= 5

### Optional peers

`next` / `react` / `react-dom` 은 `optional` peer dependency입니다.
사용하는 티어가 요구하는 peer만 설치하세요:

- `core` 티어만 쓰는 백엔드 / CLI: peer 불필요
- `next` 티어: Next.js >= 15, 그리고 React >= 18 / React-DOM >= 18 (`next/error/ErrorBoundary` 가 React 컴포넌트)
- `prisma` 티어: Prisma 호환 클라이언트 (덕 타이핑)
- Prisma 어댑터의 `EmailTokenRepository` 등 일부 모듈: `date-fns >= 3` (optional)
- 이메일 전송: `nodemailer >= 6` (optional)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## License

MIT © [withwiz](https://github.com/greeun)
