# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@withwiz/toolkit** is a shared utility library for withwiz projects — an npm package (published as public, non-private) that provides production-ready modules for authentication, caching, error handling, middleware, logging, geolocation, and more.

- **Language**: TypeScript 5 with strict mode
- **Runtime**: Node.js >= 18 with ESM-only output
- **Peer Dependencies**: Next.js >= 15, React >= 18
- **Distributed**: Published to npm registry

## Build System & Architecture

### Build Pipeline

The project uses a two-stage build:

1. **JavaScript (tsup)**: Compiles each source file individually to preserve subpath exports structure
   ```bash
   npm run build:js    # tsup only
   npm run build       # tsup + tsc --emitDeclarationOnly
   npm run build:types # tsc declarations only
   ```

2. **Type Declarations (tsc)**: Generates `.d.ts` files with `--emitDeclarationOnly`
   - All external dependencies are marked as `external` in tsup to avoid bundling
   - Output preserves directory structure: `dist/auth/index.js`, `dist/cache/index.js`, etc.
   - TypeScript strict mode enforced

### Package Exports

The package uses conditional exports in `package.json`:

```
exports:
  ./auth → dist/auth/index.js (and 7 subpaths for jwt, password, oauth, adapters)
  ./cache → dist/cache/index.js (and 4 subpaths for factory, invalidation, defaults, env)
  ./components/ui/* → dist/components/ui/*.js
  ./constants → dist/constants/index.js (with 4 subpaths)
  ./error → dist/error/index.js (and 2 subpaths)
  ./geolocation → (and 2 subpaths)
  ./hooks/* → Individual hooks as separate exports
  ./logger/logger → dist/logger/logger.js
  ./middleware → (and 4 middleware-specific subpaths)
  ./storage → dist/storage/r2-storage.js
  ./system → (and 1 subpath)
  ./types/* → Multiple type subpaths (api, database, env, geoip, user, i18n, qr-code)
  ./utils → (and 15+ utility subpaths)
  ./validators → dist/validators/index.js
```

**Pattern**: Public APIs are exported through `index.ts` files; internal helpers live in `core/` subdirectories.

## Module Structure

```
src/
├── auth/              # JWT, password hashing, OAuth, Prisma adapter
│   ├── core/
│   │   ├── jwt/
│   │   ├── password/
│   │   └── oauth/
│   ├── adapters/prisma/
│   └── types/
├── cache/             # Redis + in-memory caching with factory
│   └── core/
├── components/ui/     # React components (Button, Table, Badge, etc.)
├── constants/         # Error codes, messages, pagination, security
├── error/             # AppError class, handlers, display utilities
├── geolocation/       # GeoIP lookup, batch processor, provider factory
├── hooks/             # React hooks (useDataTable, useDebounce, etc.)
├── logger/            # Winston-based structured logging
├── middleware/        # Next.js middleware (auth, rate-limit, cors, security)
├── storage/           # Cloudflare R2 / S3 storage
├── system/            # Health checks, system monitoring
├── types/             # Shared TypeScript types
├── utils/             # ~20 utility modules (sanitizer, validators, etc.)
└── validators/        # Password strength validation
```

## Testing

### Commands

```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report (v8)
npm run test:unit    # Unit tests only
npm run test:integration # Integration tests only
```

### Test Setup

- **Framework**: Vitest (jsdom environment)
- **Coverage Target**: >80% across all modules
- **Setup File**: `__tests__/setup.ts` (configures TextEncoder, crypto polyfills for jose library)
- **Environment Variables** (test defaults):
  - `NODE_ENV=test`
  - `CACHE_ENABLED=false`
  - `CACHE_INMEMORY_ENABLED=true` (in-memory cache for tests)

### Test Organization

Tests are organized by type and category:

```
__tests__/
├── unit/                          # Unit tests by module
│   ├── auth/
│   ├── cache/
│   ├── components/
│   ├── error/
│   ├── geolocation/
│   ├── hooks/
│   ├── logger/
│   ├── middleware/
│   ├── system/
│   ├── utils/
│   └── validators/
├── integration/                   # Integration tests
│   └── cache.integration.test.ts
├── security/                      # Security-focused tests
│   ├── auth/
│   ├── utils/ (sanitizer)
│   └── validators/
├── performance/                   # Performance tests
│   └── cache/
├── accessibility/                 # Accessibility tests
│   ├── components/
│   └── hooks/
└── docs/                          # Test documentation
```

**Naming**: `<module>.test.ts` or `.test.tsx` for React components

**TDD Approach**: Write tests before implementation. Use meaningful descriptions focusing on behavior, not implementation.

Example:
```typescript
describe('PasswordValidator', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('short')
    expect(result.isValid).toBe(false)
  })
})
```

## Key Architectural Decisions

### 1. Subpath Exports (Tree-Shaking)

Every module is granularly exported to allow consumers to import only what they need:
- ✅ `import { signToken } from '@withwiz/toolkit/auth/core/jwt'` (small bundle)
- ❌ Avoid: `import * from '@withwiz/toolkit'` (imports everything)

### 2. Factory Pattern for Extensibility

- **Cache**: `CacheFactory` supports Redis, in-memory, hybrid, and noop backends (see `cache-factory.ts`)
- **Geolocation**: `ProviderFactory` for multiple GeoIP providers

