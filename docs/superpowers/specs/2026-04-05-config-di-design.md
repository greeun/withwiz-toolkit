# Config DI (Dependency Injection) 설계

> `process.env` 직접 읽기를 제거하고, 명시적 초기화 기반 설정 주입으로 전환

## 배경

`@withwiz/toolkit`은 npm 라이브러리 패키지인데, 대부분의 모듈이 `process.env`에서 직접 환경변수를 읽고 있다. 라이브러리에서 `process.env`를 직접 읽는 것은:

- 소비자가 특정 환경변수 이름에 암묵적으로 결합됨
- 어떤 환경변수가 필요한지 코드를 읽어야만 알 수 있음
- Edge/Worker 런타임에서 `process.env`가 없거나 다르게 동작
- 테스트 시 `process.env` 조작이 필요함

Cache 모듈만 `initializeCache()` DI 패턴이 적용되어 있고, 나머지는 모두 직접 읽기 방식이다.

## 설계 결정 요약

| 항목 | 결정 |
|---|---|
| 초기화 방식 | 모듈별 독립 초기화 + 통합 `initialize()` 편의 함수 |
| process.env | 완전 제거. 주입값 → 기본값만 사용 |
| 필수 설정 누락 | `ConfigurationError` throw + 중지 |
| 선택 설정 누락 | warn 로그 + 기본값 사용 |
| 검증 시점 | Eager — `initialize()` 호출 시 즉시 검증 |
| 기존 cache 모듈 | 새 패턴으로 통합 (process.env fallback 제거) |
| 접근법 | 독립 초기화 + 얇은 통합 레이어 (B안) |

## 모듈별 Config 인터페이스

### 공통 설정

```typescript
interface CommonConfig {
  nodeEnv?: 'development' | 'production' | 'test';  // 기본값: 'development', warn
}
```

### Auth

```typescript
interface AuthConfig {
  jwtSecret: string;              // 필수
  accessTokenExpiry?: string;     // 기본값: '7d'
  refreshTokenExpiry?: string;    // 기본값: '30d'
}
```

### Cache

```typescript
interface CacheConfig {
  enabled?: boolean;              // 기본값: true
  redis?: {
    url: string;                  // 필수 (redis 사용 시)
    token: string;                // 필수 (redis 사용 시)
    enabled?: boolean;            // 기본값: true
  };
  inmemory?: {
    enabled?: boolean;            // 기본값: true
    maxSize?: number;             // 기본값: 1000
    maxMb?: number;               // 기본값: 50
    eviction?: 'lru' | 'fifo' | 'ttl'; // 기본값: 'lru'
    cleanupInterval?: number;     // 기본값: 60000
  };
  ttl?: Partial<CacheTTLConfig>;
  categories?: Partial<Record<CacheCategory, CategoryConfig>>;
}
```

### Logger

```typescript
interface LoggerConfig {
  level?: string;                 // 기본값: 'info'
  dir?: string;                   // 기본값: './logs'
  file?: string;                  // 기본값: 'app.log'
  fileEnabled?: boolean;          // 기본값: true
  consoleEnabled?: boolean;       // 기본값: true
}
```

### Storage (R2)

```typescript
interface StorageConfig {
  accountId: string;              // 필수
  accessKeyId: string;            // 필수
  secretAccessKey: string;        // 필수
  bucketName: string;             // 필수
  publicUrl?: string;
}
```

### Geolocation

```typescript
interface GeolocationConfig {
  ipgeolocationApiKey?: string;
  maxmindLicenseKey?: string;
}
```

### CORS

```typescript
interface CorsConfig {
  allowedOrigins: string[];       // 필수
  baseUrl?: string;
}
```

### 통합

```typescript
interface ToolkitConfig {
  nodeEnv?: 'development' | 'production' | 'test';
  auth?: AuthConfig;
  cache?: CacheConfig;
  logger?: LoggerConfig;
  storage?: StorageConfig;
  geolocation?: GeolocationConfig;
  cors?: CorsConfig;
}
```

## 초기화 메커니즘

### 모듈별 패턴 (모든 모듈 동일 구조)

```typescript
// src/<module>/config.ts

let _config: Resolved<Module>Config | null = null;

export function initialize<Module>(config: <Module>Config): void {
  // 1. 필수값 검증 — 누락 시 ConfigurationError throw
  // 2. 선택값 누락 시 warn 로그 + 기본값 적용
  // 3. 최종 설정 저장
  _config = { ... };
}

export function get<Module>Config(): Resolved<Module>Config {
  if (!_config) throw new ConfigurationError('<Module>', 'Not initialized');
  return _config;
}

// 테스트 전용
export function reset<Module>(): void {
  _config = null;
}
```

### 통합 initialize 함수

```typescript
// src/initialize.ts

export function initialize(config: ToolkitConfig): void {
  initializeCommon({ nodeEnv: config.nodeEnv });       // 1. 공통 먼저
  if (config.logger) initializeLogger(config.logger);  // 2. logger (warn 출력용)
  if (config.auth) initializeAuth(config.auth);
  if (config.cache) initializeCache(config.cache);
  if (config.storage) initializeStorage(config.storage);
  if (config.geolocation) initializeGeolocation(config.geolocation);
  if (config.cors) initializeCors(config.cors);
}
```

