# Framework Tiers (0.8+)

`@withwiz/toolkit` 0.7부터 모든 모듈은 프레임워크 의존성에 따라 티어로
분리됩니다. 소비자는 실제로 쓰는 티어만 임포트하므로 불필요한 프레임워크
의존성을 끌어오지 않습니다.

> **0.8 변경**: `react` 티어(UI 컴포넌트·hooks·`error-display`·브라우저 utils)는
> 독립 패키지 [`@withwiz/ui`](https://github.com/greeun) 로 추출되어 toolkit 에서
> 제거되었습니다. 현재 toolkit 은 `core` / `next` / `prisma` 3개 티어입니다.

## 티어 모델

```
core/   ← 의존성 없음, pure TypeScript
  ↑
  ├─ next     Next.js 의존 (core 사용 가능)
  └─ prisma   Prisma 어댑터 (core 사용 가능)
```

## 규칙

- `core`는 **어떤 프레임워크도 import 하지 않는다** (zero framework dependency).
- `next` / `prisma`는 **`core`만 import 할 수 있다**.
- `next` / `prisma`는 **서로 import 할 수 없다**.
- 예외: `@withwiz/toolkit/initialize`는 composition root로, 모든 티어를 조립한다.

## 티어별 모듈

| 티어 | 대표 subpath | 비고 |
|---|---|---|
| **core** | `core/api-key`, `core/auth`, `core/auth/jwt`, `core/auth/password`, `core/auth/oauth`, `core/auth/services`, `core/auth/email`, `core/auth/types`, `core/cache`, `core/config`, `core/constants`, `core/cors`, `core/error`, `core/geolocation`, `core/logger/logger`, `core/storage`, `core/system`, `core/types/*`, `core/utils`, `core/validators` | pure TS. 프레임워크 미설치 환경에서도 동작 |
| **next** | `next/middleware`, `next/auth-handlers`, `next/auth-types`, `next/error`, `next/error/error-handler`, `next/oapi`, `next/utils` | `next/server`, `next/link` 등 Next.js 의존 |
| **prisma** | `prisma/auth-adapter` | Prisma 클라이언트 덕 타이핑 어댑터 |

`error`와 `utils`는 의존성에 따라 티어가 갈립니다:

- `core/error` — `AppError`, 에러 코드, 다국어 메시지, `extractErrorInfo` (pure)
- `next/error` — `error-handler`(NextResponse), `LocaleDetector`(NextRequest), `ErrorBoundary`(React 컴포넌트)
- `core/utils` — `sanitizer`, `type-guards`, `format-number`, `ip-utils` 등 pure 유틸
- `next/utils` — `api-helpers`, `cors`, `csv-export`, `error-processor` (NextResponse)

`api-key`도 같은 원리로 갈립니다:

- `core/api-key` — `ApiKeyService`(repo/cache/planConfig/usage 전부 ports DI), 순수
  key-generator·validate FSM·ip-whitelist, typed error(`ApiKeyError`). DB·프레임워크 무관.
- `next/oapi` — `createApiKeyAuth`(x-api-key 인증, NextResponse), OpenAPI 스펙 빌더,
  pagination helpers. `core/api-key` 위에서만 동작.

(`react/error` 의 `error-display`, `react/utils` 의 `client-utils`·`qr-code` 는 0.8 에서 `@withwiz/ui` 로 이동했습니다.)

## peerDependenciesMeta

`next` / `react` / `react-dom`는 `optional` peer dependency입니다.
`core` 티어만 사용하는 소비자(예: 백엔드 서비스, CLI)는 React/Next.js를
설치하지 않아도 설치 경고가 발생하지 않습니다.
`next` 티어는 Next.js 와 함께 React/React-DOM 도 필요합니다 — `next/error/ErrorBoundary`
가 React 컴포넌트이기 때문입니다.

## 0.7 → 0.8 마이그레이션 (react 추출)

0.8 에서 `react` 티어 전체가 독립 패키지 [`@withwiz/ui`](https://github.com/greeun) 로
이동했습니다. export 는 동일한 `react/*` 네임스페이스를 미러하므로 prefix 만 치환하면 됩니다.

| 구 (≤0.7) | 신 (0.8+) |
|---|---|
| `@withwiz/toolkit/react/components/ui/*` | `@withwiz/ui/react/components/ui/*` |
| `@withwiz/toolkit/react/hooks/*` | `@withwiz/ui/react/hooks/*` |
| `@withwiz/toolkit/react/error/error-display` | `@withwiz/ui/react/error/error-display` |
| `@withwiz/toolkit/react/utils/*` | `@withwiz/ui/react/utils/*` |

```bash
# 일괄 prefix 치환 (macOS sed)
grep -rl '@withwiz/toolkit/react' src | xargs sed -i '' 's|@withwiz/toolkit/react|@withwiz/ui/react|g'
```

`@withwiz/ui` 를 의존성에 추가하세요. toolkit 의 다른 티어(`core`/`next`/`prisma`)는 영향 없습니다.

## 0.6 → 0.7 마이그레이션

0.7은 hard cut입니다 — 구 subpath(`@withwiz/toolkit/utils` 등)에 대한
alias를 제공하지 않습니다. 임포트 경로를 일괄 치환해야 합니다.

> 아래 표의 `react/*` 대상은 0.8 에서 다시 `@withwiz/ui/react/*` 로 이동했습니다
> (위 0.7 → 0.8 마이그레이션 참조). 0.6 에서 곧장 0.8 로 올린다면 두 단계를 합쳐 치환하세요.

대표 매핑:

| 구 (≤0.6) | 신 (0.7+) |
|---|---|
| `@withwiz/toolkit/auth` | `@withwiz/toolkit/core/auth` |
| `@withwiz/toolkit/auth/core/jwt` | `@withwiz/toolkit/core/auth/jwt` |
| `@withwiz/toolkit/auth/handlers` | `@withwiz/toolkit/next/auth-handlers` |
| `@withwiz/toolkit/auth/adapters/prisma` | `@withwiz/toolkit/prisma/auth-adapter` |
| `@withwiz/toolkit/cache` | `@withwiz/toolkit/core/cache` |
| `@withwiz/toolkit/components/ui/*` | `@withwiz/toolkit/react/components/ui/*` |
| `@withwiz/toolkit/hooks/*` | `@withwiz/toolkit/react/hooks/*` |
| `@withwiz/toolkit/middleware` | `@withwiz/toolkit/next/middleware` |
| `@withwiz/toolkit/middleware/cors-config` | `@withwiz/toolkit/core/cors` |
| `@withwiz/toolkit/error` | `@withwiz/toolkit/core/error` (+ `next/error`, `react/error`) |
| `@withwiz/toolkit/error/error-handler` | `@withwiz/toolkit/next/error/error-handler` |
| `@withwiz/toolkit/error/error-display` | `@withwiz/toolkit/react/error/error-display` |
| `@withwiz/toolkit/utils` | `@withwiz/toolkit/core/utils` (+ `next/utils`, `react/utils`) |
| `@withwiz/toolkit/utils/api-helpers` | `@withwiz/toolkit/next/utils/api-helpers` |
| `@withwiz/toolkit/utils/client/*` | `@withwiz/toolkit/react/utils/*` |
| `@withwiz/toolkit/{constants,config,logger,storage,system,types,geolocation,validators}/*` | `@withwiz/toolkit/core/{...}/*` |

### barrel 분할 주의

`error`와 `utils` barrel이 티어별로 분할되었으므로, 한 import 문에서 여러
티어 심볼을 함께 꺼내쓰던 코드는 **티어별로 분리**해야 합니다:

```ts
// 구 (한 줄)
import { AppError, errorHandlerMiddleware } from '@withwiz/toolkit/error';
import { sanitize, withErrorHandling } from '@withwiz/toolkit/utils';

// 신 (티어별 분리)
import { AppError } from '@withwiz/toolkit/core/error';
import { errorHandlerMiddleware } from '@withwiz/toolkit/next/error';
import { sanitize } from '@withwiz/toolkit/core/utils';
import { withErrorHandling } from '@withwiz/toolkit/next/utils';
```

일괄 치환 sed 패턴은 `CHANGELOG.md` [0.7.0] 항목을 참조하세요.