### 3. Error Handling

- `AppError` class with typed error codes (from `constants/error-codes.ts`)
- Example: `throw new AppError('NOT_FOUND', 'User not found', 404)`
- Error codes should be added to constants before throwing

### 4. Middleware Pattern

Middleware functions wrap Next.js handler functions:
```typescript
import { withAuth, withRateLimit } from '@withwiz/toolkit/middleware'

export default withAuth(withRateLimit(handler))
```

### 5. Logger Integration

Winston-based structured logging with daily rotation:
```typescript
import { logInfo, logError } from '@withwiz/toolkit/logger/logger'
logError('Failed to fetch', { error, userId, context: 'payment' })
```

## Common Development Tasks

### Running a Single Test

```bash
npm test -- __tests__/unit/error/app-error.test.ts
# or watch mode
npm run test:watch -- app-error.test.ts
```

### Running Tests for a Category

```bash
npm test -- __tests__/security/
npm test -- __tests__/performance/
npm test -- __tests__/accessibility/
```

### Debugging Tests

```bash
npm run test:watch -- --inspect-brk
# Then use Chrome DevTools: chrome://inspect
```

### Building Locally

```bash
npm run build        # Full build (JS + types)
npm run build:js     # Only JS (tsup)
npm run build:types  # Only types (tsc)
```

### Checking Type Coverage

TypeScript strict mode is enforced. Run tsc to catch type errors:
```bash
npm run build:types
```

## Communication Guidelines

### Language
- **모든 답변은 한글(Korean)로 작성**: Claude Code는 이 프로젝트의 모든 응답을 한국어로 제공합니다.
- 기술 용어나 고유명사는 원문 유지 (예: JWT, Redis, TypeScript, npm)
- 파일 경로와 코드는 변경하지 않음

---

## Conventions & Patterns

### TypeScript

- **Strict Mode**: Always enabled. No `any` types without explicit justification.
- **Branded Types**: Use for sensitive data (IDs, tokens):
  ```typescript
  type UserId = string & { readonly __brand: 'UserId' }
  ```
- **Index Files**: Use `src/module/index.ts` to export public API. Re-export only public symbols.
- **Internal Utils**: Place in `core/` subdirectory to signal internal usage.

### Module Exports

Each module should have:
1. `index.ts` — exports public API
2. `core/` (optional) — internal implementations
3. Typed exports in `package.json` for each subpath

Example (`src/auth/index.ts`):
```typescript
// ✅ Public API
export * from './core/jwt'
export * from './core/password'
export * from './core/oauth'

// ❌ Don't export internals
// export * from './core/jwt/helpers'
```

### Testing

- Test files are organized by **type** (`unit/`, `integration/`) and **category** (`security/`, `performance/`, `accessibility/`)
- Unit tests mirror source structure: `src/auth/index.ts` → `__tests__/unit/auth/index.test.ts`
- Category tests group related tests by concern (security/auth, performance/cache, etc.)
- Use `vitest` globals (no imports needed for `describe`, `it`, `expect`)
- Mock external dependencies (Redis, API calls, file I/O)
- Focus on behavior and API contracts, not implementation details

### Commit Messages

Follow conventional commit format:
```
feat: Add JWT refresh token support
fix: Resolve cache invalidation on multiple patterns
docs: Update geolocation provider documentation
test: Add tests for rate limiting middleware
chore: Update dependencies
```

## Git Workflow

- **Main Branch**: `main` (stable, for releases)
- **Development Branch**: `develop` (active development, branch target for PRs)
- **Feature Branches**: `feature/your-feature` from `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
# ... make changes ...
git push origin feature/my-feature
# Create PR against develop (not main)
```

## CI/CD & Pre-commit Checks

Before committing, ensure:
1. ✅ Tests pass: `npm test`
2. ✅ Types compile: `npm run build:types`
3. ✅ Code builds: `npm run build:js`
4. ✅ Coverage maintained (aim for >80%)

## Version Management

- Current version: Check `package.json` → `"version"`
- Follows semantic versioning: `MAJOR.MINOR.PATCH`
- When releasing, update `CHANGELOG.md` and version in `package.json`

## Important Notes

### Dependencies

- **Peer Dependencies** (must be installed by consumers):
  - `next >= 15`
  - `react >= 18`
  - `react-dom >= 18`

- **Core Dependencies**: pinned in `package.json`:
  - `jose` (JWT), `bcryptjs` (password hashing), `zod` (validation)
  - `@upstash/redis` (Redis client), `@aws-sdk/client-s3` (S3/R2)
  - `winston` (logging), date-fns, clsx, tailwind-merge

### External Dependencies in tsup.config.ts

All major dependencies are marked `external` to avoid bundling. This ensures:
- Smaller package size
- Consumers use their own versions
- Compatibility with peer dependencies

### Known Compatibility

- `jose` library requires `TextEncoder`/`TextDecoder` polyfills in jsdom (handled in test setup)
- Middleware requires Next.js context (works with Next.js >= 14)

## Resources

- **README.md**: Quick start examples and module reference
- **CONTRIBUTING.md**: Detailed contribution guidelines
- **CHANGELOG.md**: Release notes and breaking changes
- **docs/**: Additional documentation and architecture diagrams
