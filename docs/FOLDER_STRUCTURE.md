# 폴더 구조 표준 가이드

@withwiz/toolkit의 폴더 구조는 **npm 패키지 표준**과 **TDD(Test-Driven Development)** 원칙을 따릅니다.

## 프로젝트 구조 개요

```
withwiz-toolkit/
├── src/                    # 소스 코드 (TypeScript)
├── __tests__/              # 테스트 파일 (vitest)
├── dist/                   # 빌드 출력 (ESM + types)
├── docs/                   # 문서
├── .github/                # GitHub 템플릿
├── .gitignore              # Git 무시 패턴
├── LICENSE                 # MIT 라이센스
├── README.md               # 프로젝트 개요
├── CONTRIBUTING.md         # 기여 가이드
├── CHANGELOG.md            # 버전 히스토리
├── package.json            # 패키지 메타데이터
├── vitest.config.ts        # 테스트 설정
├── tsconfig.json           # TypeScript 설정
└── tsup.config.ts          # 빌드 설정
```

## src/ 디렉토리 구조 (소스 코드)

소스 코드는 **기능별(feature-based)** 모듈 구조를 따릅니다:

```
src/
├── auth/                      # 인증 시스템
│   ├── core/                  # 핵심 로직
│   │   ├── jwt/               # JWT 토큰 처리
│   │   ├── password/          # 비밀번호 해싱
│   │   ├── oauth/             # OAuth 2.0
│   │   └── email/             # 이메일 토큰
│   ├── adapters/              # 데이터베이스 어댑터
│   │   └── prisma/            # Prisma ORM
│   ├── types/                 # 타입 정의
│   ├── errors/                # 에러 클래스
│   ├── index.ts               # 공개 API
│   └── README.md              # 모듈 문서
├── cache/                     # 캐싱 시스템
│   ├── inmemory-cache-manager.ts
│   ├── redis-cache-manager.ts
│   ├── hybrid-cache-manager.ts
│   ├── noop-cache-manager.ts
│   ├── cache-factory.ts       # 팩토리 패턴
│   ├── cache-config.ts
│   ├── cache-env.ts
│   ├── cache-defaults.ts
│   ├── cache-invalidation.ts
│   ├── cache-types.ts
│   ├── cache-wrapper.ts
│   ├── cache.ts
│   └── index.ts
├── error/                     # 에러 처리
│   ├── core/                  # 핵심 에러 클래스
│   ├── messages/              # 다국어 메시지
│   ├── recovery/              # 복구 전략
│   ├── logging/               # 에러 로깅
│   ├── components/            # React 컴포넌트
│   ├── hooks/                 # React hooks
│   ├── app-error.ts
│   ├── error-handler.ts
│   ├── ErrorBoundary.tsx
│   └── index.ts
├── geolocation/               # 지리정보 조회
│   ├── providers/             # 다중 제공자
│   ├── batch-processor.ts     # 배치 처리
│   └── index.ts
├── middleware/                # Next.js 미들웨어
│   ├── auth.ts
│   ├── rate-limit.ts
│   ├── cors.ts
│   ├── security.ts
│   ├── error-handler.ts
│   └── index.ts
├── utils/                     # 유틸리티
│   ├── client/                # 클라이언트 전용
│   ├── sanitizer.ts           # 입력 검증
│   ├── url-normalizer.ts
│   ├── csv-export.ts
│   ├── ip-utils.ts
│   ├── timezone.ts
│   └── index.ts
├── components/                # React 컴포넌트
│   ├── ui/                    # UI 컴포넌트
│   │   ├── Button.tsx
│   │   ├── Table.tsx
│   │   ├── Badge.tsx
│   │   └── ...
│   └── index.ts
├── hooks/                     # React hooks
│   ├── useDataTable.ts
│   ├── useDebounce.ts
│   ├── useExitIntent.ts
│   └── useTimezone.ts
├── types/                     # 전역 타입 정의
│   ├── api.ts
│   ├── database.ts
│   ├── env.ts
│   ├── user.ts
│   └── index.ts
├── validators/                # 검증 함수
│   ├── password-validator.ts
│   └── index.ts
├── constants/                 # 상수
│   ├── error-codes.ts
│   ├── messages.ts
│   ├── pagination.ts
│   ├── security.ts
│   └── index.ts
├── logger/                    # Winston 로거
│   └── logger.ts
├── storage/                   # 스토리지 (S3, R2)
│   └── r2-storage.ts
├── system/                    # 시스템 모니터링
│   ├── health-check.ts
│   ├── cpu.ts
│   ├── memory.ts
│   ├── disk.ts
│   ├── network.ts
│   └── index.ts
└── index.ts                   # 루트 export (사용하지 않음, subpath 사용)
```

## __tests__/ 디렉토리 구조 (테스트)

**TDD 원칙**: 테스트 구조는 `src/` 구조를 **정확히 미러링**합니다.

