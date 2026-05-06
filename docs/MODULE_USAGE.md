# @withwiz/toolkit 모듈 사용 가이드

> **v0.6.2** | Next.js >= 15 | React >= 18 | TypeScript 5 (strict)

---

## 목차

1. [설치 및 초기화](#1-설치-및-초기화)
2. [Config (통합 설정)](#2-config-통합-설정)
3. [Auth (인증)](#3-auth-인증)
4. [Cache (캐시)](#4-cache-캐시)
5. [Error (에러 처리)](#5-error-에러-처리)
6. [Middleware (미들웨어)](#6-middleware-미들웨어)
7. [Logger (로거)](#7-logger-로거)
8. [Storage (파일 저장소)](#8-storage-파일-저장소)
9. [Geolocation (위치 정보)](#9-geolocation-위치-정보)
10. [System (시스템 모니터링)](#10-system-시스템-모니터링)
11. [Utils (유틸리티)](#11-utils-유틸리티)
12. [Validators (검증)](#12-validators-검증)
13. [Hooks (React 훅)](#13-hooks-react-훅)
14. [Components (UI 컴포넌트)](#14-components-ui-컴포넌트)
15. [Types (타입 정의)](#15-types-타입-정의)
16. [Constants (상수)](#16-constants-상수)

---

## 1. 설치 및 초기화

### 설치

```bash
npm install @withwiz/toolkit
```

### 통합 초기화

앱 진입점(`app/lib/toolkit.ts` 등)에서 한 번 호출합니다. `initialize()`는 `ConfigRegistry` 객체를 리턴합니다.

```typescript
// app/lib/toolkit.ts
import { initialize } from '@withwiz/toolkit/initialize';

export const config = initialize({
  nodeEnv: 'production',
  auth:        { jwtSecret: process.env.JWT_SECRET! },
  logger:      { level: 'info', dir: './logs' },
  cache:       { enabled: true, redis: { url: process.env.REDIS_URL!, token: process.env.REDIS_TOKEN! } },
  storage:     { accountId: '...', accessKeyId: '...', secretAccessKey: '...', bucketName: '...' },
  geolocation: { ipgeolocationApiKey: process.env.GEO_API_KEY },
  cors:        { allowedOrigins: ['https://example.com'] },
});
```

모든 필드는 선택적입니다. 필요한 모듈만 설정하면 됩니다.

### 개별 초기화

모듈 단위로 개별 초기화도 가능합니다.

```typescript
import { initializeAuth } from '@withwiz/toolkit/auth/config';
import { initializeLogger } from '@withwiz/toolkit/logger/config';

initializeAuth({ jwtSecret: 'my-secret', cookieSecure: true });
initializeLogger({ level: 'debug' });
```

모든 설정은 단일 객체 `globalThis.__withwiz_config`에 저장됩니다. `config.auth`와 `getAuthConfig()` 모두 같은 객체를 반환합니다.

---

## 2. Config (통합 설정)

모든 설정은 단일 객체 `globalThis.__withwiz_config`에 저장됩니다. `initialize()` 리턴값 또는 별도 import으로 접근합니다.

```typescript
// 방법 1: initialize() 리턴값 사용 (권장)
import { config } from '@/lib/toolkit';

// 방법 2: 별도 import
import { config } from '@withwiz/toolkit/config';
```

### 설정 읽기

```typescript
config.auth.jwtSecret
config.logger.level
config.cache?.enabled
config.cors?.allowedOrigins

// 모듈 getter를 통한 접근 (동일 객체)
import { getAuthConfig } from '@withwiz/toolkit/auth/config';
getAuthConfig().jwtSecret  // === config.auth.jwtSecret
```

### ConfigRegistry 인터페이스

| 키 | 타입 | 필수 |
|----|------|------|
| `common` | `ResolvedCommonConfig` | O |
| `auth` | `ResolvedAuthConfig` | O |
| `logger` | `ResolvedLoggerConfig` | O |
| `cache` | `ResolvedCacheConfig` | - |
| `storage` | `ResolvedStorageConfig` | - |
| `geolocation` | `ResolvedGeolocationConfig` | - |
| `cors` | `ResolvedCorsConfig` | - |

### 앱 고유 설정 확장

앱 프로젝트에서 `config.app.*` 등 커스텀 키를 추가할 수 있습니다.

```typescript
// app/types/toolkit.d.ts — 타입 확장 선언
import '@withwiz/toolkit/config';

declare module '@withwiz/toolkit/config' {
  interface ConfigRegistry {
    app: {
      siteName: string;
      defaultLocale: string;
    };
  }
}
```

```typescript
// app/lib/toolkit.ts — 초기화 후 앱 설정 추가
export const config = initialize({ ... });

config.app = {
  siteName: 'MyApp',
  defaultLocale: 'ko',
};
```

```typescript
// app/anywhere.ts — 타입 안전하게 참조
import { config } from '@/lib/toolkit';

config.auth.jwtSecret;    // toolkit 설정
config.app.siteName;       // 앱 설정 (자동완성 동작)
```

### 테스트에서 리셋

```typescript
import { resetConfig } from '@withwiz/toolkit/config';

beforeEach(() => {
  resetConfig(); // 모든 모듈 설정 초기화
});
```

---

## 3. Auth (인증)

```typescript
import { ... } from '@withwiz/toolkit/auth';
```

### 3.1 JWT

#### JWTService (간편 래퍼)

```typescript
import { JWTService } from '@withwiz/toolkit/auth';

const jwt = new JWTService({
  secret: config.auth.jwtSecret,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '30d',
  algorithm: 'HS256',
});

// 토큰 쌍 생성
const { accessToken, refreshToken } = await jwt.createTokenPair({
  id: user.id,
  email: user.email,
  role: user.role,
});

// 토큰 검증
const payload = await jwt.verify(accessToken);
// → { id, userId, email, role, emailVerified, iat, exp }

// 헤더에서 토큰 추출
const token = jwt.extractTokenFromHeader(req.headers.get('authorization'));
```

#### JWTManager (로거 포함)

```typescript
import { JWTManager } from '@withwiz/toolkit/auth';

const jwtManager = new JWTManager(jwtConfig, logger);

const accessToken = await jwtManager.createAccessToken({ id, email, role, userId });
const payload = await jwtManager.verifyAccessToken(token);
const remaining = jwtManager.getTokenRemainingTime(payload); // 초 단위
```

#### JWT Client (브라우저)

```typescript
import {
  storeTokens,
  getStoredTokens,
  clearStoredTokens,
  isTokenExpired,
  decodeJWTPayload,
  createAuthHeader,
  createApiHeaders,
} from '@withwiz/toolkit/auth';

// 토큰 저장/조회
storeTokens({ accessToken, refreshToken });
const tokens = getStoredTokens();

// 토큰 상태 확인
const expired = isTokenExpired(tokens.accessToken);
const payload = decodeJWTPayload(tokens.accessToken);

// API 요청 헤더 생성
const headers = createApiHeaders(); // Authorization: Bearer <token>
```

### 3.2 Password

```typescript
import { PasswordHasher, PasswordValidator, PasswordStrength } from '@withwiz/toolkit/auth';

// 해싱
const hasher = new PasswordHasher(12); // bcrypt rounds
const hash = await hasher.hash('my-password');
const valid = await hasher.verify('my-password', hash); // true

// 검증
const validator = new PasswordValidator({
  minLength: 8,
  maxLength: 100,
  requireNumber: true,
  requireUppercase: true,
  requireLowercase: true,
  requireSpecialChar: true,
  bcryptRounds: 12,
});

const result = validator.validate('Test123!');
// → { isValid: true, strength: 'STRONG', errors: [], score: 85 }

// 간편 함수
import { validatePassword, getPasswordStrength } from '@withwiz/toolkit/auth';

validatePassword('weak');    // → { isValid: false, errors: [...] }
getPasswordStrength('Test123!@#'); // → PasswordStrength.VERY_STRONG
```

#### Zod 스키마

```typescript
import { defaultPasswordSchema, strongPasswordSchema } from '@withwiz/toolkit/auth';

const schema = z.object({
  password: strongPasswordSchema, // min 12, 대/소문자 + 숫자 + 특수문자
});
```

### 3.3 OAuth

```typescript
import { OAuthManager, GoogleOAuthProvider, GitHubOAuthProvider, KakaoOAuthProvider } from '@withwiz/toolkit/auth';

const oauth = new OAuthManager(oauthConfig, logger);

// 프로바이더 등록
oauth.registerProvider(new GoogleOAuthProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'https://example.com/auth/callback/google',
}));

// 로그인 URL 생성
const loginUrl = oauth.getLoginUrl('google', state);

// 콜백 처리
const oauthToken = await oauth.exchangeCodeForToken('google', code);
const userInfo = await oauth.getUserInfo('google', oauthToken);
// → { id, email, name, image, emailVerified }
```

### 3.4 Auth Route Handlers

```typescript
import { createAuthHandlers } from '@withwiz/toolkit/auth';

const auth = createAuthHandlers({
  dependencies: { userRepository },
  jwt: { secret: '...', accessTokenExpiry: '15m', refreshTokenExpiry: '30d' },
  urls: { baseUrl: '...', loginUrl: '/login', callbackUrl: '/auth/callback' },
  oauth: {
    google: { clientId: '...', clientSecret: '...', redirectUri: '...' },
  },
  features: { emailVerificationRequired: true },
});

// Next.js App Router
export const POST = auth.login;     // POST /api/auth/login
export const POST = auth.register;  // POST /api/auth/register
export const POST = auth.refresh;   // POST /api/auth/refresh
export const GET  = auth.me;        // GET  /api/auth/me
```

---

## 4. Cache (캐시)

```typescript
import { ... } from '@withwiz/toolkit/cache';
```

### 4.1 withCache (권장)

데이터베이스 쿼리 등을 자동 캐싱합니다.

```typescript
import { withCache } from '@withwiz/toolkit/cache';

// prefix로 카테고리 지정
const user = await withCache(
  `user:${userId}`,
  () => db.user.findUnique({ where: { id: userId } }),
  { ttl: 1800, prefix: 'user' }
);

// prefix 없이 (키의 첫 번째 세그먼트가 prefix가 됨)
const links = await withCache(
  `community:recent:${page}`,
  () => fetchRecentLinks(page)
);
```

### 4.2 캐시 매니저 직접 사용

```typescript
import { cache, geoCache, getCacheManager } from '@withwiz/toolkit/cache';

// 기본 캐시 인스턴스
await cache.set('key', value, 3600);
const data = await cache.get<MyType>('key');
await cache.delete('key');

// GeoIP 전용 캐시
await geoCache.set(`geo:${ip}`, geoData, 2592000); // 30일

// 커스텀 prefix 캐시
const analyticsCache = getCacheManager('analytics');
await analyticsCache.set('daily-stats', stats, 1800);
```

### 4.3 캐시 설정 조회

```typescript
import { getCacheConfig, getCacheTTL } from '@withwiz/toolkit/cache';

// 카테고리별 활성/TTL
getCacheConfig.user.enabled();    // boolean
getCacheConfig.user.duration();   // seconds
getCacheConfig.geoip.duration();  // seconds

// TTL 상수
getCacheTTL.default();   // 3600
getCacheTTL.settings();  // 3600
getCacheTTL.user();      // 1800
getCacheTTL.geoip();     // 2592000
```

### 4.4 캐시 무효화

```typescript
import { invalidateCache } from '@withwiz/toolkit/cache';

await invalidateCache('user:123');
await invalidateCache('community:*'); // 패턴 매칭
```

### 4.5 캐시 백엔드

| 백엔드 | 조건 | 설명 |
|--------|------|------|
| `hybrid` | Redis + inmemory 모두 활성 | Redis 우선, 장애 시 inmemory fallback |
| `redis` | Redis만 활성 | Upstash Redis |
| `memory` | inmemory만 활성 | LRU/FIFO/TTL eviction |
| `none` | 모두 비활성 | NoopCacheManager (캐시 미사용) |

```typescript
import { getEffectiveCacheBackend } from '@withwiz/toolkit/cache';

getEffectiveCacheBackend(); // 'hybrid' | 'redis' | 'memory' | 'none'
```

### 4.6 캐시 메트릭

```typescript
import { cacheMetrics } from '@withwiz/toolkit/cache';

console.log(cacheMetrics.hits);
console.log(cacheMetrics.misses);
console.log(cacheMetrics.hitRate);     // 0.0 ~ 1.0
console.log(cacheMetrics.totalRequests);
cacheMetrics.reset();
```

---

## 5. Error (에러 처리)

```typescript
import { AppError } from '@withwiz/toolkit/error';
```

### 5.1 에러 생성 (팩토리 메서드)

```typescript
// 400 — Validation
throw AppError.validation('유효하지 않은 입력입니다');
throw AppError.badRequest('잘못된 요청');
throw AppError.missingField('email');
throw AppError.invalidEmail('bad@');
throw AppError.weakPassword();

// 401 — Authentication
throw AppError.unauthorized();
throw AppError.invalidToken();
throw AppError.tokenExpired();
throw AppError.invalidCredentials();

// 403 — Authorization
throw AppError.forbidden('접근 권한 없음');
throw AppError.emailNotVerified();
throw AppError.accountDisabled();

// 404 — Not Found
throw AppError.notFound('리소스를 찾을 수 없습니다');
throw AppError.userNotFound();

// 409 — Conflict
throw AppError.duplicate('User');
throw AppError.emailExists('user@example.com');

// 422 — Business Logic
throw AppError.businessRule('주문 취소 기한 초과');
throw AppError.quotaExceeded('storage');
throw AppError.fileTooLarge('10MB');

// 429 — Rate Limit
throw AppError.rateLimit(60); // retryAfter: 60초
throw AppError.dailyLimit();

// 500 — Server Error
throw AppError.serverError();
throw AppError.databaseError();

// 503 — Service Unavailable
throw AppError.externalServiceError('Payment API');
```

### 5.2 에러 코드 체계

5자리 코드 `XXXYY`:
- `XXX` = HTTP 상태 코드
- `YY` = 세부 구분 번호

```typescript
import { ERROR_CODES } from '@withwiz/toolkit/error';

ERROR_CODES.VALIDATION_ERROR     // { code: 40001, status: 400, message: '...' }
ERROR_CODES.UNAUTHORIZED         // { code: 40101, status: 401, message: '...' }
ERROR_CODES.NOT_FOUND            // { code: 40401, status: 404, message: '...' }
ERROR_CODES.RATE_LIMIT_EXCEEDED  // { code: 42901, status: 429, message: '...' }
```

### 5.3 에러 변환 및 직렬화

```typescript
const error = AppError.notFound('사용자를 찾을 수 없습니다');

// JSON 직렬화
error.toJSON();
// → { code: 40401, message: '...', status: 404, key: 'NOT_FOUND', category: 'not_found', timestamp: '...' }

// 사용자 친화적 메시지
error.toFriendlyMessage();

// 로그 문자열
error.toLogString();

// 다국어 메시지
import { getFriendlyMessage, getErrorDisplayInfo } from '@withwiz/toolkit/error';

getFriendlyMessage(40401, 'ko'); // 한국어 메시지
getErrorDisplayInfo(40401, 'en');
// → { title: 'Not Found', description: '...', action: 'Go back' }
```

### 5.4 unknown 에러를 AppError로 변환

```typescript
try {
  await someOperation();
} catch (err) {
  const appError = AppError.from(err); // unknown → AppError
  throw appError;
}
```

### 5.5 ErrorBoundary (React)

```typescript
import { ErrorBoundary } from '@withwiz/toolkit/error';

<ErrorBoundary fallback={<p>문제가 발생했습니다</p>}>
  <MyComponent />
</ErrorBoundary>
```

---

## 6. Middleware (미들웨어)

```typescript
import { ... } from '@withwiz/toolkit/middleware';
```

### 6.1 API 래퍼 (권장)

Next.js App Router의 API 라우트에 미들웨어 체인을 적용합니다.

```typescript
import { withPublicApi, withAuthApi, withAdminApi, withOptionalAuthApi } from '@withwiz/toolkit/middleware';
import { NextResponse } from 'next/server';

// 공개 API (인증 불필요, Rate limit: 120/min)
export const GET = withPublicApi(async (ctx) => {
  return NextResponse.json({ message: 'Hello' });
});

// 인증 필수 API
export const POST = withAuthApi(async (ctx) => {
  const userId = ctx.user!.id;
  const email  = ctx.user!.email;
  return NextResponse.json({ userId });
});

// 관리자 전용 API
export const DELETE = withAdminApi(async (ctx) => {
  // ctx.user.role === 'admin' 보장됨
  return NextResponse.json({ deleted: true });
});

// 선택적 인증 (로그인 여부 무관)
export const GET = withOptionalAuthApi(async (ctx) => {
  const userId = ctx.user?.id; // 로그인 시 존재, 비로그인 시 undefined
  return NextResponse.json({ userId });
});
```

### 6.2 커스텀 미들웨어 체인

```typescript
import {
  withCustomApi,
  MiddlewareChain,
  errorHandlerMiddleware,
  initRequestMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  responseLoggerMiddleware,
} from '@withwiz/toolkit/middleware';

export const POST = withCustomApi(
  async (ctx) => {
    return NextResponse.json({ data: 'custom' });
  },
  (chain) => chain
    .use(errorHandlerMiddleware)
    .use(initRequestMiddleware)
    .use(authMiddleware)
    .use(rateLimitMiddleware.strict)
    .use(responseLoggerMiddleware)
);
```

### 6.3 미들웨어 체인 (수동 구성)

```typescript
import { MiddlewareChain } from '@withwiz/toolkit/middleware';

const chain = new MiddlewareChain()
  .use(errorHandlerMiddleware)
  .use(securityMiddleware)
  .use(corsMiddleware)
  .use(initRequestMiddleware)
  .use(authMiddleware)
  .use(responseLoggerMiddleware);

const response = await chain.execute(context, handler);
```

### 6.4 개별 미들웨어

| 미들웨어 | 역할 |
|----------|------|
| `errorHandlerMiddleware` | 최상위 에러 캐치 및 JSON 응답 |
| `securityMiddleware` | TRACE/TRACK 차단, Content-Type 검증, 보안 헤더 |
| `corsMiddleware` | CORS 헤더 처리 |
| `initRequestMiddleware` | requestId 생성, locale 설정 |
| `authMiddleware` | JWT 인증 필수 (401 on failure) |
| `optionalAuthMiddleware` | JWT 인증 선택적 |
| `adminMiddleware` | 관리자 권한 확인 (403 if not admin) |
| `rateLimitMiddleware.api` | 120 req/min |
| `rateLimitMiddleware.strict` | 엄격한 제한 |
| `rateLimitMiddleware.admin` | 관리자 API 제한 (200 req/min) |
| `responseLoggerMiddleware` | 요청/응답 로깅 |

### 6.5 커스텀 Role 미들웨어

```typescript
import { createRoleMiddleware } from '@withwiz/toolkit/middleware';

const editorOnly = createRoleMiddleware(['editor', 'admin']);
```

### 6.6 Rate Limit 어댑터

```typescript
import { setRateLimitAdapter } from '@withwiz/toolkit/middleware';

setRateLimitAdapter({
  rateLimiters: {
    api: { check: (id) => limiter.check(id), config: { limit: 120 } },
  },
  extractClientIp: (headers) => headers.get('x-forwarded-for') || '127.0.0.1',
});
```

### 6.7 IApiContext

```typescript
interface IApiContext {
  request: NextRequest;
  locale: string;           // 'ko', 'en', ...
  requestId: string;        // UUID
  startTime: number;        // Date.now()
  user?: IUser;             // 인증 미들웨어가 설정
  metadata: Record<string, any>;
}
```

---

## 7. Logger (로거)

```typescript
import { logger, logInfo, logError, logDebug } from '@withwiz/toolkit/logger/logger';
```

### 기본 사용

```typescript
logInfo('사용자 로그인 성공', { userId: '123', ip: '1.2.3.4' });
logError('결제 실패', { error, orderId: 'abc', context: 'payment' });
logDebug('캐시 히트', { key: 'user:123', ttl: 300 });
```

### Winston 인스턴스 직접 사용

```typescript
logger.warn('경고 메시지', { meta: 'data' });
logger.http('HTTP 요청', { method: 'GET', url: '/api/users' });
```

### API 요청/응답 로깅

```typescript
import { logApiRequest, logApiResponse } from '@withwiz/toolkit/logger/logger';

logApiRequest(request, { userId: '123' });
logApiResponse(request, response, { duration: 150 });
// → 민감 정보(password, token 등) 자동 마스킹
// → 긴 body 자동 truncate (1024자)
```

### 설정

```typescript
import { initializeLogger } from '@withwiz/toolkit/logger/config';

initializeLogger({
  level: 'debug',         // 'debug' | 'info' | 'warn' | 'error'
  dir: './logs',           // 로그 파일 디렉토리
  file: 'app.log',        // 파일명 (daily rotate: app-2025-01-01.log)
  fileEnabled: true,       // 파일 출력
  consoleEnabled: true,    // 콘솔 출력
});
```

---

## 8. Storage (파일 저장소)

```typescript
import { uploadToR2, deleteFromR2, getFromR2, isR2Enabled } from '@withwiz/toolkit/storage';
```

### CloudFlare R2 / S3 호환 스토리지

```typescript
// 설정 (initialize에서 또는 개별)
import { initializeStorage } from '@withwiz/toolkit/storage/config';

initializeStorage({
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucketName: 'my-bucket',
  publicUrl: 'https://cdn.example.com',
});

// 활성화 확인
if (isR2Enabled()) {
  // 업로드
  const result = await uploadToR2('images/photo.jpg', buffer, 'image/jpeg');
  // → { key: 'images/photo.jpg', url: 'https://cdn.example.com/images/photo.jpg', size: 12345 }

  // 다운로드
  const file = await getFromR2('images/photo.jpg');
  // → { body: ReadableStream, contentType: 'image/jpeg' } | null

  // 삭제
  await deleteFromR2('images/photo.jpg');
}
```

---

## 9. Geolocation (위치 정보)

```typescript
import { ... } from '@withwiz/toolkit/geolocation';
```

### GeoIP 프로바이더

```typescript
import { GeoIPProviderFactory } from '@withwiz/toolkit/geolocation';

// 사용 가능한 프로바이더 조회
const providers = GeoIPProviderFactory.getAvailableProviders();

// 특정 프로바이더로 조회
const provider = GeoIPProviderFactory.getProvider('ipgeolocation');
const geoData = await provider.lookup('8.8.8.8');
// → { ip, country, region, city, latitude, longitude, timezone, isp, org }
```

### 배치 처리

```typescript
import { createBatchProcessor } from '@withwiz/toolkit/geolocation';

const processor = createBatchProcessor({
  batchSize: 100,
  concurrency: 5,
  timeout: 10000,
  retries: 3,
});

const result = await processor.processBatch(['8.8.8.8', '1.1.1.1', '...']);
// → { successful: 98, failed: 2, results: Map<string, IGeoLocationData> }
```

### 내장 프로바이더

| 프로바이더 | 클래스 | API 키 필요 |
|-----------|--------|------------|
| ip-api.com | `IPApiProvider` | 무료 |
| ip-api.co | `IPApiCoProvider` | 무료 |
| IPGeolocation | `IPGeolocationProvider` | 필요 |
| MaxMind | `MaxMindProvider` | 필요 |

---

## 10. System (시스템 모니터링)

```typescript
import { getSystemInfo, getSimpleSystemInfo } from '@withwiz/toolkit/system';
```

### 전체 시스템 정보

```typescript
const info = await getSystemInfo();
// → {
//   nodeVersion: 'v20.10.0',
//   osInfo: 'macOS',
//   uptime: '2d 5h 30m 15s',
//   cpu: { system: 12.5, processUsage: 3.2, cores: 10, loadAverage: [2.1, 1.8, 1.5] },
//   memory: { total, free, used, percent, processUsed },
//   disk: { total: '500 GB', used: '250 GB', available: '250 GB', percent: 50 },
//   network: { rxRate, txRate, connections, ... },
//   environment: [...],
//   services: [...]
// }
```

### 간단한 시스템 정보

```typescript
const simple = await getSimpleSystemInfo();
// → { platform, cpu: { usage, cores, load }, memory: { total, used, percent }, disk: { ... } }
```

### 개별 리소스 조회

```typescript
import {
  getCpuInfo,
  getMemoryInfo,
  getDiskInfo,
  getNetworkInfo,
  checkEnvironmentVariables,
  checkServiceHealth,
} from '@withwiz/toolkit/system';

const cpu = await getCpuInfo();
const memory = await getMemoryInfo();
```

---

## 11. Utils (유틸리티)

```typescript
import { ... } from '@withwiz/toolkit/utils';
```

### 11.1 Sanitizer (XSS 방지)

```typescript
import {
  sanitizeHtml,
  sanitizeUrl,
  sanitizeObject,
  sanitizeFileName,
} from '@withwiz/toolkit/utils';

sanitizeHtml('<script>alert("xss")</script>Hello');  // → 'Hello'
sanitizeUrl('javascript:alert(1)');                   // → ''
sanitizeFileName('../../../etc/passwd');               // → 'etcpasswd'

// 객체 내 모든 문자열 필드 재귀 sanitize
const safe = sanitizeObject({ name: '<b>John</b>', bio: '<script>...' });
```

### 11.2 Error Processor

```typescript
import {
  withErrorHandling,
  processError,
  errorToResponse,
  throwNotFoundError,
  throwValidationError,
  handlePrismaError,
} from '@withwiz/toolkit/utils';

// 래퍼 함수
const result = await withErrorHandling(
  () => riskyOperation(),
  { fallbackMessage: '작업 실패' }
);

// 편의 throw 함수
throwNotFoundError('사용자를 찾을 수 없습니다');     // → never
throwValidationError('이메일 형식이 올바르지 않습니다'); // → never
throwBusinessRuleError('주문 취소 불가');

// Prisma 에러 변환
try {
  await prisma.user.create({ data });
} catch (err) {
  throw handlePrismaError(err); // P2002 → AppError.duplicate() 등
}

// unknown 에러 → NextResponse
const response = errorToResponse(unknownError);
```

### 11.3 API Helpers

```typescript
import { validateAndParse, parsePagination } from '@withwiz/toolkit/utils';

// Zod 스키마 검증 + 파싱
const validation = validateAndParse(createUserSchema, requestBody);
if (!validation.success) return validation.response; // 400 응답 자동 생성
const { data } = validation;

// 페이지네이션 파라미터 추출
const { page, limit, skip } = parsePagination(request, 20, 100);
// ?page=2&limit=10 → { page: 2, limit: 10, skip: 10 }
```

### 11.4 CSV Export

```typescript
import { exportToCsv } from '@withwiz/toolkit/utils';

exportToCsv(users, 'users.csv', {
  columns: ['id', 'email', 'name', 'createdAt'],
  headers: ['ID', '이메일', '이름', '가입일'],
});
```

---

## 12. Validators (검증)

```typescript
import { PasswordValidator, PasswordStrength } from '@withwiz/toolkit/validators';
```

auth 모듈의 패스워드 검증 기능을 독립적으로도 사용할 수 있습니다.

```typescript
const validator = new PasswordValidator({
  minLength: 8,
  requireNumber: true,
  requireUppercase: true,
  requireSpecialChar: true,
});

const result = validator.validate('MyP@ss123');
// → { isValid: true, strength: PasswordStrength.STRONG, errors: [], score: 85 }

const confirmation = validator.validateConfirmation('MyP@ss123', 'MyP@ss124');
// → { isValid: false, errors: ['비밀번호가 일치하지 않습니다'] }
```

---

## 13. Hooks (React 훅)

### useDebounce

```typescript
import { useDebounce } from '@withwiz/toolkit/hooks/useDebounce';

function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) fetchResults(debouncedQuery);
  }, [debouncedQuery]);
}
```

### useDataTable

```typescript
import { useDataTable } from '@withwiz/toolkit/hooks/useDataTable';

function UserTable() {
  const {
    data, loading, total,
    filters, sort, pagination, selectedIds,
    dataActions, filterActions, sortActions, paginationActions, selectionActions,
  } = useDataTable<User>({
    initialPagination: { page: 1, pageSize: 20 },
    debounceMs: 300,
    onDataChange: async ({ filters, sort, pagination }) => {
      const result = await fetchUsers({ filters, sort, pagination });
      dataActions.setData(result.users);
      dataActions.setTotal(result.total);
    },
  });

  return (
    <>
      <input onChange={(e) => filterActions.setSearch(e.target.value)} />
      <table>...</table>
      <Pagination
        page={pagination.page}
        total={total}
        onPageChange={paginationActions.setPage}
      />
    </>
  );
}
```

### useExitIntent

```typescript
import { useExitIntent } from '@withwiz/toolkit/hooks/useExitIntent';

function PopupBanner() {
  useExitIntent({
    onExitIntent: () => showBanner(),
    threshold: 20,   // 마우스가 화면 상단 20px 이내
    cooldown: 60000,  // 60초 쿨다운
  });
}
```

### useTimezone

```typescript
import { useTimezone } from '@withwiz/toolkit/hooks/useTimezone';

function TimeDisplay() {
  const { timezone, offset, formatDate } = useTimezone();
  // timezone: 'Asia/Seoul', offset: '+09:00'

  return <span>{formatDate(new Date())}</span>;
}
```

---

## 14. Components (UI 컴포넌트)

### DataTable

```typescript
import {
  DataTable,
  DataTableSearch,
  DataTableFilters,
  DataTableBulkActions,
  DataTableBody,
  DataTablePagination,
} from '@withwiz/toolkit/components/ui/data-table';

<DataTable
  columns={[
    { key: 'email', label: '이메일', sortable: true },
    { key: 'name', label: '이름', filterable: true },
    { key: 'createdAt', label: '가입일', sortable: true },
  ]}
  data={users}
  loading={loading}
  pagination={{ page: 1, pageSize: 20, total: 100 }}
  onPageChange={setPage}
  onSort={setSort}
/>
```

조합형으로도 사용 가능합니다:

```typescript
<div>
  <DataTableSearch onSearch={filterActions.setSearch} />
  <DataTableFilters filters={filterConfig} onFilter={filterActions.setFilter} />
  <DataTableBulkActions
    selectedIds={selectedIds}
    actions={[
      { id: 'delete', label: '삭제', action: handleBulkDelete },
      { id: 'export', label: '내보내기', action: handleExport },
    ]}
  />
  <DataTableBody columns={columns} data={data} />
  <DataTablePagination page={page} total={total} onPageChange={setPage} />
</div>
```

---

## 15. Types (타입 정의)

### API 응답

```typescript
import type { IApiResponse } from '@withwiz/toolkit/types/api';

// 표준 API 응답 형식
const response: IApiResponse<User> = {
  success: true,
  data: user,
};

const errorResponse: IApiResponse = {
  success: false,
  error: {
    code: 40401,
    message: 'User not found',
    requestId: 'abc-123',
  },
};
```

### User

```typescript
import type { IUser, IUserCreateData, IUserUpdateData, IUserListResult } from '@withwiz/toolkit/types/user';
```

### Environment

```typescript
import type { ICacheEnv, IInMemoryCacheEnv } from '@withwiz/toolkit/types/env';
```

### GeoIP

```typescript
import type { IGeoLocationData, IGeoIPApiResponse, IGeoIPProvider } from '@withwiz/toolkit/types/geoip';
```

### 기타

```typescript
import type { ... } from '@withwiz/toolkit/types/database';
import type { ... } from '@withwiz/toolkit/types/i18n';
import type { ... } from '@withwiz/toolkit/types/qr-code';
```

---

## 16. Constants (상수)

```typescript
import { ERROR_CODES } from '@withwiz/toolkit/constants/error-codes';
import { JWT_DEFAULTS, EMAIL_VERIFICATION, PASSWORD_RESET } from '@withwiz/toolkit/constants/security';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@withwiz/toolkit/constants/pagination';
```

### 에러 코드 카테고리

| 범위 | 카테고리 | 예시 |
|------|---------|------|
| 400xx | Validation | `VALIDATION_ERROR`, `MISSING_REQUIRED_FIELD` |
| 401xx | Authentication | `UNAUTHORIZED`, `TOKEN_EXPIRED` |
| 403xx | Authorization | `FORBIDDEN`, `ACCOUNT_DISABLED` |
| 404xx | Not Found | `NOT_FOUND`, `USER_NOT_FOUND` |
| 409xx | Conflict | `DUPLICATE_RESOURCE`, `EMAIL_ALREADY_EXISTS` |
| 422xx | Business Logic | `BUSINESS_RULE_VIOLATION`, `QUOTA_EXCEEDED` |
| 429xx | Rate Limit | `RATE_LIMIT_EXCEEDED`, `DAILY_LIMIT_EXCEEDED` |
| 500xx | Server Error | `SERVER_ERROR`, `DATABASE_ERROR` |
| 503xx | Service Unavailable | `EXTERNAL_SERVICE_ERROR` |

### 보안 상수

```typescript
JWT_DEFAULTS.ALGORITHM                      // 'HS256'
JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES    // '7d'
JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES   // '30d'

EMAIL_VERIFICATION.TOKEN_EXPIRES_HOURS       // 24
PASSWORD_RESET.TOKEN_EXPIRES_HOURS           // 1
```

---

## Import 경로 요약

| 모듈 | Import 경로 |
|------|------------|
| 초기화 | `@withwiz/toolkit/initialize` |
| 설정 레지스트리 | `@withwiz/toolkit/config` |
| Auth | `@withwiz/toolkit/auth` |
| Auth Config | `@withwiz/toolkit/auth/config` |
| Cache | `@withwiz/toolkit/cache` |
| Error | `@withwiz/toolkit/error` |
| Middleware | `@withwiz/toolkit/middleware` |
| Logger | `@withwiz/toolkit/logger/logger` |
| Storage | `@withwiz/toolkit/storage` |
| Storage Config | `@withwiz/toolkit/storage/config` |
| Geolocation | `@withwiz/toolkit/geolocation` |
| System | `@withwiz/toolkit/system` |
| Utils | `@withwiz/toolkit/utils` |
| Validators | `@withwiz/toolkit/validators` |
| Hooks | `@withwiz/toolkit/hooks/useDebounce` 등 개별 |
| Components | `@withwiz/toolkit/components/ui/data-table` |
| Types | `@withwiz/toolkit/types/api` 등 개별 |
| Constants | `@withwiz/toolkit/constants/error-codes` 등 개별 |
