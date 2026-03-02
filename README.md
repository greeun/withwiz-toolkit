# @withwiz/toolkit

Shared utility library for [withwiz](https://github.com/greeun) projects — a collection of production-ready modules for authentication, caching, error handling, middleware, geolocation, logging, and more.

## Features

- **Auth** — JWT, password hashing, OAuth helpers, Prisma adapter
- **Cache** — Redis-backed caching with factory, invalidation, and defaults
- **Constants** — Error codes, messages, pagination, security constants
- **Error** — Typed `AppError`, centralized error handler and display
- **Geolocation** — GeoIP lookup, batch processing, provider factory
- **Hooks** — `useDataTable`, `useDebounce`, `useExitIntent`, `useTimezone`
- **Logger** — Winston-based structured logger with daily rotation
- **Middleware** — Auth, rate-limiting, CORS, security middleware wrappers
- **Storage** — Cloudflare R2 (AWS S3-compatible) storage
- **System** — Health check endpoint
- **Types** — Shared TypeScript types (API, DB, env, GeoIP, user, i18n, QR)
- **Utils** — Sanitizer, validators, CSV export, URL normalizer, timezone, IP utils, and more
- **Validators** — Password strength validator

## Installation

```bash
npm install @withwiz/toolkit
# or
pnpm add @withwiz/toolkit
# or
yarn add @withwiz/toolkit
```

### Peer dependencies

```bash
npm install next react react-dom
```

## Quick start

```ts
// Auth — JWT
import { signToken, verifyToken } from '@withwiz/toolkit/auth/core/jwt'

const token = await signToken({ userId: 'u_123' })
const payload = await verifyToken(token)
```

```ts
// Cache — Redis wrapper
import { withCache } from '@withwiz/toolkit/cache'

const data = await withCache('my-key', async () => fetchData(), 3600)
```

```ts
// Error — typed error class
import { AppError } from '@withwiz/toolkit/error'

throw new AppError('NOT_FOUND', 'Resource not found', 404)
```

```ts
// Logger
import { logInfo, logError } from '@withwiz/toolkit/logger/logger'

logInfo('Server started', { port: 3000 })
logError('Something went wrong', { error })
```

```ts
// Geolocation
import { getGeoLocation } from '@withwiz/toolkit/geolocation'

const geo = await getGeoLocation('8.8.8.8')
// { country: 'US', city: 'Mountain View', ... }
```

```tsx
// Hooks (React)
import { useDebounce } from '@withwiz/toolkit/hooks/useDebounce'

const debouncedQuery = useDebounce(query, 300)
```

```ts
// Utils
import { sanitizeInput } from '@withwiz/toolkit/utils/sanitizer'
import { formatNumber }  from '@withwiz/toolkit/utils/format-number'
import { normalizeUrl }  from '@withwiz/toolkit/utils/url-normalizer'
```

## Module reference

| Subpath | Description |
|---|---|
| `/auth` | Full auth module (JWT + password + OAuth + Prisma adapter) |
| `/auth/core/jwt` | JWT sign / verify |
| `/auth/core/password` | bcrypt helpers |
| `/auth/core/oauth` | OAuth utilities |
| `/auth/adapters/prisma` | Prisma-based session adapter |
| `/cache` | Redis cache (get / set / delete / withCache) |
| `/cache/cache-factory` | Cache factory for multiple backends |
| `/cache/cache-invalidation` | Pattern-based cache invalidation |
| `/constants` | All shared constants |
| `/constants/error-codes` | Application error codes |
| `/constants/messages` | Shared user-facing messages |
| `/constants/pagination` | Default pagination settings |
| `/constants/security` | Security-related constants |
| `/error` | AppError, error handler, error display |
| `/geolocation` | GeoIP lookup & batch processor |
| `/hooks/useDataTable` | Table state management hook |
| `/hooks/useDebounce` | Debounce hook |
| `/hooks/useExitIntent` | Exit intent detection hook |
| `/hooks/useTimezone` | Timezone detection hook |
| `/logger/logger` | Structured Winston logger |
| `/middleware` | Next.js middleware helpers |
| `/middleware/auth` | Auth middleware |
| `/middleware/rate-limit` | Rate limiting middleware |
| `/middleware/cors` | CORS middleware |
| `/middleware/security` | Security headers middleware |
| `/storage` | Cloudflare R2 / S3 storage client |
| `/system/health-check` | Health check handler |
| `/types/api` | API response types |
| `/types/database` | Database entity types |
| `/types/env` | Environment variable types |
| `/types/user` | User types |
| `/types/geoip` | GeoIP types |
| `/utils` | All utility functions |
| `/utils/sanitizer` | Input sanitization |
| `/utils/url-normalizer` | URL normalization |
| `/utils/timezone` | Timezone formatting helpers |
| `/utils/csv-export` | CSV export helper |
| `/validators/password-validator` | Password strength validator |

## Requirements

- Node.js >= 18
- Next.js >= 14
- React >= 18
- TypeScript >= 5

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
