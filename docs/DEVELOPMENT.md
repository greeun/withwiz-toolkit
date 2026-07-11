# Development

Test organization and common development task recipes. Core commands and test
setup (env vars, framework, coverage target) live in
[`../CLAUDE.md`](../CLAUDE.md).

## Test Organization

Tests are organized by type and category:

```
__tests__/
├── unit/                          # Unit tests by module
│   ├── api-key/
│   ├── auth/
│   ├── cache/
│   ├── config/
│   ├── error/
│   ├── geolocation/
│   ├── logger/
│   ├── middleware/
│   ├── oapi/
│   ├── storage/
│   ├── system/
│   ├── utils/
│   ├── initialize.test.ts
│   └── proxy.test.ts
├── integration/                   # Integration tests (port wiring, flows)
│   ├── api-key/
│   └── cache.integration.test.ts
├── security/                      # Security-focused tests
│   ├── api-key/
│   ├── auth/
│   ├── error/
│   ├── utils/ (sanitizer)
│   └── validators/
├── performance/                   # Performance tests
│   ├── api-key/
│   └── cache/
├── chaos/                         # Port-fault injection (deps throwing/failing)
├── build/                         # Built-dist consumer-runtime checks
└── docs/                          # Test documentation, scenarios, testcases
```

> The `components/` / `hooks/` / `accessibility/` test dirs moved to
> `@withwiz/ui` together with the `react` tier in 0.8.

**Naming**: `<module>.test.ts`

Unit tests mirror source structure: `src/core/auth/index.ts` →
`__tests__/unit/auth/index.test.ts` (test dirs are not tier-prefixed). Category
tests group related tests by concern (security/auth, performance/cache, etc.).

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
npm test -- __tests__/chaos/
npm test -- __tests__/build/     # requires a fresh `npm run build` first
```

### Debugging Tests

```bash
npm run test:watch -- --inspect-brk
# Then use Chrome DevTools: chrome://inspect
```

### Building Locally

```bash
npm run build        # Full build (JS + types) — use this for anything consumed from dist
npm run build:js     # Only JS (tsup)
npm run build:types  # Only types (tsc)
```

> **Build-order trap**: tsup runs with `clean: true`, so running `build:types`
> **and then** `build:js` wipes the freshly emitted `.d.ts` files from `dist`.
> The `build` script runs them in the safe order (tsup first, then tsc).
> Before publishing (or running `__tests__/build/`), always use `npm run build`.

### Checking Type Coverage

TypeScript strict mode is enforced. Run tsc to catch type errors:
```bash
npm run build:types
```