**초기화 순서**: common → logger → 나머지 (logger가 먼저 초기화되어야 다른 모듈의 warn이 logger를 사용 가능)

### 중복 초기화 방지

기존 cache 패턴의 `global.__cacheInitialized`와 동일하게, 각 모듈별 전역 플래그로 중복 방지.

## 에러 처리

### ConfigurationError

```typescript
export class ConfigurationError extends Error {
  constructor(module: string, message: string) {
    super(`[${module}] ${message}`);
    this.name = 'ConfigurationError';
  }
}
```

### warn 로그 처리

```typescript
function warnLog(module: string, message: string): void {
  try {
    getLoggerConfig();  // logger 초기화 확인
    logWarn(`[${module}] ${message}`);
  } catch {
    console.warn(`[${module}] ${message}`);  // logger 미초기화 시 fallback
  }
}
```

## 파일 구조

### 변경/추가 파일

```
src/
├── initialize.ts                    # 신규: 통합 initialize() + ToolkitConfig
├── config/
│   ├── common.ts                    # 신규: 공통 설정 (nodeEnv)
│   └── errors.ts                    # 신규: ConfigurationError
├── auth/
│   └── config.ts                    # 신규: initializeAuth, getAuthConfig
├── cache/
│   └── cache-env.ts                 # 수정: process.env 제거, 새 패턴
├── logger/
│   ├── config.ts                    # 신규: initializeLogger, getLoggerConfig
│   └── logger.ts                    # 수정: process.env 제거
├── storage/
│   └── config.ts                    # 신규: initializeStorage, getStorageConfig
├── geolocation/
│   └── config.ts                    # 신규: initializeGeolocation, getGeolocationConfig
├── middleware/
│   ├── auth.ts                      # 수정: process.env 제거
│   ├── cors.ts                      # 수정: process.env 제거
│   └── error-handler.ts             # 수정: process.env 제거
├── utils/
│   └── cors.ts                      # 수정: process.env 제거
├── system/
│   ├── environment.ts               # 수정: process.env 제거
│   └── health-check.ts              # 수정: process.env 제거
└── types/
    └── env.ts                       # 수정: ISharedEnvConfig → 새 인터페이스
```

### package.json exports 추가

```json
{
  "./initialize": { "import": "./dist/initialize.js", "types": "./dist/initialize.d.ts" },
  "./auth/config": { "import": "./dist/auth/config.js", "types": "./dist/auth/config.d.ts" },
  "./logger/config": { "import": "./dist/logger/config.js", "types": "./dist/logger/config.d.ts" },
  "./storage/config": { "import": "./dist/storage/config.js", "types": "./dist/storage/config.d.ts" },
  "./geolocation/config": { "import": "./dist/geolocation/config.js", "types": "./dist/geolocation/config.d.ts" }
}
```

## 테스트 전략

### 각 모듈 config 테스트

```typescript
describe('initializeAuth', () => {
  beforeEach(() => resetAuth());

  it('필수값 누락 시 ConfigurationError throw', () => {
    expect(() => initializeAuth({} as any)).toThrow(ConfigurationError);
  });

  it('선택값 누락 시 warn 로그 + 기본값', () => {
    const spy = vi.spyOn(console, 'warn');
    initializeAuth({ jwtSecret: 'secret' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('accessTokenExpiry'));
  });

  it('초기화 없이 사용 시 에러', () => {
    expect(() => getAuthConfig()).toThrow('Not initialized');
  });

  it('정상 초기화', () => {
    initializeAuth({ jwtSecret: 'secret', accessTokenExpiry: '1h' });
    expect(getAuthConfig().accessTokenExpiry).toBe('1h');
  });
});
```

### 기존 테스트 수정

기존 테스트에서 `process.env` 조작하던 부분을 `initialize()` 호출로 대체.

## 소비자 사용법

```typescript
// app/instrumentation.ts (Next.js)
import { initialize } from '@withwiz/toolkit/initialize';

initialize({
  nodeEnv: process.env.NODE_ENV as 'production',
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
  },
  cache: {
    redis: {
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    },
  },
  logger: {
    level: 'debug',
    dir: '/var/log/myapp',
  },
  storage: {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucketName: process.env.R2_BUCKET_NAME!,
  },
  cors: {
    allowedOrigins: ['https://example.com'],
  },
});
```

모듈별 독립 초기화도 가능:

```typescript
import { initializeAuth } from '@withwiz/toolkit/auth/config';
initializeAuth({ jwtSecret: process.env.JWT_SECRET! });
```

## Breaking Changes

- `process.env` 기반 자동 설정이 제거됨 — 소비자가 반드시 `initialize()` 호출 필요
- 기존 `initializeCache(config: ISharedEnvConfig)` 인터페이스 변경
- `ISharedEnvConfig`, `IRawEnv` 등 기존 타입 제거/대체
- 버전: 0.3.0 (semver minor bump, 0.x 범위)
