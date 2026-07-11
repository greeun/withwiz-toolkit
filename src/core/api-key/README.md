# API Key Module (core tier)

**Package**: `@withwiz/toolkit` v0.10+
**Tier**: `core` — framework- and DB-independent (pure TypeScript)
**Status**: ✅ Production ready

## Overview

`@withwiz/toolkit/core/api-key` is an API-key issuing/validation core with **zero
framework and zero database dependency**. All I/O goes through injectable ports
(hexagonal architecture), so it runs against any DB (Prisma, raw SQL, …) and any
cache backend the consumer wires in.

### Its Place in the Tier Model

```
core/api-key   ← here (service · key-generator · validate FSM · ip-whitelist · typed errors)
  ↑
  └─ next/oapi   x-api-key auth middleware + OpenAPI spec builder  → @withwiz/toolkit/next/oapi
```

## Subpaths

| Subpath | Contents |
|---|---|
| `core/api-key` | Barrel (everything below) |
| `core/api-key/api-key.service` | `ApiKeyService` — generate / validate / CRUD / regenerate / track-usage |
| `core/api-key/errors` | `ApiKeyError`, `API_KEY_ERROR_CODES`, `isApiKeyError` |
| `core/api-key/ports` | DI ports: `IApiKeyRepository`, `IApiKeyCacheStore`, `IPlanConfigProvider`, `IUsageTracker`, `ApiKeyServiceEnv` |
| `core/api-key/types` | Pure types (`CreateApiKeyOptions`, `ApiKeyValidationResult`, …) |
| `core/api-key/key-generator` | `generateRawKey` / `hashKey` / `keyPreview` (pure) |
| `core/api-key/ip-whitelist` | Single-IP + IPv4 CIDR matching (pure, invalid input = no match) |
| `core/api-key/validate` | `validateApiKeyRecord` FSM (pure) |

## Wiring

Implement the ports against your stack and construct the service:

```typescript
import { ApiKeyService } from '@withwiz/toolkit/core/api-key';

const service = new ApiKeyService({
  repo,        // IApiKeyRepository       — your DB adapter
  cache,       // IApiKeyCacheStore       — validation-result cache (e.g. over core/cache)
  planConfig,  // IPlanConfigProvider     — per-plan key limit + rate limit
  usage,       // IUsageTracker           — daily/monthly usage gate
  env: {
    prefixProd: 'sk_live_',
    prefixDev: 'sk_test_',
    defaultExpiryDays: 365,
    restrictedPlans: ['FREEMIUM'],   // plans that cannot issue/use API keys
  },
});
```

`plan` is a plain `string` everywhere — the core does not depend on any plan enum.

## Key Lifecycle

```typescript
// Issue — the raw key is returned ONCE and stored only as a sha256 hash
const result = await service.generateApiKey(userId, {
  name: 'ci-bot',
  permissions: ['read'],
  environment: 'production',   // 'production' | 'development' → prefix
}, plan);
result.key;   // 'sk_live_…' — show it to the user now; it cannot be recovered

// Validate (hot path — returns a result, never throws for invalid keys)
const v = await service.validateApiKey(rawKey);
if (!v.valid) v.error;   // 'INVALID_API_KEY' | 'INACTIVE_API_KEY' | 'EXPIRED_API_KEY'
                         // | 'INACTIVE_USER' | 'PLAN_RESTRICTED'

// Rotate
await service.regenerateApiKey(userId, apiKeyId, plan);
```

### Semantics worth knowing

- **Hashing**: keys are 32 random bytes (hex) behind an environment prefix and are
  stored as an unsalted sha256 hash — appropriate for high-entropy secrets
  (bcrypt/argon2 are for low-entropy passwords). The raw key never touches storage.
- **Rotation at the plan limit** (0.12+): regenerating an **active** key without
  `keepOldKeyActive` is a net-zero change and is allowed even at the plan's key
  limit. Regenerating an inactive key, or rotating with `keepOldKeyActive: true`,
  is a net +1 and enforces the limit.
- **No partial failure on regenerate** (0.12+): the restricted-plan check runs
  *before* the old key is deactivated, so a regenerate under a restricted plan
  (e.g. after a downgrade) cannot leave the user keyless.
- **Cache is an optimization layer** (0.12+): in `validateApiKey`, cache-store
  failures (read / write / expired-entry eviction) are treated as a cache miss —
  a cache outage does not fail authentication while the repository is healthy.
  Cache invalidation on `updateApiKey` / `deleteApiKey` / rotation **does**
  propagate failures, so a revoke is never silently skipped.
- **Stale-auth guard**: a cache hit still re-checks natural expiry (`expiresAt`),
  so an expired key cannot ride out the cache TTL.

## Typed Errors

Management operations (CRUD / generate / regenerate) throw `ApiKeyError` with a
stable `code`; branch on the code, **not** on message strings:

| Code | Thrown when |
|---|---|
| `API_KEY_NOT_FOUND` | Target key does not exist |
| `API_KEY_OWNERSHIP` | Caller is not the owner (admin bypasses) |
| `API_KEY_PLAN_RESTRICTED` | Issuing attempted on a restricted plan |
| `API_KEY_LIMIT_REACHED` | Plan's active-key limit exceeded |

```typescript
import { isApiKeyError, API_KEY_ERROR_CODES } from '@withwiz/toolkit/core/api-key/errors';

try {
  await service.deleteApiKey(id, userId);
} catch (e) {
  if (isApiKeyError(e, API_KEY_ERROR_CODES.NOT_FOUND) ||
      isApiKeyError(e, API_KEY_ERROR_CODES.OWNERSHIP)) {
    // Collapse both into one response at the HTTP boundary to hide
    // resource existence from non-owners (IDOR defense). Admin-facing
    // layers may keep them distinct.
    return notFoundResponse();
  }
  throw e;
}
```

- `isApiKeyError` checks `name` + `code` **structurally** (not `instanceof`), so it
  keeps working across duplicated package installations.
- HTTP status mapping is deliberately the consumer's job — the core never assumes HTTP.
- The hot-path `validateApiKey` reports failures as **result codes**
  (`ApiKeyValidationResult.error`), not exceptions. The two vocabularies are
  intentionally separate: results for expected validation outcomes, throws for
  management-operation faults.

## Next.js Middleware (`next/oapi`)

```typescript
import { createApiKeyAuth } from '@withwiz/toolkit/next/oapi';

const auth = createApiKeyAuth({
  service,                      // Pick<ApiKeyService, 'validateApiKey' | 'trackUsage'>
  usage,                        // IUsageTracker
  extractClientIp: (h) => h.get('x-real-ip') ?? '',
  resolveRole: async (userId) => fetchRole(userId),   // re-fetch from DB, don't trust tokens
});

export async function GET(req: NextRequest) {
  const r = await auth(req);
  if ('response' in r) return r.response;   // 401 / 403 / 500 already built
  r.user;                                    // { id, email, role, plan, apiKeyId }
}
```

The middleware checks, in order: `x-api-key` header presence → key validity →
IP whitelist (`isIpAllowed`, single IP + CIDR) → usage limits. Usage-check
*infrastructure failures* fail open (availability first); usage-limit *exceeded*
fails closed. `buildOpenApiSpec` injects the matching `X-API-Key` securityScheme
into an OpenAPI 3.0.3 skeleton.
