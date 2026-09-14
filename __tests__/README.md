# @withwiz Tests

A standalone test suite for the `packages/@withwiz/toolkit` module.

## Overview

This test suite runs **completely independently** of the URL Shortener project.
Since `packages/@withwiz/toolkit` is a project-independent, general-purpose utility, it can be reused across other projects as well.

## Test Completion Status

### ✅ Completed Tests (2024-02-01)

| Module                   | Test File                      | Test Cases | Coverage |
| ------------------------ | ------------------------------ | ---------------- | -------- |
| **IP Utils**             | `ip-utils.test.ts`             | 50+              | ~100%    |
| **Sanitizer**            | `sanitizer.test.ts`            | 40+              | ~100%    |
| **Short Code Generator** | `short-code-generator.test.ts` | 35+              | ~100%    |
| **Password**             | `password.test.ts`             | 45+              | ~95%     |
| **Other Utils**          | `utils.test.ts`                | 30+              | ~90%     |
| **Validators**           | `validators.test.ts`           | 20+              | ~95%     |
| **Type Guards**          | `type-guards.test.ts`          | 15+              | ~95%     |
| **CSV Export**           | `csv-export.test.ts`           | 10+              | ~90%     |
| **Auth JWT**             | `auth-jwt.test.ts`             | 15+              | ~90%     |
| **AppError**             | `app-error.test.ts`            | 15+              | ~95%     |
| **Error Codes**          | `error-codes.test.ts`          | 10+              | ~100%    |
| **Validation Constants** | `validation-constants.test.ts` | 5+               | ~100%    |
| **Cache Integration**    | `cache.integration.test.ts`    | 20+              | ~90%     |

**Total test cases**: 310+

### ⏳ Planned Tests

- **OAuth**: Google/GitHub OAuth flows
- **Cache Managers**: InMemory, Hybrid, Noop
- **Geolocation**: Provider interface, Batch Processor
- **Logger**: Log levels, PII masking
- **System**: CPU/Memory/Disk metrics
- **Hooks**: useDebounce, useTimezone, useExitIntent, useDataTable
- **Error Recovery**: Circuit Breaker, Retry Logic

## Quick Start

### Run via npm scripts

Run from the project root:

```bash
# 🎯 Run all tests (unit + integration + category tests)
npm test

# 👀 Watch mode (auto re-run on file changes)
npm run test:watch

# 📊 Coverage report (v8 coverage)
npm run test:coverage

# 📦 Unit tests only (~265)
npm test -- __tests__/unit/

# 🔗 Specific category tests only
npm test -- __tests__/security/
npm test -- __tests__/performance/
npm test -- __tests__/accessibility/
```

### Run Vitest directly

```bash
# From the project root
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test a specific file only

```bash
npm test -- security/auth/auth-jwt.test.ts
npm test -- performance/cache/cache-advanced.test.ts
```

## Test Structure

### Organization by Type (Test Type)

**Unit Tests**: Verify the behavior of individual functions/classes
**Integration Tests**: Verify interactions between multiple modules

### Organization by Category (Test Category)

**Security**: Authentication, validation, and security tests
**Performance**: Cache and performance optimization tests
**Accessibility**: Accessibility and UI component tests
**Unit**: Remaining general unit tests

### Folder Structure

```
__tests__/
├── unit/                      # Unit tests (by module)
│   ├── error/
│   ├── geolocation/
│   ├── logger/
│   ├── middleware/
│   ├── system/
│   └── utils/
├── integration/               # Integration tests
│   └── cache.integration.test.ts
├── security/                  # Security category tests
│   ├── auth/
│   ├── utils/
│   └── validators/
├── performance/               # Performance category tests
│   └── cache/
└── accessibility/             # Accessibility category tests
    ├── components/
    └── hooks/
```

## Core Test Scenarios

### 1. IP Utils

- **IPv4/IPv6 validation**: Distinguishing valid/invalid IP addresses
- **Private IP detection**: 10.x.x.x, 192.168.x.x, 127.x.x.x, etc.
- **Client IP extraction**: Parsing Cloudflare headers, X-Forwarded-For
- **IP normalization**: IPv6 lowercase conversion

**Example**:

```typescript
expect(isValidIP("192.168.1.1")).toBe(true);
expect(isPrivateIP("10.0.0.1")).toBe(true);
expect(extractClientIp(headers)).toBe("1.2.3.4");
```

### 2. Sanitizer

- **XSS defense**: Removing `<script>`, `<img onerror>`
- **Event handlers**: Removing onclick, onerror
- **URL Sanitization**: Blocking javascript:, data:text/html
- **CSV Injection**: Handling =, +, -, @ prefixes

**Example**:

```typescript
expect(sanitizeHtml("<script>alert(1)</script>Hello")).toBe("Hello");
expect(sanitizeUrl("javascript:alert(1)")).toBe("");
```

### 3. Short Code Generator

- **Length validation**: Default 8 characters, custom length
- **Character set**: Uppercase/lowercase letters + digits only
- **Uniqueness**: 99% unique when generating 1,000 codes
- **Duplicate check**: checkDuplicate callback support
- **Performance**: 10,000 codes < 1 second

**Example**:

```typescript
const code = generateShortCode(8);
expect(code.length).toBe(8);
expect(code).toMatch(/^[A-Za-z0-9]+$/);

