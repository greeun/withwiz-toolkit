# API Key 모듈 (core 티어)

**패키지**: `@withwiz/toolkit` v0.10+
**티어**: `core` — 프레임워크·DB 무관 (pure TypeScript)
**상태**: ✅ Production ready

## 개요

`@withwiz/toolkit/core/api-key`는 **프레임워크·DB 의존성이 없는** API 키
발급/검증 코어입니다. 모든 I/O는 주입 가능한 ports(헥사고날 아키텍처)를
통하므로, 소비자가 연결하는 어떤 DB(Prisma, raw SQL, …)·캐시 백엔드에서도
동작합니다.

### 티어 모델에서의 위치

```
core/api-key   ← 여기 (service · key-generator · validate FSM · ip-whitelist · typed errors)
  ↑
  └─ next/oapi   x-api-key 인증 미들웨어 + OpenAPI 스펙 빌더  → @withwiz/toolkit/next/oapi
```

## Subpath

| Subpath | 내용 |
|---|---|
| `core/api-key` | barrel (아래 전부) |
| `core/api-key/api-key.service` | `ApiKeyService` — generate / validate / CRUD / regenerate / track-usage |
| `core/api-key/errors` | `ApiKeyError`, `API_KEY_ERROR_CODES`, `isApiKeyError` |
| `core/api-key/ports` | DI ports: `IApiKeyRepository`, `IApiKeyCacheStore`, `IPlanConfigProvider`, `IUsageTracker`, `ApiKeyServiceEnv` |
| `core/api-key/types` | 순수 타입 (`CreateApiKeyOptions`, `ApiKeyValidationResult`, …) |
| `core/api-key/key-generator` | `generateRawKey` / `hashKey` / `keyPreview` (순수) |
| `core/api-key/ip-whitelist` | 단일 IP + IPv4 CIDR 매칭 (순수, 잘못된 입력 = 불일치) |
| `core/api-key/validate` | `validateApiKeyRecord` FSM (순수) |

## 연결

스택에 맞게 ports를 구현하고 서비스를 생성합니다:

```typescript
import { ApiKeyService } from '@withwiz/toolkit/core/api-key';

const service = new ApiKeyService({
  repo,        // IApiKeyRepository       — DB 어댑터
  cache,       // IApiKeyCacheStore       — 검증 결과 캐시 (예: core/cache 위에 구현)
  planConfig,  // IPlanConfigProvider     — 플랜별 키 한도 + rate limit
  usage,       // IUsageTracker           — 일/월 사용량 게이트
  env: {
    prefixProd: 'sk_live_',
    prefixDev: 'sk_test_',
    defaultExpiryDays: 365,
    restrictedPlans: ['FREEMIUM'],   // API 키 발급/사용 불가 플랜
  },
});
```

`plan`은 어디서나 평범한 `string` — 코어는 플랜 enum에 의존하지 않습니다.

## 키 수명주기

```typescript
// 발급 — raw key는 단 한 번 반환, 저장은 sha256 해시만
const result = await service.generateApiKey(userId, {
  name: 'ci-bot',
  permissions: ['read'],
  environment: 'production',   // 'production' | 'development' → prefix 결정
}, plan);
result.key;   // 'sk_live_…' — 지금 사용자에게 보여줄 것; 복구 불가

// 검증 (핫패스 — 무효 키에 throw 하지 않고 result 반환)
const v = await service.validateApiKey(rawKey);
if (!v.valid) v.error;   // 'INVALID_API_KEY' | 'INACTIVE_API_KEY' | 'EXPIRED_API_KEY'
                         // | 'INACTIVE_USER' | 'PLAN_RESTRICTED'

// 회전
await service.regenerateApiKey(userId, apiKeyId, plan);
```

### 알아둘 시맨틱

- **해싱**: 키는 환경 prefix + 32바이트 랜덤 hex이며 무염 sha256 해시로
  저장 — 고엔트로피 시크릿에 적정한 방식 (bcrypt/argon2는 저엔트로피 비밀번호
  용). raw key는 저장소에 닿지 않습니다.
