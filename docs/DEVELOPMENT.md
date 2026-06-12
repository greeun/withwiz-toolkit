# Development

Test organization and common development task recipes. Core commands and test
setup (env vars, framework, coverage target) live in
[`../CLAUDE.md`](../CLAUDE.md).

## Test Organization

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
