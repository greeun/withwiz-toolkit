# Module Structure

Source is organized by framework tier. Tier rules and the per-tier module table
live in [`FRAMEWORK_TIERS.md`](./FRAMEWORK_TIERS.md); this file is the annotated
source-directory layout.

```
src/
├── initialize.ts      # composition root (root-level, assembles all tiers)
│
├── core/              # zero framework dependency (pure TS)
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
│   └── utils/         #   api-helpers, cors, csv-export, error-processor
│
├── react/             # React dependent
│   ├── components/ui/ #   Button, Table, Badge, DataTable, etc.
│   ├── hooks/         #   useDataTable, useDebounce, useExitIntent, useTimezone
│   ├── error/         #   error-display (sonner toast)
│   └── utils/         #   client-utils, qr-code (browser context)
│
└── prisma/            # Prisma dependent
    └── auth-adapter/  #   Prisma auth repository adapter
```

## Package Exports

The full export map is defined in `package.json` `exports` (the source of
truth). Every subpath is namespaced under a framework tier (`core` / `next` /
`react` / `prisma`) — see [`FRAMEWORK_TIERS.md`](./FRAMEWORK_TIERS.md) for the
tier breakdown.

- `./initialize` → `dist/initialize.js` (composition root, all tiers)
- `./core/*` — zero framework dependency (pure TS)
- `./next/*` — Next.js dependent
- `./react/*` — React dependent
- `./prisma/*` — Prisma adapter

**Pattern**: public APIs are exported through `index.ts` files; internal helpers
live in `core/` subdirectories of each module.
