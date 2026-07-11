# @withwiz/toolkit

**English** | [한국어](README.ko.md)

Shared utility library for [withwiz](https://github.com/greeun) projects — a collection of production-ready modules for authentication, caching, error handling, middleware, geolocation, logging, and more.

## Features

- **Composition root** — assemble every tier's configuration at once with a single `initialize()`
- **Framework tiers** — dependencies split across three tiers: `core` / `next` / `prisma` (0.8+)
- **API key** — framework/DB-agnostic API key core (generation with sha256-hashed storage, validation FSM, IP whitelist, plan limits, typed errors) over injectable ports, plus an x-api-key auth middleware and OpenAPI spec builder for Next.js (`next/oapi`)
- **Auth** — JWT, password hashing, OAuth helpers (Google / GitHub / Kakao / Microsoft / Meta), state-cookie CSRF binding, Prisma adapter
- **Cache** — Redis / in-memory / hybrid / noop backends, factory, invalidation, defaults
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

`next` / `react` / `react-dom` are **optional** peers — install only the peers required by the tiers you use.

```bash
# When using the next tier
# (React is also needed — next/error/ErrorBoundary is a React component)
npm install next react react-dom

# Backend / CLI using only the core tier
# (no extra peers required)
```

> **React components moved out (0.8).** The `react` tier (UI components, hooks,
> `error-display`) was extracted to [`@withwiz/ui`](https://github.com/greeun).
> Migrate by replacing `@withwiz/toolkit/react/*` → `@withwiz/ui/react/*`.

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

### Token delivery mode (tokenDelivery)

You can choose how authentication tokens are delivered at initialization time. The default is `'hybrid'` (cookie + header support, the legacy behavior).

```typescript
import { initialize } from '@withwiz/toolkit/initialize';

initialize({
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    tokenDelivery: 'cookie', // 'cookie' | 'header' | 'hybrid' (default)
  },
});
```

It can also be overridden per handler (precedence: option > global > `'hybrid'`):

```typescript
createAuthHandlers({ ...options, tokenDelivery: 'header' });
```

| Mode | Token location | Notes |
|---|---|---|
| `cookie` | HttpOnly cookie only | Token removed from the response body — minimal XSS exposure. Recommended for browser apps |
| `header` | `Authorization: Bearer` + body | Refresh is passed via the body `{ refreshToken }`. Client-side storage is relatively vulnerable to XSS — for non-browser clients |
| `hybrid` | Both | Legacy behavior. Cookie first, with header/body fallback |

**Constraint**: The OAuth callback is a redirect response, so it always delivers the token via cookie regardless of the mode. Apps that use OAuth should use `'cookie'` or `'hybrid'`.

## Module reference

Since 0.7, every subpath is split into tiers based on its framework dependencies
(`core` / `next` / `prisma` since 0.8 — the `react` tier moved to `@withwiz/ui`).
For the detailed tier model, rules, and migration mapping, see [`docs/FRAMEWORK_TIERS.md`](docs/FRAMEWORK_TIERS.md)
and the 0.7.0 / 0.8.0 entries in [`CHANGELOG.md`](CHANGELOG.md).

### Composition root

| Subpath | Description |
|---|---|
| `/initialize` | Unified entry point that assembles every tier's configuration into a single object |

### `core` — framework-independent (pure TS)

| Subpath | Description |
|---|---|
| `/core/api-key` | API key core barrel (service + generator + validate + ip-whitelist + errors) |
| `/core/api-key/api-key.service` | `ApiKeyService` — generate / validate / CRUD / regenerate over injected ports |
| `/core/api-key/errors` | `ApiKeyError`, `API_KEY_ERROR_CODES`, `isApiKeyError` structural guard |
| `/core/api-key/{types,ports,key-generator,ip-whitelist,validate}` | Pure types, DI ports, and helpers |
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

### `next` — depends on Next.js

| Subpath | Description |
|---|---|
| `/next/middleware` | Auth · rate-limit · CORS · security · wrappers |
| `/next/auth-handlers` | Route handlers (login / refresh / oauth callback / me) |
| `/next/auth-types` | Handler types (`NextRequest` signatures) |
| `/next/error` | `error-handler` (NextResponse), `LocaleDetector`, `ErrorBoundary` |
| `/next/oapi` | `createApiKeyAuth` (x-api-key auth middleware), OpenAPI 3.0.3 spec builder, pagination helpers |
| `/next/utils` | `api-helpers`, `cors`, `csv-export`, `error-processor` |

### `react` — moved to `@withwiz/ui` (0.8)

The React tier (UI components, hooks, `error-display`, browser-context utils) was
extracted to the standalone [`@withwiz/ui`](https://github.com/greeun) package.
Migrate imports: `@withwiz/toolkit/react/*` → `@withwiz/ui/react/*`.

### `prisma` — depends on Prisma

| Subpath | Description |
|---|---|
| `/prisma/auth-adapter` | Prisma implementations of `UserRepository` / `OAuthAccountRepository` / `EmailTokenRepository` |

## Requirements

- Node.js >= 18
- TypeScript >= 5

### Optional peers

`next` / `react` / `react-dom` are `optional` peer dependencies.
Install only the peers required by the tiers you use:

- Backend / CLI using only the `core` tier: no peers required
- `next` tier: Next.js >= 15, plus React >= 18 / React-DOM >= 18 (`next/error/ErrorBoundary` is a React component)
- `prisma` tier: a Prisma-compatible client (duck-typed)
- Some modules such as the Prisma adapter's `EmailTokenRepository`: `date-fns >= 3` (optional)
- Email delivery: `nodemailer >= 6` (optional)

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