- **한도 상태 회전** (0.12+): `keepOldKeyActive` 없이 **활성** 키를 재발급하면
  순증 0이므로 플랜 키 한도에 도달한 상태에서도 허용됩니다. 비활성 키
  재발급이나 `keepOldKeyActive: true` 회전은 순증 +1이라 한도를 적용합니다.
- **regenerate 부분 실패 없음** (0.12+): 제한 플랜 검사가 구키 비활성화
  *이전에* 실행되므로, 제한 플랜(예: 다운그레이드 후)에서의 재발급이
  사용자를 무키 상태로 만들지 않습니다.
- **캐시는 최적화 계층** (0.12+): `validateApiKey`에서 캐시 스토어 장애
  (읽기 / 쓰기 / 만료 엔트리 제거)는 miss로 취급 — 저장소가 정상이면 캐시
  장애가 인증을 실패시키지 않습니다. `updateApiKey` / `deleteApiKey` / 회전의
  캐시 무효화는 장애를 **전파**하므로 revoke가 조용히 누락되지 않습니다.
- **stale-auth 가드**: 캐시 hit이라도 자연 만료(`expiresAt`)를 재검사하므로
  만료 키가 캐시 TTL 동안 살아남지 못합니다.

## Typed Error

관리 연산(CRUD / generate / regenerate)은 안정적인 `code`를 담은
`ApiKeyError`를 throw 합니다. 메시지 문자열이 아닌 **code로 분기**하세요:

| Code | 발생 시점 |
|---|---|
| `API_KEY_NOT_FOUND` | 대상 키 미존재 |
| `API_KEY_OWNERSHIP` | 비소유자 접근 (admin은 우회) |
| `API_KEY_PLAN_RESTRICTED` | 제한 플랜의 발급 시도 |
| `API_KEY_LIMIT_REACHED` | 플랜 활성 키 한도 초과 |

```typescript
import { isApiKeyError, API_KEY_ERROR_CODES } from '@withwiz/toolkit/core/api-key/errors';

try {
  await service.deleteApiKey(id, userId);
} catch (e) {
  if (isApiKeyError(e, API_KEY_ERROR_CODES.NOT_FOUND) ||
      isApiKeyError(e, API_KEY_ERROR_CODES.OWNERSHIP)) {
    // HTTP 경계에서는 둘을 단일 응답으로 합쳐 비소유자에게 리소스 존재를
    // 은닉 (IDOR 방어). admin 대상 계층은 구분 노출해도 됩니다.
    return notFoundResponse();
  }
  throw e;
}
```

- `isApiKeyError`는 `instanceof`가 아닌 `name` + `code` **구조 검사** — 패키지
  중복 설치 환경에서도 판별이 깨지지 않습니다.
- HTTP status 매핑은 의도적으로 소비자 책임 — 코어는 HTTP를 전제하지 않습니다.
- 핫패스 `validateApiKey`는 실패를 예외가 아닌 **result 코드**
  (`ApiKeyValidationResult.error`)로 보고합니다. 두 어휘는 의도적 분리 —
  예상되는 검증 결과는 result, 관리 연산 오류는 throw.

## Next.js 미들웨어 (`next/oapi`)

```typescript
import { createApiKeyAuth } from '@withwiz/toolkit/next/oapi';

const auth = createApiKeyAuth({
  service,                      // Pick<ApiKeyService, 'validateApiKey' | 'trackUsage'>
  usage,                        // IUsageTracker
  extractClientIp: (h) => h.get('x-real-ip') ?? '',
  resolveRole: async (userId) => fetchRole(userId),   // 토큰 신뢰 금지, DB 재조회
});

export async function GET(req: NextRequest) {
  const r = await auth(req);
  if ('response' in r) return r.response;   // 401 / 403 / 500 완성 응답
  r.user;                                    // { id, email, role, plan, apiKeyId }
}
```

미들웨어 검사 순서: `x-api-key` 헤더 존재 → 키 유효성 → IP 화이트리스트
(`isIpAllowed`, 단일 IP + CIDR) → 사용량 한도. 사용량 확인의 *인프라 장애*는
fail-open(가용성 우선), 사용량 *한도 초과*는 fail-closed. `buildOpenApiSpec`은
OpenAPI 3.0.3 골격에 대응하는 `X-API-Key` securityScheme을 주입합니다.
