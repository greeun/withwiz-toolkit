# @withwiz 테스트

`packages/@withwiz/toolkit` 모듈의 독립적인 테스트 스위트입니다.

## 개요

이 테스트 스위트는 URL Shortener 프로젝트와 **완전히 독립적**으로 실행됩니다.
`packages/@withwiz/toolkit`는 프로젝트 독립적인 범용 유틸리티이므로, 다른 프로젝트에서도 재사용 가능합니다.

## 테스트 완료 현황

### ✅ 완료된 테스트 (2024-02-01)

| 모듈                     | 테스트 파일                    | 테스트 케이스 수 | 커버리지 |
| ------------------------ | ------------------------------ | ---------------- | -------- |
| **IP Utils**             | `ip-utils.test.ts`             | 50+              | ~100%    |
| **Sanitizer**            | `sanitizer.test.ts`            | 40+              | ~100%    |
| **Short Code Generator** | `short-code-generator.test.ts` | 35+              | ~100%    |
| **Password**             | `password.test.ts`             | 45+              | ~95%     |
| **기타 Utils**           | `utils.test.ts`                | 30+              | ~90%     |
| **Validators**           | `validators.test.ts`           | 20+              | ~95%     |
| **Type Guards**          | `type-guards.test.ts`          | 15+              | ~95%     |
| **CSV Export**           | `csv-export.test.ts`           | 10+              | ~90%     |
| **Auth JWT**             | `auth-jwt.test.ts`             | 15+              | ~90%     |
| **AppError**             | `app-error.test.ts`            | 15+              | ~95%     |
| **Error Codes**          | `error-codes.test.ts`          | 10+              | ~100%    |
| **Validation Constants** | `validation-constants.test.ts` | 5+               | ~100%    |
| **Cache Integration**    | `cache.integration.test.ts`    | 20+              | ~90%     |

**총 테스트 케이스**: 310+ 개

### ⏳ 예정된 테스트

- **OAuth**: Google/GitHub OAuth 흐름
- **Cache Managers**: InMemory, Hybrid, Noop
- **Geolocation**: Provider 인터페이스, Batch Processor
- **Logger**: 로그 레벨, PII 마스킹
- **System**: CPU/Memory/Disk 메트릭
- **Hooks**: useDebounce, useTimezone, useExitIntent, useDataTable
- **Error Recovery**: Circuit Breaker, Retry Logic

## 빠른 시작

### npm 스크립트로 실행

프로젝트 루트에서 실행:

```bash
# 🎯 전체 테스트 실행 (unit + integration + category tests)
npm test

# 👀 Watch 모드 (파일 변경 시 자동 재실행)
npm run test:watch

# 📊 Coverage 리포트 (v8 coverage)
npm run test:coverage

# 📦 Unit 테스트만 (약 265개)
npm test -- __tests__/unit/

# 🔗 특정 카테고리 테스트만
npm test -- __tests__/security/
npm test -- __tests__/performance/
npm test -- __tests__/accessibility/
```

### Vitest 직접 실행

```bash
# 프로젝트 루트에서
npm test

# Watch 모드
npm run test:watch

# 커버리지 리포트
npm run test:coverage
```

### 특정 파일만 테스트

```bash
npm test -- security/auth/auth-jwt.test.ts
npm test -- performance/cache/cache-advanced.test.ts
```

## 테스트 구조

### 타입별 조직 (Test Type)

**Unit Tests**: 개별 함수/클래스의 동작을 검증
**Integration Tests**: 여러 모듈 간 상호작용을 검증

### 카테고리별 조직 (Test Category)

**Security**: 인증, 검증, 보안 테스트
**Performance**: 캐시, 성능 최적화 테스트
**Accessibility**: 접근성, UI 컴포넌트 테스트
**Unit**: 나머지 일반 단위 테스트

### 폴더 구조

```
__tests__/
├── unit/                      # Unit tests (모듈별)
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

## 핵심 테스트 시나리오

### 1. IP Utils

- **IPv4/IPv6 검증**: 유효한/무효한 IP 주소 판별
- **Private IP 판별**: 10.x.x.x, 192.168.x.x, 127.x.x.x 등
- **클라이언트 IP 추출**: Cloudflare 헤더, X-Forwarded-For 파싱
- **IP 정규화**: IPv6 소문자 변환

**예시**:

```typescript
expect(isValidIP("192.168.1.1")).toBe(true);
expect(isPrivateIP("10.0.0.1")).toBe(true);
expect(extractClientIp(headers)).toBe("1.2.3.4");
```

### 2. Sanitizer

- **XSS 방어**: `<script>`, `<img onerror>` 제거
- **이벤트 핸들러**: onclick, onerror 제거
- **URL Sanitization**: javascript:, data:text/html 차단
- **CSV Injection**: =, +, -, @ 접두사 처리

**예시**:

```typescript
expect(sanitizeHtml("<script>alert(1)</script>Hello")).toBe("Hello");
expect(sanitizeUrl("javascript:alert(1)")).toBe("");
```

### 3. Short Code Generator

- **길이 검증**: 기본 8자, 커스텀 길이
- **문자 집합**: 알파벳 대소문자 + 숫자만
- **고유성**: 1,000개 생성 시 99% 고유
- **중복 검사**: checkDuplicate 콜백 지원
- **성능**: 10,000개 < 1초

**예시**:

```typescript
const code = generateShortCode(8);
expect(code.length).toBe(8);
expect(code).toMatch(/^[A-Za-z0-9]+$/);