```
__tests__/
├── unit/                      # 단위 테스트 (src 구조 미러링)
│   ├── auth/                  # src/auth/ 테스트
│   │   ├── auth-jwt.test.ts
│   │   ├── oauth.test.ts
│   │   ├── password.test.ts
│   │   └── oauth-prompt-parameter.test.ts
│   ├── cache/                 # src/cache/ 테스트
│   │   ├── cache-managers.test.ts
│   │   ├── cache-limit-lru.test.ts
│   │   ├── cache-advanced.test.ts
│   │   └── redis-delete-pattern-scan.test.ts
│   ├── error/                 # src/error/ 테스트
│   │   ├── app-error.test.ts
│   │   ├── error-recovery.test.ts
│   │   └── error-codes.test.ts
│   ├── utils/                 # src/utils/ 테스트
│   │   ├── utils.test.ts
│   │   ├── sanitizer.test.ts
│   │   ├── short-code-generator.test.ts
│   │   ├── ip-utils.test.ts
│   │   ├── type-guards.test.ts
│   │   └── csv-export.test.ts
│   ├── validators/            # src/validators/ 테스트
│   │   ├── validators.test.ts
│   │   └── validation-constants.test.ts
│   ├── geolocation/           # src/geolocation/ 테스트
│   │   └── geolocation.test.ts
│   ├── middleware/            # src/middleware/ 테스트
│   │   ├── optional-auth-middleware.test.ts
│   │   └── rate-limit-is-enabled.test.ts
│   ├── hooks/                 # src/hooks/ 테스트 (jsdom)
│   │   └── hooks.test.tsx
│   ├── components/            # src/components/ 테스트 (jsdom)
│   │   └── client-utils.test.ts
│   └── logger/                # src/logger/ 테스트
│       └── logger.test.ts
├── integration/               # 통합 테스트
│   └── cache.integration.test.ts
├── docs/                      # 테스트 문서
│   ├── TEST_PLAN.md           # 테스트 계획
│   ├── TEST_SCENARIOS.md      # 테스트 시나리오
│   └── PROGRESS.md            # 진행 상황
├── setup.ts                   # 전역 테스트 설정
└── README.md                  # 테스트 가이드
```

### 테스트 환경 설정

`vitest.config.ts`에서 두 가지 환경으로 테스트를 분리합니다:

| 환경 | 포함 파일 | 용도 |
|------|---------|------|
| **jsdom** | `hooks/**/*.test.tsx`, `components/**/*.test.tsx`, `**/client*.test.tsx` | React Hook, Component 테스트 |
| **node** | 나머지 모든 테스트 | 로직, 유틸리티, API 테스트 |

## 명명 규칙 (Naming Conventions)

### TypeScript 파일
- **PascalCase**: 클래스, 컴포넌트 (`User.ts`, `Button.tsx`)
- **camelCase**: 함수, 유틸리티 (`validatePassword.ts`, `formatDate.ts`)
- **kebab-case**: 파일 이름이 여러 단어일 때 (`cache-manager.ts`, `error-handler.ts`)

### 테스트 파일
- **`<module>.test.ts`**: 일반 테스트
- **`<module>.test.tsx`**: React 컴포넌트/Hook 테스트
- 폴더는 src의 해당 모듈과 동일한 이름

### 색인 파일
- **`index.ts`**: 모듈의 공개 API 정의
- 각 모듈의 최상단에 위치

## 공개 API (Exports)

### package.json subpath exports
```json
{
  "exports": {
    "./auth": "./dist/auth/index.js",
    "./cache": "./dist/cache/index.js",
    "./utils/sanitizer": "./dist/utils/sanitizer.js",
    "./components/ui/Button": "./dist/components/ui/Button.js"
  }
}
```

### 사용 예시
```typescript
// ✅ 올바른 사용
import { createJWT } from '@withwiz/toolkit/auth/core/jwt'
import { InMemoryCacheManager } from '@withwiz/toolkit/cache'
import { Button } from '@withwiz/toolkit/components/ui/Button'

// ❌ 직접 import 금지
import { createJWT } from '@withwiz/toolkit/src/auth/core/jwt'
```

## 폴더 생성 체크리스트

새로운 모듈을 추가할 때:

- [ ] `src/<module>/` 폴더 생성
- [ ] 구조화된 서브폴더 생성 (core, types, adapters 등)
- [ ] `src/<module>/index.ts` 작성 (공개 API)
- [ ] `src/<module>/README.md` 작성 (모듈 문서)
- [ ] `__tests__/unit/<module>/` 폴더 생성
- [ ] `__tests__/unit/<module>/<feature>.test.ts` 테스트 파일 작성
- [ ] package.json에 exports 항목 추가
- [ ] vitest.config.ts에 필요하면 환경 설정 추가

## .gitignore 가이드

다음 항목은 자동 생성되므로 git에서 제외됩니다:

```
node_modules/       # npm 의존성
dist/               # 빌드 출력
coverage/           # 테스트 커버리지
__tests__/coverage/ # 커버리지 리포트
.serena/            # 개발 도구 캐시
```

## 참고 자료

- [TDD Best Practices](https://en.wikipedia.org/wiki/Test-driven_development)
- [npm Package Conventions](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
