# Module Structure

Source is organized by framework tier. Tier rules and the per-tier module table
live in [`FRAMEWORK_TIERS.md`](./FRAMEWORK_TIERS.md); this file is the annotated
source-directory layout.

```
src/
├── initialize.ts      # composition root (root-level, assembles all tiers)
│
├── core/              # zero framework dependency (pure TS)
│   ├── api-key/       #   ApiKeyService(ports DI), key-generator, validate FSM,
│   │                  #   ip-whitelist, typed errors (ApiKeyError)
│   ├── auth/          #   jwt, password, oauth, services, email, types, config
│   ├── cache/         #   Redis + in-memory caching with factory
│   ├── config/        #   config registry (common, errors, warn)
│   ├── constants/     #   error codes, messages, pagination, security
│   ├── cors/          #   pure CORS config (← old middleware/cors-config)
│   ├── error/         #   AppError, error codes, i18n messages, extractErrorInfo
│   ├── geolocation/   #   GeoIP lookup, batch processor, provider factory
│   ├── logger/        #   Winston-based structured logging
│   ├── storage/       #   Cloudflare R2 / S3 storage
│   ├── system/        #   health checks, system monitoring
│   ├── types/         #   shared TypeScript types
│   ├── utils/         #   pure utils (sanitizer, type-guards, format-number, …)
│   └── validators/    #   password strength validation
│
├── next/              # Next.js dependent
│   ├── middleware/    #   auth, rate-limit, cors, security, wrappers
│   ├── auth-handlers/ #   Next.js route handlers (← old auth/handlers)
│   ├── auth-types/    #   handler types (NextRequest signatures)
│   ├── error/         #   error-handler (NextResponse), LocaleDetector, ErrorBoundary
│   ├── oapi/          #   x-api-key 인증 미들웨어(createApiKeyAuth), OpenAPI 스펙 빌더,
│   │                  #   pagination helpers (core/api-key 위에서 동작)
│   └── utils/         #   api-helpers, cors, csv-export, error-processor
│
└── prisma/            # Prisma dependent
    └── auth-adapter/  #   Prisma auth repository adapter
```

> The `react` tier (UI components, hooks, `error-display`, browser-context utils)
> was extracted to [`@withwiz/ui`](https://github.com/greeun) in 0.8 and removed
> from this package. Migrate `@withwiz/toolkit/react/*` → `@withwiz/ui/react/*`.

## Package Exports

The full export map is defined in `package.json` `exports` (the source of
truth). Every subpath is namespaced under a framework tier (`core` / `next` /
`prisma`) — see [`FRAMEWORK_TIERS.md`](./FRAMEWORK_TIERS.md) for the
tier breakdown.

- `./initialize` → `dist/initialize.js` (composition root, all tiers)
- `./core/*` — zero framework dependency (pure TS)
  - `@withwiz/toolkit/core/auth/adapters/sql` — raw SQL(pg/mysql2) 어댑터, Repository 3종
  - `@withwiz/toolkit/core/api-key` — barrel. 개별 subpath: `types` / `errors` /
    `ports` / `key-generator` / `ip-whitelist` / `validate` / `api-key.service`
- `./next/*` — Next.js dependent
  - `@withwiz/toolkit/next/oapi` — barrel. 개별 subpath: `api-key-auth` /
    `openapi-spec` / `helpers`
- `./prisma/*` — Prisma adapter

## 에러 설계 규칙 (api-key 기준 레퍼런스)

- **`core/error`의 `AppError`**: HTTP status 를 내장한 앱 통합 에러 (5자리 XXXYY 코드).
  HTTP 경계(route handler, middleware)에서 사용.
- **도메인 typed error** (`core/api-key/errors`의 `ApiKeyError` 등): core 계층은
  HTTP 를 전제하지 않으므로 도메인 코드만 담는다. HTTP status 매핑은 소비자
  경계 책임 (예: NOT_FOUND/OWNERSHIP 을 단일 응답으로 합쳐 IDOR 방어).
  판별은 `instanceof` 대신 구조 검사 가드(`isApiKeyError`) — 패키지 중복 설치 대응.
- **결과 코드 vs throw 코드**: 핫패스 검증(`validate` FSM)은 result 값으로 실패
  코드를 반환하고(`ApiKeyValidationError`), 관리 연산(CRUD)의 예외 상황만
  throw 한다(`API_KEY_ERROR_CODES`). 두 어휘는 의도적으로 분리되어 있다.

**Pattern**: public APIs are exported through `index.ts` files; internal helpers
live in `core/` subdirectories of each module.