const unique = await generateUniqueShortCode({
  checkDuplicate: async (code) => db.exists(code),
});
```

### 4. Password Module

- **비밀번호 검증**: 길이, 대소문자, 숫자, 특수문자
- **강도 계산**: VERY_WEAK ~ VERY_STRONG (점수 0-100)
- **해싱**: bcrypt, salt 랜덤성
- **검증**: 타이밍 공격 방어
- **Zod 스키마**: 동적 스키마 생성

**예시**:

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

## 테스트 작성 가이드라인

### 1. Arrange-Act-Assert 패턴

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

### 2. Edge Cases 필수

- 빈 값: `null`, `undefined`, `''`, `[]`
- 경계 값: `0`, `-1`, `MAX_INT`
- 잘못된 타입: `123`, `{}`, `[]`
- 비정상 입력: `'not-an-ip'`, `'<script>'`

```typescript
it("should handle edge cases", () => {
  expect(isValidIP("")).toBe(false);
  expect(isValidIP(null as any)).toBe(false);
  expect(isValidIP(123 as any)).toBe(false);
});
```

### 3. 성능 테스트

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

### 4. 보안 테스트

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

## 모킹 전략

### 외부 의존성만 모킹

```typescript
// ❌ 나쁨: 내부 함수 모킹
jest.mock("@withwiz/utils/ip-utils");

// ✅ 좋음: 외부 API 모킹
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ access_token: "token" }),
  }),
);
```

### Mock 재사용

```typescript
// __tests__/mocks/logger.ts
export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
```

## CI/CD 통합

### GitHub Actions 예시

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

## 커버리지 임계값

`jest.config.js`에 정의된 커버리지 임계값:

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

## 문서

- **[TEST_PLAN.md](docs/TEST_PLAN.md)**: 전체 테스트 계획 및 전략
- **[TEST_SCENARIOS.md](docs/TEST_SCENARIOS.md)**: 모듈별 상세 시나리오

## 문제 해결

### 테스트 실패 시

1. **단일 테스트 실행**:

   ```bash
   npx jest -t "should validate IP address"
   ```

2. **디버그 모드**:

   ```bash
   node --inspect-brk node_modules/.bin/jest --runInBand
   ```

3. **로그 출력**:
   ```typescript
   console.log("Debug:", result);
   ```

### 성능 저하 시

- `--maxWorkers=2`: 병렬 실행 워커 제한
- `--no-cache`: 캐시 비활성화

### 타임아웃 에러

```typescript
it("should handle async operation", async () => {
  // 기본 5초 → 10초로 연장
  jest.setTimeout(10000);

  const result = await longRunningOperation();
  expect(result).toBeDefined();
}, 10000);
```

## 기여 가이드

새로운 테스트 추가 시:

1. **파일 위치**: `__tests__/unit/{모듈명}.test.ts`
2. **describe 블록**: 모듈명으로 그룹화
3. **it 블록**: `should` 패턴 사용
4. **Edge cases**: 필수 포함
5. **성능**: 필요 시 성능 테스트 추가

## 빠른 참조 테이블

### npm 스크립트 요약

| 명령어                             | 설명                        | 테스트 수 |
| ---------------------------------- | --------------------------- | --------- |
| `npm run test:withwiz:unit`        | Unit 테스트만 실행          | ~265개    |
| `npm run test:withwiz:integration` | Integration 테스트만 실행   | ~6개      |
| `npm run test:withwiz:all`         | 전체 테스트 실행            | ~271개    |
| `npm run test:withwiz:watch`       | Watch 모드 (파일 변경 감지) | Unit만    |
| `npm run test:withwiz:coverage`    | Coverage 리포트 포함        | 전체      |
| `npm run test:withwiz:verbose`     | 상세 출력 모드              | Unit만    |

### 주요 모듈 테스트 현황

| 모듈           | 파일명                   | 테스트 수 | 상태 |
| -------------- | ------------------------ | --------- | ---- |
| Utils          | `utils.test.ts`          | 131       | ✅   |
| Hooks          | `hooks.test.tsx`         | 38        | ✅   |
| Geolocation    | `geolocation.test.ts`    | 30        | ✅   |
| Cache Advanced | `cache-advanced.test.ts` | 30        | ✅   |
| Error Recovery | `error-recovery.test.ts` | 21        | ✅   |
| Logger         | `logger.test.ts`         | 15        | ✅   |

### 커버리지 목표

- **Unit Tests**: 90%+ 코드 커버리지
- **Integration Tests**: 핵심 통합 시나리오 100% 커버
- **Edge Cases**: 모든 경계 조건 테스트

## 라이선스

이 테스트 스위트는 프로젝트 라이선스를 따릅니다.