const unique = await generateUniqueShortCode({
  checkDuplicate: async (code) => db.exists(code),
});
```

### 4. Password Module

- **Password validation**: Length, upper/lowercase, digits, special characters
- **Strength calculation**: VERY_WEAK ~ VERY_STRONG (score 0-100)
- **Hashing**: bcrypt, salt randomness
- **Verification**: Timing attack defense
- **Zod schema**: Dynamic schema generation

**Example**:

```typescript
const validator = new PasswordValidator({
  minLength: 8,
  requireNumber: true,
  requireUppercase: true,
});

const result = validator.validate("Password123");
expect(result.isValid).toBe(true);
expect(result.strength).toBe(PasswordStrength.MEDIUM);

const hasher = new PasswordHasher();
const hash = await hasher.hash("myPassword");
const isValid = await hasher.verify("myPassword", hash);
expect(isValid).toBe(true);
```

## Test Writing Guidelines

### 1. Arrange-Act-Assert Pattern

```typescript
it("should validate IP address", () => {
  // Arrange
  const ip = "192.168.1.1";

  // Act
  const result = isValidIP(ip);

  // Assert
  expect(result).toBe(true);
});
```

### 2. Edge Cases Required

- Empty values: `null`, `undefined`, `''`, `[]`
- Boundary values: `0`, `-1`, `MAX_INT`
- Wrong types: `123`, `{}`, `[]`
- Abnormal input: `'not-an-ip'`, `'<script>'`

```typescript
it("should handle edge cases", () => {
  expect(isValidIP("")).toBe(false);
  expect(isValidIP(null as any)).toBe(false);
  expect(isValidIP(123 as any)).toBe(false);
});
```

### 3. Performance Tests

```typescript
it("should generate 10,000 codes in less than 1 second", () => {
  const start = Date.now();

  for (let i = 0; i < 10000; i++) {
    generateShortCode();
  }

  const duration = Date.now() - start;
  expect(duration).toBeLessThan(1000);
});
```

### 4. Security Tests

```typescript
it("should prevent XSS", () => {
  const xssAttempts = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    '<iframe src="javascript:alert(1)">',
  ];

  xssAttempts.forEach((xss) => {
    const result = sanitizeInput(xss);
    expect(result).not.toContain("alert");
    expect(result).not.toContain("javascript");
  });
});
```

## Mocking Strategy

### Mock external dependencies only

```typescript
// ❌ Bad: mocking internal functions
jest.mock("@withwiz/utils/ip-utils");

// ✅ Good: mocking external APIs
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ access_token: "token" }),
  }),
);
```

### Mock Reuse

```typescript
// __tests__/mocks/logger.ts
export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test @withwiz

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - run: cd packages/@withwiz/toolkit && npx jest --coverage --ci
      - uses: codecov/codecov-action@v3
        with:
          files: packages/@withwiz/toolkit/__tests__/coverage/lcov.info
```

## Coverage Thresholds

Coverage thresholds defined in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    lines: 80,
    branches: 75,
    functions: 85,
    statements: 80
  }
}
```

## Documentation

- **[test-classification.md](../docs/testing/test-classification.md)**: Test scenarios and cases per domain (SC-/TC- IDs)
- **[docs/scenarios/](docs/scenarios/)**, **[docs/testcases/](docs/testcases/)**: api-key module gap scenarios and test cases
- **[FALSE_POSITIVE_AUDIT.md](docs/FALSE_POSITIVE_AUDIT.md)**: False positive audit (2026-07-12)

## Troubleshooting

### When a test fails

1. **Run a single test**:

   ```bash
   npx jest -t "should validate IP address"
   ```

2. **Debug mode**:

   ```bash
   node --inspect-brk node_modules/.bin/jest --runInBand
   ```

3. **Log output**:
   ```typescript
   console.log("Debug:", result);
   ```

### When performance degrades

- `--maxWorkers=2`: Limit parallel execution workers
- `--no-cache`: Disable cache

### Timeout errors

```typescript
it("should handle async operation", async () => {
  // Default 5s → extend to 10s
  jest.setTimeout(10000);

  const result = await longRunningOperation();
  expect(result).toBeDefined();
}, 10000);
```

## Contribution Guide

When adding a new test:

1. **File location**: `__tests__/unit/{moduleName}.test.ts`
2. **describe block**: Group by module name
3. **it block**: Use the `should` pattern
4. **Edge cases**: Required
5. **Performance**: Add performance tests when needed

## Quick Reference Table

### npm Scripts Summary

| Command                            | Description                 | Test Count |
| ---------------------------------- | --------------------------- | --------- |
| `npm run test:withwiz:unit`        | Run unit tests only         | ~265      |
| `npm run test:withwiz:integration` | Run integration tests only  | ~6        |
| `npm run test:withwiz:all`         | Run all tests               | ~271      |
| `npm run test:withwiz:watch`       | Watch mode (detect changes) | Unit only |
| `npm run test:withwiz:coverage`    | Include coverage report     | All       |
| `npm run test:withwiz:verbose`     | Verbose output mode         | Unit only |

### Test Status of Key Modules

| Module         | File Name                | Test Count | Status |
| -------------- | ------------------------ | --------- | ---- |
| Utils          | `utils.test.ts`          | 131       | ✅   |
| Hooks          | `hooks.test.tsx`         | 38        | ✅   |
| Geolocation    | `geolocation.test.ts`    | 30        | ✅   |
| Cache Advanced | `cache-advanced.test.ts` | 30        | ✅   |
| Error Recovery | `error-recovery.test.ts` | 21        | ✅   |
| Logger         | `logger.test.ts`         | 15        | ✅   |

### Coverage Goals

- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: 100% coverage of core integration scenarios
- **Edge Cases**: Test all boundary conditions

## License

This test suite follows the project license.
