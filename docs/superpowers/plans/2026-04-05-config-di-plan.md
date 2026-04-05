# Config DI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `process.env` 직접 읽기를 모든 모듈에서 제거하고, 명시적 초기화 기반 DI로 전환한다.

**Architecture:** 각 모듈에 독립적인 `config.ts`를 추가하여 `initializeXxx()` / `getXxxConfig()` / `resetXxx()` 패턴을 구현한다. 통합 `initialize()` 함수는 모듈별 초기화를 순서대로 호출하는 얇은 레이어이다. `process.env` fallback은 없고, 초기화 없이 사용하면 `ConfigurationError`를 throw한다.

**Tech Stack:** TypeScript 5, Vitest, tsup, Node.js ESM

**Spec:** `docs/superpowers/specs/2026-04-05-config-di-design.md`

---

## File Structure

### 신규 파일

| 파일 | 역할 |
|-----|------|
| `src/config/errors.ts` | `ConfigurationError` 클래스 |
| `src/config/warn.ts` | warn 로그 유틸 (logger fallback 포함) |
| `src/config/common.ts` | 공통 설정 (nodeEnv) |
| `src/auth/config.ts` | Auth 모듈 설정 |
| `src/cache/config.ts` | Cache 모듈 설정 (cache-env.ts 대체) |
| `src/logger/config.ts` | Logger 모듈 설정 |
| `src/storage/config.ts` | Storage(R2) 모듈 설정 |
| `src/geolocation/config.ts` | Geolocation 모듈 설정 |
| `src/middleware/cors-config.ts` | CORS 모듈 설정 |
| `src/initialize.ts` | 통합 initialize 함수 |
| `__tests__/unit/config/errors.test.ts` | ConfigurationError 테스트 |
| `__tests__/unit/config/common.test.ts` | 공통 설정 테스트 |
| `__tests__/unit/config/auth-config.test.ts` | Auth 설정 테스트 |
| `__tests__/unit/config/cache-config.test.ts` | Cache 설정 테스트 |
| `__tests__/unit/config/logger-config.test.ts` | Logger 설정 테스트 |
| `__tests__/unit/config/storage-config.test.ts` | Storage 설정 테스트 |
| `__tests__/unit/config/geolocation-config.test.ts` | Geolocation 설정 테스트 |
| `__tests__/unit/config/cors-config.test.ts` | CORS 설정 테스트 |
| `__tests__/unit/initialize.test.ts` | 통합 initialize 테스트 |

### 수정 파일

| 파일 | 변경 내용 |
|-----|---------|
| `src/cache/cache-env.ts` | `process.env` 제거, `src/cache/config.ts`에서 설정 읽기 |
| `src/middleware/auth.ts` | `process.env` 제거, `getAuthConfig()` 사용 |
| `src/middleware/cors.ts` | `process.env` 제거, `getCorsConfig()` 사용 |
| `src/middleware/error-handler.ts` | `process.env.NODE_ENV` → `getCommonConfig().nodeEnv` |
| `src/logger/logger.ts` | `process.env.LOG_*` 제거, `getLoggerConfig()` 사용 |
| `src/storage/r2-storage.ts` | `process.env.R2_*` 제거, `getStorageConfig()` 사용 |
| `src/geolocation/providers/ipgeolocation-provider.ts` | `process.env` 제거 |
| `src/geolocation/providers/maxmind-provider.ts` | `process.env` 제거 |
| `src/utils/cors.ts` | `process.env` 제거, `getCorsConfig()` 사용 |
| `src/system/environment.ts` | `process.env` 제거, 각 모듈 config에서 읽기 |
| `src/system/health-check.ts` | `process.env` 제거 |
| `src/types/env.ts` | 새 Config 인터페이스 추가, 기존 타입 deprecated |
| `package.json` | exports에 `./initialize`, `./config/*` 추가 |
| `tsup.config.ts` | `src/config/**/*.ts`, `src/initialize.ts` entry 추가 |

---

## Task 1: ConfigurationError 및 warn 유틸

**Files:**
- Create: `src/config/errors.ts`
- Create: `src/config/warn.ts`
- Create: `__tests__/unit/config/errors.test.ts`

- [ ] **Step 1: 테스트 작성 — ConfigurationError**

```typescript
// __tests__/unit/config/errors.test.ts
import { ConfigurationError } from '../../src/config/errors';

describe('ConfigurationError', () => {
  it('should format message with module name prefix', () => {
    const error = new ConfigurationError('Auth', 'jwtSecret is required');
    expect(error.message).toBe('[Auth] jwtSecret is required');
  });

  it('should set name to ConfigurationError', () => {
    const error = new ConfigurationError('Cache', 'not initialized');
    expect(error.name).toBe('ConfigurationError');
  });

  it('should be instanceof Error', () => {
    const error = new ConfigurationError('Logger', 'test');
    expect(error).toBeInstanceOf(Error);
  });

  it('should include module in message for different modules', () => {
    const error = new ConfigurationError('Storage', 'accountId is required');
    expect(error.message).toContain('[Storage]');
    expect(error.message).toContain('accountId is required');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/config/errors.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/errors'`

- [ ] **Step 3: ConfigurationError 구현**

```typescript
// src/config/errors.ts
export class ConfigurationError extends Error {
  constructor(module: string, message: string) {
    super(`[${module}] ${message}`);
    this.name = 'ConfigurationError';
  }
}
```

- [ ] **Step 4: warn 유틸 구현**

```typescript
// src/config/warn.ts

/**
 * 모듈 초기화 시 선택 설정 누락 warn 로그 출력
 * logger가 아직 초기화되지 않았을 수 있으므로 console.warn fallback
 */
export function configWarn(module: string, message: string): void {
  try {
    // logger가 초기화되어 있으면 사용 시도
    // 순환 의존 방지를 위해 dynamic import는 하지 않고 console.warn 사용
    console.warn(`[${module}] ${message}`);
  } catch {
    console.warn(`[${module}] ${message}`);
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/config/errors.test.ts`
Expected: 4 tests PASS

- [ ] **Step 6: 커밋**

```bash
git add src/config/errors.ts src/config/warn.ts __tests__/unit/config/errors.test.ts
git commit -m "feat(config): add ConfigurationError class and warn utility"
```

---

## Task 2: 공통 설정 (Common Config)

**Files:**
- Create: `src/config/common.ts`
- Create: `__tests__/unit/config/common.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/unit/config/common.test.ts
import { initializeCommon, getCommonConfig, resetCommon } from '../../src/config/common';
import { ConfigurationError } from '../../src/config/errors';

describe('Common Config', () => {
  beforeEach(() => {
    resetCommon();
  });

  describe('getCommonConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getCommonConfig()).toThrow(ConfigurationError);
      expect(() => getCommonConfig()).toThrow('[Common] Not initialized. Call initializeCommon() first.');
    });
  });

  describe('initializeCommon', () => {
    it('should set nodeEnv from config', () => {
      initializeCommon({ nodeEnv: 'production' });
      expect(getCommonConfig().nodeEnv).toBe('production');
    });

    it('should warn and use default when nodeEnv not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeCommon({});
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('nodeEnv not provided'));
      expect(getCommonConfig().nodeEnv).toBe('development');
      spy.mockRestore();
    });

    it('should accept test environment', () => {
      initializeCommon({ nodeEnv: 'test' });
      expect(getCommonConfig().nodeEnv).toBe('test');
    });
  });

  describe('resetCommon', () => {
    it('should reset config so getCommonConfig throws again', () => {
      initializeCommon({ nodeEnv: 'production' });
      expect(getCommonConfig().nodeEnv).toBe('production');
      resetCommon();
      expect(() => getCommonConfig()).toThrow(ConfigurationError);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/config/common.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/config/common.ts
import { ConfigurationError } from './errors';
import { configWarn } from './warn';

export interface CommonConfig {
  nodeEnv?: 'development' | 'production' | 'test';
}

export interface ResolvedCommonConfig {
  nodeEnv: 'development' | 'production' | 'test';
}

let _config: ResolvedCommonConfig | null = null;

export function initializeCommon(config: CommonConfig): void {
  if (!config.nodeEnv) {
    configWarn('Common', 'nodeEnv not provided, using default: development');
  }

  _config = {
    nodeEnv: config.nodeEnv ?? 'development',
  };
}

export function getCommonConfig(): ResolvedCommonConfig {
  if (!_config) {
    throw new ConfigurationError('Common', 'Not initialized. Call initializeCommon() first.');
  }
  return _config;
}

export function resetCommon(): void {
  _config = null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/config/common.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/config/common.ts __tests__/unit/config/common.test.ts
git commit -m "feat(config): add common config with nodeEnv"
```

---

## Task 3: Auth Config

**Files:**
- Create: `src/auth/config.ts`
- Create: `__tests__/unit/config/auth-config.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/unit/config/auth-config.test.ts
import { initializeAuth, getAuthConfig, resetAuth } from '../../src/auth/config';
import { ConfigurationError } from '../../src/config/errors';

describe('Auth Config', () => {
  beforeEach(() => {
    resetAuth();
  });

  describe('getAuthConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getAuthConfig()).toThrow(ConfigurationError);
      expect(() => getAuthConfig()).toThrow('[Auth] Not initialized. Call initializeAuth() first.');
    });
  });

  describe('initializeAuth', () => {
    it('should throw ConfigurationError when jwtSecret is missing', () => {
      expect(() => initializeAuth({} as any)).toThrow(ConfigurationError);
      expect(() => initializeAuth({} as any)).toThrow('jwtSecret is required');
    });

    it('should throw ConfigurationError when jwtSecret is empty string', () => {
      expect(() => initializeAuth({ jwtSecret: '' })).toThrow(ConfigurationError);
    });

    it('should set all values when fully provided', () => {
      initializeAuth({
        jwtSecret: 'my-secret-key-that-is-long-enough-32chars',
        accessTokenExpiry: '1h',
        refreshTokenExpiry: '7d',
      });
      const config = getAuthConfig();
      expect(config.jwtSecret).toBe('my-secret-key-that-is-long-enough-32chars');
      expect(config.accessTokenExpiry).toBe('1h');
      expect(config.refreshTokenExpiry).toBe('7d');
    });

    it('should warn and use default for accessTokenExpiry when not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: 'my-secret-key-that-is-long-enough-32chars' });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('accessTokenExpiry not provided'));
      expect(getAuthConfig().accessTokenExpiry).toBe('7d');
      spy.mockRestore();
    });

    it('should warn and use default for refreshTokenExpiry when not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeAuth({ jwtSecret: 'my-secret-key-that-is-long-enough-32chars' });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('refreshTokenExpiry not provided'));
      expect(getAuthConfig().refreshTokenExpiry).toBe('30d');
      spy.mockRestore();
    });
  });

  describe('resetAuth', () => {
    it('should reset config', () => {
      initializeAuth({ jwtSecret: 'my-secret-key-that-is-long-enough-32chars' });
      resetAuth();
      expect(() => getAuthConfig()).toThrow(ConfigurationError);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/config/auth-config.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/auth/config.ts
import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface AuthConfig {
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
}

export interface ResolvedAuthConfig {
  jwtSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
}

let _config: ResolvedAuthConfig | null = null;

export function initializeAuth(config: AuthConfig): void {
  if (!config.jwtSecret) {
    throw new ConfigurationError('Auth', 'jwtSecret is required');
  }

  if (!config.accessTokenExpiry) {
    configWarn('Auth', 'accessTokenExpiry not provided, using default: 7d');
  }
  if (!config.refreshTokenExpiry) {
    configWarn('Auth', 'refreshTokenExpiry not provided, using default: 30d');
  }

  _config = {
    jwtSecret: config.jwtSecret,
    accessTokenExpiry: config.accessTokenExpiry ?? '7d',
    refreshTokenExpiry: config.refreshTokenExpiry ?? '30d',
  };
}

export function getAuthConfig(): ResolvedAuthConfig {
  if (!_config) {
    throw new ConfigurationError('Auth', 'Not initialized. Call initializeAuth() first.');
  }
  return _config;
}

export function resetAuth(): void {
  _config = null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/config/auth-config.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/auth/config.ts __tests__/unit/config/auth-config.test.ts
git commit -m "feat(config): add auth config with jwtSecret validation"
```

---

## Task 4: Logger Config

**Files:**
- Create: `src/logger/config.ts`
- Create: `__tests__/unit/config/logger-config.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/unit/config/logger-config.test.ts
import { initializeLogger, getLoggerConfig, resetLogger } from '../../src/logger/config';
import { ConfigurationError } from '../../src/config/errors';

describe('Logger Config', () => {
  beforeEach(() => {
    resetLogger();
  });

  describe('getLoggerConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getLoggerConfig()).toThrow(ConfigurationError);
    });
  });

  describe('initializeLogger', () => {
    it('should use all defaults when empty config provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeLogger({});
      const config = getLoggerConfig();
      expect(config.level).toBe('info');
      expect(config.dir).toBe('./logs');
      expect(config.file).toBe('app.log');
      expect(config.fileEnabled).toBe(true);
      expect(config.consoleEnabled).toBe(true);
      spy.mockRestore();
    });

    it('should warn for each missing optional field', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeLogger({});
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('level not provided'));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('dir not provided'));
      spy.mockRestore();
    });

    it('should use provided values without warning', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeLogger({
        level: 'debug',
        dir: '/var/log',
        file: 'custom.log',
        fileEnabled: false,
        consoleEnabled: false,
      });
      const config = getLoggerConfig();
      expect(config.level).toBe('debug');
      expect(config.dir).toBe('/var/log');
      expect(config.file).toBe('custom.log');
      expect(config.fileEnabled).toBe(false);
      expect(config.consoleEnabled).toBe(false);
      // level과 dir에 대한 warn은 호출 안 됨
      const warnCalls = spy.mock.calls.map(c => c[0]);
      expect(warnCalls.filter((c: string) => c.includes('level not provided'))).toHaveLength(0);
      spy.mockRestore();
    });
  });

  describe('resetLogger', () => {
    it('should reset config', () => {
      initializeLogger({});
      resetLogger();
      expect(() => getLoggerConfig()).toThrow(ConfigurationError);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/config/logger-config.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/logger/config.ts
import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface LoggerConfig {
  level?: string;
  dir?: string;
  file?: string;
  fileEnabled?: boolean;
  consoleEnabled?: boolean;
}

export interface ResolvedLoggerConfig {
  level: string;
  dir: string;
  file: string;
  fileEnabled: boolean;
  consoleEnabled: boolean;
}

let _config: ResolvedLoggerConfig | null = null;

export function initializeLogger(config: LoggerConfig): void {
  if (config.level === undefined) {
    configWarn('Logger', 'level not provided, using default: info');
  }
  if (config.dir === undefined) {
    configWarn('Logger', 'dir not provided, using default: ./logs');
  }
  if (config.file === undefined) {
    configWarn('Logger', 'file not provided, using default: app.log');
  }
  if (config.fileEnabled === undefined) {
    configWarn('Logger', 'fileEnabled not provided, using default: true');
  }
  if (config.consoleEnabled === undefined) {
    configWarn('Logger', 'consoleEnabled not provided, using default: true');
  }

  _config = {
    level: config.level ?? 'info',
    dir: config.dir ?? './logs',
    file: config.file ?? 'app.log',
    fileEnabled: config.fileEnabled ?? true,
    consoleEnabled: config.consoleEnabled ?? true,
  };
}

export function getLoggerConfig(): ResolvedLoggerConfig {
  if (!_config) {
    throw new ConfigurationError('Logger', 'Not initialized. Call initializeLogger() first.');
  }
  return _config;
}

export function resetLogger(): void {
  _config = null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/config/logger-config.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/logger/config.ts __tests__/unit/config/logger-config.test.ts
git commit -m "feat(config): add logger config"
```

---

## Task 5: Storage (R2) Config

**Files:**
- Create: `src/storage/config.ts`
- Create: `__tests__/unit/config/storage-config.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/unit/config/storage-config.test.ts
import { initializeStorage, getStorageConfig, resetStorage } from '../../src/storage/config';
import { ConfigurationError } from '../../src/config/errors';

describe('Storage Config', () => {
  beforeEach(() => {
    resetStorage();
  });

  const validConfig = {
    accountId: 'acc-123',
    accessKeyId: 'key-123',
    secretAccessKey: 'secret-123',
    bucketName: 'my-bucket',
  };

  describe('getStorageConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getStorageConfig()).toThrow(ConfigurationError);
    });
  });

  describe('initializeStorage', () => {
    it('should throw when accountId is missing', () => {
      const { accountId, ...rest } = validConfig;
      expect(() => initializeStorage(rest as any)).toThrow('accountId is required');
    });

    it('should throw when accessKeyId is missing', () => {
      const { accessKeyId, ...rest } = validConfig;
      expect(() => initializeStorage(rest as any)).toThrow('accessKeyId is required');
    });

    it('should throw when secretAccessKey is missing', () => {
      const { secretAccessKey, ...rest } = validConfig;
      expect(() => initializeStorage(rest as any)).toThrow('secretAccessKey is required');
    });

    it('should throw when bucketName is missing', () => {
      const { bucketName, ...rest } = validConfig;
      expect(() => initializeStorage(rest as any)).toThrow('bucketName is required');
    });

    it('should set all required values', () => {
      initializeStorage(validConfig);
      const config = getStorageConfig();
      expect(config.accountId).toBe('acc-123');
      expect(config.accessKeyId).toBe('key-123');
      expect(config.secretAccessKey).toBe('secret-123');
      expect(config.bucketName).toBe('my-bucket');
    });

    it('should handle optional publicUrl', () => {
      initializeStorage({ ...validConfig, publicUrl: 'https://cdn.example.com' });
      expect(getStorageConfig().publicUrl).toBe('https://cdn.example.com');
    });

    it('should set publicUrl to undefined when not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeStorage(validConfig);
      expect(getStorageConfig().publicUrl).toBeUndefined();
      spy.mockRestore();
    });
  });

  describe('resetStorage', () => {
    it('should reset config', () => {
      initializeStorage(validConfig);
      resetStorage();
      expect(() => getStorageConfig()).toThrow(ConfigurationError);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/config/storage-config.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/storage/config.ts
import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

export interface ResolvedStorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

let _config: ResolvedStorageConfig | null = null;

export function initializeStorage(config: StorageConfig): void {
  if (!config.accountId) {
    throw new ConfigurationError('Storage', 'accountId is required');
  }
  if (!config.accessKeyId) {
    throw new ConfigurationError('Storage', 'accessKeyId is required');
  }
  if (!config.secretAccessKey) {
    throw new ConfigurationError('Storage', 'secretAccessKey is required');
  }
  if (!config.bucketName) {
    throw new ConfigurationError('Storage', 'bucketName is required');
  }

  if (config.publicUrl === undefined) {
    configWarn('Storage', 'publicUrl not provided');
  }

  _config = {
    accountId: config.accountId,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucketName: config.bucketName,
    publicUrl: config.publicUrl,
  };
}

export function getStorageConfig(): ResolvedStorageConfig {
  if (!_config) {
    throw new ConfigurationError('Storage', 'Not initialized. Call initializeStorage() first.');
  }
  return _config;
}

export function resetStorage(): void {
  _config = null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/config/storage-config.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/storage/config.ts __tests__/unit/config/storage-config.test.ts
git commit -m "feat(config): add storage (R2) config with required field validation"
```

---

## Task 6: Geolocation Config

**Files:**
- Create: `src/geolocation/config.ts`
- Create: `__tests__/unit/config/geolocation-config.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/unit/config/geolocation-config.test.ts
import { initializeGeolocation, getGeolocationConfig, resetGeolocation } from '../../src/geolocation/config';
import { ConfigurationError } from '../../src/config/errors';

describe('Geolocation Config', () => {
  beforeEach(() => {
    resetGeolocation();
  });

  describe('getGeolocationConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getGeolocationConfig()).toThrow(ConfigurationError);
    });
  });

  describe('initializeGeolocation', () => {
    it('should accept empty config (all optional)', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeGeolocation({});
      const config = getGeolocationConfig();
      expect(config.ipgeolocationApiKey).toBeUndefined();
      expect(config.maxmindLicenseKey).toBeUndefined();
      spy.mockRestore();
    });

    it('should warn when no API keys provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeGeolocation({});
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('ipgeolocationApiKey not provided'));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('maxmindLicenseKey not provided'));
      spy.mockRestore();
    });

    it('should set API keys when provided', () => {
      initializeGeolocation({
        ipgeolocationApiKey: 'geo-key',
        maxmindLicenseKey: 'maxmind-key',
      });
      const config = getGeolocationConfig();
      expect(config.ipgeolocationApiKey).toBe('geo-key');
      expect(config.maxmindLicenseKey).toBe('maxmind-key');
    });
  });

  describe('resetGeolocation', () => {
    it('should reset config', () => {
      initializeGeolocation({});
      resetGeolocation();
      expect(() => getGeolocationConfig()).toThrow(ConfigurationError);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/config/geolocation-config.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/geolocation/config.ts
import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface GeolocationConfig {
  ipgeolocationApiKey?: string;
  maxmindLicenseKey?: string;
}

export interface ResolvedGeolocationConfig {
  ipgeolocationApiKey?: string;
  maxmindLicenseKey?: string;
}

let _config: ResolvedGeolocationConfig | null = null;

export function initializeGeolocation(config: GeolocationConfig): void {
  if (!config.ipgeolocationApiKey) {
    configWarn('Geolocation', 'ipgeolocationApiKey not provided, IPGeolocation provider will be unavailable');
  }
  if (!config.maxmindLicenseKey) {
    configWarn('Geolocation', 'maxmindLicenseKey not provided, MaxMind provider will be unavailable');
  }

  _config = {
    ipgeolocationApiKey: config.ipgeolocationApiKey,
    maxmindLicenseKey: config.maxmindLicenseKey,
  };
}

export function getGeolocationConfig(): ResolvedGeolocationConfig {
  if (!_config) {
    throw new ConfigurationError('Geolocation', 'Not initialized. Call initializeGeolocation() first.');
  }
  return _config;
}

export function resetGeolocation(): void {
  _config = null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/config/geolocation-config.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/geolocation/config.ts __tests__/unit/config/geolocation-config.test.ts
git commit -m "feat(config): add geolocation config"
```

---

## Task 7: CORS Config

**Files:**
- Create: `src/middleware/cors-config.ts`
- Create: `__tests__/unit/config/cors-config.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/unit/config/cors-config.test.ts
import { initializeCors, getCorsConfig, resetCors } from '../../src/middleware/cors-config';
import { ConfigurationError } from '../../src/config/errors';

describe('CORS Config', () => {
  beforeEach(() => {
    resetCors();
  });

  describe('getCorsConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getCorsConfig()).toThrow(ConfigurationError);
    });
  });

  describe('initializeCors', () => {
    it('should throw when allowedOrigins is missing', () => {
      expect(() => initializeCors({} as any)).toThrow('allowedOrigins is required');
    });

    it('should throw when allowedOrigins is empty array', () => {
      expect(() => initializeCors({ allowedOrigins: [] })).toThrow('allowedOrigins must not be empty');
    });

    it('should set allowedOrigins', () => {
      initializeCors({ allowedOrigins: ['https://example.com'] });
      expect(getCorsConfig().allowedOrigins).toEqual(['https://example.com']);
    });

    it('should handle optional baseUrl', () => {
      initializeCors({
        allowedOrigins: ['https://example.com'],
        baseUrl: 'https://api.example.com',
      });
      expect(getCorsConfig().baseUrl).toBe('https://api.example.com');
    });

    it('should warn when baseUrl not provided', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeCors({ allowedOrigins: ['https://example.com'] });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('baseUrl not provided'));
      spy.mockRestore();
    });
  });

  describe('resetCors', () => {
    it('should reset config', () => {
      initializeCors({ allowedOrigins: ['https://example.com'] });
      resetCors();
      expect(() => getCorsConfig()).toThrow(ConfigurationError);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/config/cors-config.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/middleware/cors-config.ts
import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';

export interface CorsConfig {
  allowedOrigins: string[];
  baseUrl?: string;
}

export interface ResolvedCorsConfig {
  allowedOrigins: string[];
  baseUrl?: string;
}

let _config: ResolvedCorsConfig | null = null;

export function initializeCors(config: CorsConfig): void {
  if (!config.allowedOrigins) {
    throw new ConfigurationError('CORS', 'allowedOrigins is required');
  }
  if (config.allowedOrigins.length === 0) {
    throw new ConfigurationError('CORS', 'allowedOrigins must not be empty');
  }

  if (config.baseUrl === undefined) {
    configWarn('CORS', 'baseUrl not provided');
  }

  _config = {
    allowedOrigins: [...config.allowedOrigins],
    baseUrl: config.baseUrl,
  };
}

export function getCorsConfig(): ResolvedCorsConfig {
  if (!_config) {
    throw new ConfigurationError('CORS', 'Not initialized. Call initializeCors() first.');
  }
  return _config;
}

export function resetCors(): void {
  _config = null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/config/cors-config.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/middleware/cors-config.ts __tests__/unit/config/cors-config.test.ts
git commit -m "feat(config): add CORS config with allowedOrigins validation"
```

---

## Task 8: Cache Config (cache-env.ts 대체)

**Files:**
- Create: `src/cache/config.ts`
- Create: `__tests__/unit/config/cache-config.test.ts`

캐시는 설정이 방대하므로, 기존 `cache-defaults.ts`의 상수를 그대로 활용합니다.

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/unit/config/cache-config.test.ts
import { initializeCache, getResolvedCacheConfig, resetCache } from '../../src/cache/config';
import { ConfigurationError } from '../../src/config/errors';
import { INMEMORY_CACHE_DEFAULTS, CACHE_TTL_DEFAULTS } from '../../src/cache/cache-defaults';

describe('Cache Config', () => {
  beforeEach(() => {
    resetCache();
  });

  describe('getResolvedCacheConfig', () => {
    it('should throw ConfigurationError when not initialized', () => {
      expect(() => getResolvedCacheConfig()).toThrow(ConfigurationError);
    });
  });

  describe('initializeCache', () => {
    it('should accept minimal config with defaults', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      initializeCache({});
      const config = getResolvedCacheConfig();
      expect(config.enabled).toBe(true);
      expect(config.inmemory.enabled).toBe(true);
      expect(config.inmemory.maxSize).toBe(INMEMORY_CACHE_DEFAULTS.MAX_SIZE);
      expect(config.inmemory.eviction).toBe('lru');
      expect(config.ttl.DEFAULT).toBe(CACHE_TTL_DEFAULTS.DEFAULT);
      spy.mockRestore();
    });

    it('should throw when redis.url is missing but redis provided', () => {
      expect(() => initializeCache({
        redis: { token: 'token-123' } as any,
      })).toThrow('redis.url is required');
    });

    it('should throw when redis.token is missing but redis provided', () => {
      expect(() => initializeCache({
        redis: { url: 'https://redis.example.com' } as any,
      })).toThrow('redis.token is required');
    });

    it('should set redis config when fully provided', () => {
      initializeCache({
        redis: {
          url: 'https://redis.example.com',
          token: 'token-123',
        },
      });
      const config = getResolvedCacheConfig();
      expect(config.redis!.url).toBe('https://redis.example.com');
      expect(config.redis!.token).toBe('token-123');
      expect(config.redis!.enabled).toBe(true);
    });

    it('should override TTL defaults', () => {
      initializeCache({
        ttl: { DEFAULT: 120, SHORT: 30 },
      });
      const config = getResolvedCacheConfig();
      expect(config.ttl.DEFAULT).toBe(120);
      expect(config.ttl.SHORT).toBe(30);
      // 나머지는 기본값 유지
      expect(config.ttl.LONG).toBe(CACHE_TTL_DEFAULTS.LONG);
    });

    it('should disable cache when enabled is false', () => {
      initializeCache({ enabled: false });
      expect(getResolvedCacheConfig().enabled).toBe(false);
    });
  });

  describe('resetCache', () => {
    it('should reset config', () => {
      initializeCache({});
      resetCache();
      expect(() => getResolvedCacheConfig()).toThrow(ConfigurationError);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/config/cache-config.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/cache/config.ts
import { ConfigurationError } from '../config/errors';
import { configWarn } from '../config/warn';
import {
  INMEMORY_CACHE_DEFAULTS,
  CACHE_TTL_DEFAULTS,
  CACHE_DURATION_DEFAULTS,
  CACHE_FALLBACK_DEFAULTS,
  CACHE_HEALTH_DEFAULTS,
} from './cache-defaults';

// ============================================================================
// Config interfaces
// ============================================================================

export interface CacheRedisConfig {
  url: string;
  token: string;
  enabled?: boolean;
}

export interface CacheInmemoryConfig {
  enabled?: boolean;
  maxSize?: number;
  maxMb?: number;
  eviction?: 'lru' | 'fifo' | 'ttl';
  cleanupInterval?: number;
}

export interface CacheTTLConfig {
  DEFAULT?: number;
  SHORT?: number;
  LONG?: number;
  GEOIP?: number;
  SETTINGS?: number;
  ANALYTICS?: number;
  USER?: number;
  LINK?: number;
  ALIAS?: number;
  COMMUNITY?: number;
  RESERVED_WORDS?: number;
}

export interface CacheCategoryConfig {
  enabled?: boolean;
  duration?: number;
}

export interface CacheFallbackInput {
  redisErrorThresholdGlobal?: number;
  redisErrorThresholdLocal?: number;
  redisReconnectInterval?: number;
  fallbackOnRedisError?: boolean;
  writeToMemory?: boolean;
}

export interface CacheHealthInput {
  errorRateThreshold?: number;
  hitRateThreshold?: number;
  reportHitRateThreshold?: number;
  reportResponseTimeThreshold?: number;
  reportInvalidationThreshold?: number;
  reportMinRequests?: number;
}

export interface CacheConfigInput {
  enabled?: boolean;
  redis?: CacheRedisConfig;
  inmemory?: CacheInmemoryConfig;
  ttl?: CacheTTLConfig;
  categories?: Partial<Record<string, CacheCategoryConfig>>;
  fallback?: CacheFallbackInput;
  health?: CacheHealthInput;
}

// ============================================================================
// Resolved types (all fields have values)
// ============================================================================

export interface ResolvedCacheRedisConfig {
  url: string;
  token: string;
  enabled: boolean;
}

export interface ResolvedCacheInmemoryConfig {
  enabled: boolean;
  maxSize: number;
  maxMb: number;
  eviction: 'lru' | 'fifo' | 'ttl';
  cleanupInterval: number;
}

export interface ResolvedCacheTTLConfig {
  DEFAULT: number;
  SHORT: number;
  LONG: number;
  GEOIP: number;
  SETTINGS: number;
  ANALYTICS: number;
  USER: number;
  LINK: number;
  ALIAS: number;
  COMMUNITY: number;
  RESERVED_WORDS: number;
}

export interface ResolvedCacheCategoryConfig {
  enabled: boolean;
  duration: number;
}

export interface ResolvedCacheFallbackConfig {
  redisErrorThresholdGlobal: number;
  redisErrorThresholdLocal: number;
  redisReconnectInterval: number;
  fallbackOnRedisError: boolean;
  writeToMemory: boolean;
}

export interface ResolvedCacheHealthConfig {
  errorRateThreshold: number;
  hitRateThreshold: number;
  reportHitRateThreshold: number;
  reportResponseTimeThreshold: number;
  reportInvalidationThreshold: number;
  reportMinRequests: number;
}

export interface ResolvedCacheConfig {
  enabled: boolean;
  redis?: ResolvedCacheRedisConfig;
  inmemory: ResolvedCacheInmemoryConfig;
  ttl: ResolvedCacheTTLConfig;
  categories: Record<string, ResolvedCacheCategoryConfig>;
  fallback: ResolvedCacheFallbackConfig;
  health: ResolvedCacheHealthConfig;
}

// ============================================================================
// State
// ============================================================================

let _config: ResolvedCacheConfig | null = null;

// ============================================================================
// Initialize
// ============================================================================

export function initializeCache(config: CacheConfigInput): void {
  // Redis 검증: redis 블록이 존재하면 url, token 필수
  if (config.redis) {
    if (!config.redis.url) {
      throw new ConfigurationError('Cache', 'redis.url is required when redis config is provided');
    }
    if (!config.redis.token) {
      throw new ConfigurationError('Cache', 'redis.token is required when redis config is provided');
    }
  }

  if (config.enabled === undefined) {
    configWarn('Cache', 'enabled not provided, using default: true');
  }

  const categories: Record<string, ResolvedCacheCategoryConfig> = {};
  const categoryNames = Object.keys(CACHE_DURATION_DEFAULTS) as Array<keyof typeof CACHE_DURATION_DEFAULTS>;
  for (const name of categoryNames) {
    const input = config.categories?.[name];
    categories[name] = {
      enabled: input?.enabled ?? true,
      duration: input?.duration ?? CACHE_DURATION_DEFAULTS[name],
    };
  }

  _config = {
    enabled: config.enabled ?? true,
    redis: config.redis ? {
      url: config.redis.url,
      token: config.redis.token,
      enabled: config.redis.enabled ?? true,
    } : undefined,
    inmemory: {
      enabled: config.inmemory?.enabled ?? true,
      maxSize: config.inmemory?.maxSize ?? INMEMORY_CACHE_DEFAULTS.MAX_SIZE,
      maxMb: config.inmemory?.maxMb ?? INMEMORY_CACHE_DEFAULTS.MAX_MB,
      eviction: config.inmemory?.eviction ?? INMEMORY_CACHE_DEFAULTS.EVICTION,
      cleanupInterval: config.inmemory?.cleanupInterval ?? INMEMORY_CACHE_DEFAULTS.CLEANUP_INTERVAL,
    },
    ttl: {
      DEFAULT: config.ttl?.DEFAULT ?? CACHE_TTL_DEFAULTS.DEFAULT,
      SHORT: config.ttl?.SHORT ?? CACHE_TTL_DEFAULTS.SHORT,
      LONG: config.ttl?.LONG ?? CACHE_TTL_DEFAULTS.LONG,
      GEOIP: config.ttl?.GEOIP ?? CACHE_TTL_DEFAULTS.GEOIP,
      SETTINGS: config.ttl?.SETTINGS ?? CACHE_TTL_DEFAULTS.SETTINGS,
      ANALYTICS: config.ttl?.ANALYTICS ?? CACHE_TTL_DEFAULTS.ANALYTICS,
      USER: config.ttl?.USER ?? CACHE_TTL_DEFAULTS.USER,
      LINK: config.ttl?.LINK ?? CACHE_TTL_DEFAULTS.LINK,
      ALIAS: config.ttl?.ALIAS ?? CACHE_TTL_DEFAULTS.ALIAS,
      COMMUNITY: config.ttl?.COMMUNITY ?? CACHE_TTL_DEFAULTS.COMMUNITY,
      RESERVED_WORDS: config.ttl?.RESERVED_WORDS ?? CACHE_TTL_DEFAULTS.RESERVED_WORDS,
    },
    categories,
    fallback: {
      redisErrorThresholdGlobal: config.fallback?.redisErrorThresholdGlobal ?? CACHE_FALLBACK_DEFAULTS.REDIS_ERROR_THRESHOLD_GLOBAL,
      redisErrorThresholdLocal: config.fallback?.redisErrorThresholdLocal ?? CACHE_FALLBACK_DEFAULTS.REDIS_ERROR_THRESHOLD_LOCAL,
      redisReconnectInterval: config.fallback?.redisReconnectInterval ?? CACHE_FALLBACK_DEFAULTS.REDIS_RECONNECT_INTERVAL,
      fallbackOnRedisError: config.fallback?.fallbackOnRedisError ?? CACHE_FALLBACK_DEFAULTS.FALLBACK_ON_REDIS_ERROR,
      writeToMemory: config.fallback?.writeToMemory ?? CACHE_FALLBACK_DEFAULTS.WRITE_TO_MEMORY,
    },
    health: {
      errorRateThreshold: config.health?.errorRateThreshold ?? CACHE_HEALTH_DEFAULTS.ERROR_RATE_THRESHOLD,
      hitRateThreshold: config.health?.hitRateThreshold ?? CACHE_HEALTH_DEFAULTS.HIT_RATE_THRESHOLD,
      reportHitRateThreshold: config.health?.reportHitRateThreshold ?? CACHE_HEALTH_DEFAULTS.REPORT_HIT_RATE_THRESHOLD,
      reportResponseTimeThreshold: config.health?.reportResponseTimeThreshold ?? CACHE_HEALTH_DEFAULTS.REPORT_RESPONSE_TIME_THRESHOLD,
      reportInvalidationThreshold: config.health?.reportInvalidationThreshold ?? CACHE_HEALTH_DEFAULTS.REPORT_INVALIDATION_THRESHOLD,
      reportMinRequests: config.health?.reportMinRequests ?? CACHE_HEALTH_DEFAULTS.REPORT_MIN_REQUESTS,
    },
  };
}

export function getResolvedCacheConfig(): ResolvedCacheConfig {
  if (!_config) {
    throw new ConfigurationError('Cache', 'Not initialized. Call initializeCache() first.');
  }
  return _config;
}

export function resetCache(): void {
  _config = null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/config/cache-config.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/cache/config.ts __tests__/unit/config/cache-config.test.ts
git commit -m "feat(config): add cache config replacing process.env reads"
```

---

## Task 9: 통합 initialize 함수

**Files:**
- Create: `src/initialize.ts`
- Create: `__tests__/unit/initialize.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/unit/initialize.test.ts
import { initialize } from '../../src/initialize';
import { getCommonConfig, resetCommon } from '../../src/config/common';
import { getAuthConfig, resetAuth } from '../../src/auth/config';
import { getLoggerConfig, resetLogger } from '../../src/logger/config';
import { getResolvedCacheConfig, resetCache } from '../../src/cache/config';
import { getStorageConfig, resetStorage } from '../../src/storage/config';
import { getGeolocationConfig, resetGeolocation } from '../../src/geolocation/config';
import { getCorsConfig, resetCors } from '../../src/middleware/cors-config';
import { ConfigurationError } from '../../src/config/errors';

describe('initialize', () => {
  beforeEach(() => {
    resetCommon();
    resetAuth();
    resetLogger();
    resetCache();
    resetStorage();
    resetGeolocation();
    resetCors();
  });

  it('should initialize all modules when full config provided', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initialize({
      nodeEnv: 'production',
      auth: { jwtSecret: 'a-very-long-secret-key-for-testing-32ch' },
      logger: { level: 'error' },
      cache: { enabled: true },
      storage: {
        accountId: 'acc',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucketName: 'bucket',
      },
      geolocation: { ipgeolocationApiKey: 'geo-key' },
      cors: { allowedOrigins: ['https://example.com'] },
    });

    expect(getCommonConfig().nodeEnv).toBe('production');
    expect(getAuthConfig().jwtSecret).toBe('a-very-long-secret-key-for-testing-32ch');
    expect(getLoggerConfig().level).toBe('error');
    expect(getResolvedCacheConfig().enabled).toBe(true);
    expect(getStorageConfig().accountId).toBe('acc');
    expect(getGeolocationConfig().ipgeolocationApiKey).toBe('geo-key');
    expect(getCorsConfig().allowedOrigins).toEqual(['https://example.com']);
    spy.mockRestore();
  });

  it('should only initialize provided modules', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initialize({
      nodeEnv: 'test',
      auth: { jwtSecret: 'a-very-long-secret-key-for-testing-32ch' },
    });

    expect(getCommonConfig().nodeEnv).toBe('test');
    expect(getAuthConfig().jwtSecret).toBe('a-very-long-secret-key-for-testing-32ch');
    // 나머지 모듈은 초기화되지 않음
    expect(() => getResolvedCacheConfig()).toThrow(ConfigurationError);
    expect(() => getStorageConfig()).toThrow(ConfigurationError);
    spy.mockRestore();
  });

  it('should initialize common first even with empty config', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initialize({});
    expect(getCommonConfig().nodeEnv).toBe('development');
    spy.mockRestore();
  });

  it('should propagate ConfigurationError from module', () => {
    expect(() => initialize({
      auth: { jwtSecret: '' },
    })).toThrow(ConfigurationError);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- __tests__/unit/initialize.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
// src/initialize.ts
import { initializeCommon } from './config/common';
import type { CommonConfig } from './config/common';
import { initializeAuth } from './auth/config';
import type { AuthConfig } from './auth/config';
import { initializeLogger } from './logger/config';
import type { LoggerConfig } from './logger/config';
import { initializeCache } from './cache/config';
import type { CacheConfigInput } from './cache/config';
import { initializeStorage } from './storage/config';
import type { StorageConfig } from './storage/config';
import { initializeGeolocation } from './geolocation/config';
import type { GeolocationConfig } from './geolocation/config';
import { initializeCors } from './middleware/cors-config';
import type { CorsConfig } from './middleware/cors-config';

export interface ToolkitConfig {
  nodeEnv?: CommonConfig['nodeEnv'];
  auth?: AuthConfig;
  logger?: LoggerConfig;
  cache?: CacheConfigInput;
  storage?: StorageConfig;
  geolocation?: GeolocationConfig;
  cors?: CorsConfig;
}

export function initialize(config: ToolkitConfig): void {
  // 1. 공통 설정 먼저
  initializeCommon({ nodeEnv: config.nodeEnv });

  // 2. Logger 두 번째 (다른 모듈의 warn이 logger를 사용할 수 있도록)
  if (config.logger) {
    initializeLogger(config.logger);
  }

  // 3. 나머지 모듈
  if (config.auth) {
    initializeAuth(config.auth);
  }
  if (config.cache) {
    initializeCache(config.cache);
  }
  if (config.storage) {
    initializeStorage(config.storage);
  }
  if (config.geolocation) {
    initializeGeolocation(config.geolocation);
  }
  if (config.cors) {
    initializeCors(config.cors);
  }
}

// Re-export types for consumer convenience
export type {
  AuthConfig,
  LoggerConfig,
  CacheConfigInput as CacheConfig,
  StorageConfig,
  GeolocationConfig,
  CorsConfig,
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- __tests__/unit/initialize.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/initialize.ts __tests__/unit/initialize.test.ts
git commit -m "feat(config): add unified initialize() function"
```

---

## Task 10: 빌드 설정 및 exports 업데이트

**Files:**
- Modify: `tsup.config.ts`
- Modify: `package.json`

- [ ] **Step 1: tsup.config.ts에 새 entry 추가**

`tsup.config.ts`의 `entry` 배열에 추가:

```typescript
entry: [
  "src/initialize.ts",        // 추가
  "src/config/**/*.ts",       // 추가
  "src/auth/**/*.ts",
  "src/cache/**/*.ts",
  // ... 기존 유지
],
```

- [ ] **Step 2: package.json exports 추가**

`package.json`의 `exports` 필드에 추가:

```json
"./initialize": "./dist/initialize.js",
"./config/errors": "./dist/config/errors.js",
"./config/common": "./dist/config/common.js",
"./auth/config": "./dist/auth/config.js",
"./cache/config": "./dist/cache/config.js",
"./logger/config": "./dist/logger/config.js",
"./storage/config": "./dist/storage/config.js",
"./geolocation/config": "./dist/geolocation/config.js",
"./middleware/cors-config": "./dist/middleware/cors-config.js",
```

- [ ] **Step 3: 빌드 테스트**

Run: `npm run build`
Expected: 빌드 성공, `dist/initialize.js`, `dist/config/errors.js` 등 생성

- [ ] **Step 4: 커밋**

```bash
git add tsup.config.ts package.json
git commit -m "chore: add config DI entries to build and package exports"
```

---

## Task 11: src/middleware/auth.ts에서 process.env 제거

**Files:**
- Modify: `src/middleware/auth.ts:73-117`

- [ ] **Step 1: getJWTManager()에서 process.env 제거**

`src/middleware/auth.ts`의 `getJWTManager()` 함수를 수정:

기존 코드 (라인 73-118):
```typescript
function getJWTManager(): JWTManager | null {
  if (!_jwtManager) {
    const secret = process.env.JWT_SECRET;
    // ...
    _jwtManager = new JWTManager({
      secret: secret,
      accessTokenExpiry: process.env.JWT_EXPIRES_IN || "7d",
      refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || "30d",
      // ...
    });
  }
  return _jwtManager;
}
```

새 코드:
```typescript
import { getAuthConfig } from '../auth/config';

function getJWTManager(): JWTManager | null {
  if (!_jwtManager) {
    let authConfig;
    try {
      authConfig = getAuthConfig();
    } catch {
      if (!_jwtWarningLogged) {
        winstonLogger.warn(
          "[Auth Middleware] Auth not initialized. Authentication is DISABLED.\n" +
            "Call initializeAuth() or initialize() to enable auth.",
        );
        _jwtWarningLogged = true;
      }
      return null;
    }

    if (authConfig.jwtSecret.length < 32) {
      winstonLogger.error(
        "[Auth Middleware] JWT_SECRET must be at least 32 characters long",
      );
      return null;
    }

    _jwtManager = new JWTManager(
      {
        secret: authConfig.jwtSecret,
        accessTokenExpiry: authConfig.accessTokenExpiry,
        refreshTokenExpiry: authConfig.refreshTokenExpiry,
        algorithm: "HS256",
      },
      {
        debug: (msg: string, meta?: any) =>
          winstonLogger.debug(`[Auth] ${msg}`, meta),
        info: (msg: string, meta?: any) =>
          winstonLogger.info(`[Auth] ${msg}`, meta),
        warn: (msg: string, meta?: any) =>
          winstonLogger.warn(`[Auth] ${msg}`, meta),
        error: (msg: string, meta?: any) =>
          winstonLogger.error(`[Auth] ${msg}`, meta),
      },
    );

    winstonLogger.info(
      `[Auth Middleware] ✅ Initialized - Access: ${authConfig.accessTokenExpiry}, Refresh: ${authConfig.refreshTokenExpiry}`,
    );
  }

  return _jwtManager;
}
```

- [ ] **Step 2: initializeAuthMiddleware에서 process.env 참조 제거**

같은 파일에서 `initializeAuthMiddleware()` 함수 내의 `process.env.JWT_SECRET` 참조도 `getAuthConfig()` 사용으로 교체.

- [ ] **Step 3: 기존 테스트 확인**

Run: `npm test -- __tests__/unit/middleware/`
Expected: 기존 테스트는 `initializeAuth()` 호출을 `beforeEach`에 추가해야 할 수 있음

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add src/middleware/auth.ts
git commit -m "refactor(auth): replace process.env with getAuthConfig() in auth middleware"
```

---

## Task 12: src/middleware/cors.ts 및 src/utils/cors.ts에서 process.env 제거

**Files:**
- Modify: `src/middleware/cors.ts:109-136`
- Modify: `src/utils/cors.ts:25,71-72,89-90,110,123`

- [ ] **Step 1: src/middleware/cors.ts 수정**

기존 deprecated `corsMiddleware` export에서 `process.env.ALLOWED_ORIGINS` 제거:

```typescript
import { getCorsConfig } from './cors-config';

// 기존: process.env.ALLOWED_ORIGINS?.split(',')
// 새: getCorsConfig()에서 읽기
export const corsMiddleware: TApiMiddleware = createCorsMiddleware({
  allowedOrigins: (() => {
    try {
      return getCorsConfig().allowedOrigins;
    } catch {
      return [];
    }
  })(),
});
```

`validateCorsConfiguration()` 내의 `process.env.ALLOWED_ORIGINS` 참조도 동일하게 교체.

- [ ] **Step 2: src/utils/cors.ts 수정**

전역 초기화 및 `getAllowedOrigins()`에서 `process.env` 제거:

```typescript
import { getCommonConfig } from '../config/common';
import { getCorsConfig } from '../middleware/cors-config';

// 기존: isDevelopment: process.env.NODE_ENV === 'development'
// 새: getCommonConfig()에서 읽기

// getAllowedOrigins() 내부:
// 기존: if (process.env.ALLOWED_ORIGINS) { ... }
// 새: getCorsConfig().allowedOrigins에서 읽기

// 기존: process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL
// 새: getCorsConfig().baseUrl에서 읽기

// 기존: process.env.NODE_ENV === 'development'
// 새: getCommonConfig().nodeEnv === 'development'
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add src/middleware/cors.ts src/utils/cors.ts
git commit -m "refactor(cors): replace process.env with getCorsConfig() and getCommonConfig()"
```

---

## Task 13: src/middleware/error-handler.ts에서 process.env 제거

**Files:**
- Modify: `src/middleware/error-handler.ts:98`

- [ ] **Step 1: NODE_ENV 참조 교체**

```typescript
import { getCommonConfig } from '../config/common';

// 기존 (라인 98):
// const isProduction = process.env.NODE_ENV === 'production';

// 새:
let isProduction = false;
try {
  isProduction = getCommonConfig().nodeEnv === 'production';
} catch {
  // 초기화 전이면 development로 간주
  isProduction = false;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add src/middleware/error-handler.ts
git commit -m "refactor(middleware): replace process.env.NODE_ENV with getCommonConfig() in error handler"
```

---

## Task 14: src/logger/logger.ts에서 process.env 제거

**Files:**
- Modify: `src/logger/logger.ts:31-63`

- [ ] **Step 1: 환경변수 destructuring 제거 및 config 사용**

```typescript
import { getLoggerConfig } from './config';
import { getCommonConfig } from '../config/common';

// 기존 (라인 31-38):
// const { LOG_DIR, LOG_FILE, ... } = process.env;

// 새: lazy getter 패턴
function getLogConfig() {
  try {
    return getLoggerConfig();
  } catch {
    // 초기화 전 fallback (logger는 다른 모듈보다 먼저 사용될 수 있음)
    return {
      level: 'info',
      dir: './logs',
      file: 'app.log',
      fileEnabled: true,
      consoleEnabled: true,
    };
  }
}

// 테스트/빌드 환경 감지:
// 기존: process.env.NODE_ENV === 'test' || process.env.VITEST !== undefined
// 새: getCommonConfig().nodeEnv === 'test' (fallback 필요)
```

주의: logger는 다른 모듈의 초기화 warn을 출력하는 역할이므로, 초기화 전에도 fallback이 동작해야 합니다. `process.env.VITEST`, `process.env.JEST_WORKER_ID`, `process.env.NEXT_PHASE`는 런타임 감지용이므로 유지해도 됩니다 (라이브러리 설정이 아닌 환경 감지).

- [ ] **Step 2: logger 내부에서 config 참조 교체**

winston 설정에서 `LOG_DIR`, `LOG_FILE`, `LOG_LEVEL` 등을 `getLogConfig()`로 교체.

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 기존 테스트 확인**

Run: `npm test -- __tests__/unit/logger/`
Expected: 기존 테스트에 `initializeLogger()` 추가 필요할 수 있음

- [ ] **Step 5: 커밋**

```bash
git add src/logger/logger.ts
git commit -m "refactor(logger): replace process.env.LOG_* with getLoggerConfig()"
```

---

## Task 15: src/storage/r2-storage.ts에서 process.env 제거

**Files:**
- Modify: `src/storage/r2-storage.ts:29-45`

- [ ] **Step 1: getConfig() 함수 교체**

```typescript
import { getStorageConfig } from './config';
import type { ResolvedStorageConfig } from './config';

// 기존 getConfig():
// const accountId = process.env.R2_ACCOUNT_ID;
// ...

// 새 getConfig():
function getConfig(): R2Config | null {
  if (r2Config) return r2Config;

  let storageConfig: ResolvedStorageConfig;
  try {
    storageConfig = getStorageConfig();
  } catch {
    return null;  // Storage 미초기화 = R2 비활성
  }

  r2Config = {
    accountId: storageConfig.accountId,
    accessKeyId: storageConfig.accessKeyId,
    secretAccessKey: storageConfig.secretAccessKey,
    bucketName: storageConfig.bucketName,
    publicUrl: storageConfig.publicUrl,
  };
  return r2Config;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add src/storage/r2-storage.ts
git commit -m "refactor(storage): replace process.env.R2_* with getStorageConfig()"
```

---

## Task 16: Geolocation providers에서 process.env 제거

**Files:**
- Modify: `src/geolocation/providers/ipgeolocation-provider.ts:18,48`
- Modify: `src/geolocation/providers/maxmind-provider.ts:30`

- [ ] **Step 1: ipgeolocation-provider.ts 수정**

```typescript
import { getGeolocationConfig } from '../config';

// 기존:
// const apiKey = process.env.IPGEOLOCATION_API_KEY;
// 새:
url(ip: string): string {
  let apiKey: string | undefined;
  try {
    apiKey = getGeolocationConfig().ipgeolocationApiKey;
  } catch {
    return '';
  }
  if (!apiKey) return '';
  return `https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&ip=${ip}`;
}

isAvailable(): boolean {
  try {
    return !!getGeolocationConfig().ipgeolocationApiKey;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: maxmind-provider.ts 수정**

```typescript
import { getGeolocationConfig } from '../config';

// 기존:
// return !!process.env.MAXMIND_LICENSE_KEY;
// 새:
isAvailable(): boolean {
  try {
    return !!getGeolocationConfig().maxmindLicenseKey;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add src/geolocation/providers/ipgeolocation-provider.ts src/geolocation/providers/maxmind-provider.ts
git commit -m "refactor(geolocation): replace process.env with getGeolocationConfig() in providers"
```

---

## Task 17: src/cache/cache-env.ts에서 process.env 제거

**Files:**
- Modify: `src/cache/cache-env.ts`

이 파일은 가장 큰 변경입니다. 기존 `getDefaultConfig()`의 `process.env` 읽기를 전부 `getResolvedCacheConfig()`로 교체합니다.

- [ ] **Step 1: 기존 함수들을 새 config에서 읽도록 교체**

`getDefaultConfig()` 함수 제거 — `getResolvedCacheConfig()` (from `./config.ts`)가 대체합니다.

`getConfig()` 함수를 수정:
```typescript
import { getResolvedCacheConfig } from './config';
import type { ResolvedCacheConfig } from './config';

// 기존 _injectedConfig 패턴 제거
// getConfig()는 getResolvedCacheConfig()의 결과를 기존 ISharedEnvConfig 형태로 변환하는 어댑터로 유지
// 또는 cache-env.ts 내부 소비자들을 직접 getResolvedCacheConfig()으로 전환

export function getConfig(): ISharedEnvConfig {
  const cc = getResolvedCacheConfig();
  return {
    env: {
      NODE_ENV: (() => { try { return getCommonConfig().nodeEnv; } catch { return 'development'; } })(),
      UPSTASH_REDIS_REST_URL: cc.redis?.url,
      UPSTASH_REDIS_REST_TOKEN: cc.redis?.token,
      CACHE_ENABLED: cc.enabled,
    },
    ENV: {
      REDIS: {
        URL: cc.redis?.url,
        TOKEN: cc.redis?.token,
        IS_AVAILABLE: !!cc.redis?.url && !!cc.redis?.token,
        ENABLED: cc.redis?.enabled ?? false,
      },
      CACHE: {
        ENABLED: cc.enabled,
        REDIS: { ENABLED: cc.redis?.enabled ?? false },
        INMEMORY: {
          ENABLED: cc.inmemory.enabled,
          MAX_SIZE: cc.inmemory.maxSize,
          MAX_MB: cc.inmemory.maxMb,
          EVICTION: cc.inmemory.eviction,
          CLEANUP_INTERVAL: cc.inmemory.cleanupInterval,
        },
        TTL: cc.ttl,
        ...Object.fromEntries(
          Object.entries(cc.categories).map(([k, v]) => [
            k, { ENABLED: v.enabled, DURATION: v.duration }
          ])
        ),
      } as any,
    },
    isCacheEnabled: () => cc.enabled,
    isRedisAvailable: () => !!cc.redis?.url && !!cc.redis?.token,
  };
}
```

- [ ] **Step 2: initializeCache() 함수를 제거하고 새 config 모듈로 위임**

기존 `initializeCache(config: ISharedEnvConfig)` → deprecated로 표시하고 새 `initializeCache` (from `./config.ts`)로 위임. 또는 기존 내보내기를 유지하면서 내부적으로 새 config 사용.

- [ ] **Step 3: process.env 참조가 남아 있지 않은지 확인**

Run: `grep -n 'process\.env' src/cache/cache-env.ts`
Expected: 0 결과

- [ ] **Step 4: 기존 캐시 테스트 실행**

Run: `npm test -- __tests__/performance/cache/ __tests__/integration/`
Expected: 기존 테스트에 `initializeCache()` 호출 추가 필요

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add src/cache/cache-env.ts
git commit -m "refactor(cache): remove process.env from cache-env.ts, delegate to cache/config.ts"
```

---

## Task 18: src/system/ 모듈에서 process.env 제거

**Files:**
- Modify: `src/system/environment.ts:13-19,21-25,31-50`
- Modify: `src/system/health-check.ts:83,86-87`

- [ ] **Step 1: environment.ts 수정**

`checkEnvironmentVariables()` 함수에서 `process.env` 직접 읽기를 각 모듈 config에서 읽기로 전환:

```typescript
import { getAuthConfig } from '../auth/config';
import { getResolvedCacheConfig } from '../cache/config';
import { getGeolocationConfig } from '../geolocation/config';

export function checkEnvironmentVariables(): IEnvironmentInfo[] {
  const results: IEnvironmentInfo[] = [];

  // Auth config 확인
  try {
    const auth = getAuthConfig();
    results.push({ key: 'JWT_SECRET', ok: true, value: auth.jwtSecret.substring(0, 20) + '...' });
  } catch {
    results.push({ key: 'JWT_SECRET', ok: false });
  }

  // Cache/Redis config 확인
  try {
    const cache = getResolvedCacheConfig();
    results.push({ key: 'CACHE_ENABLED', ok: true, value: String(cache.enabled) });
    if (cache.redis) {
      results.push({ key: 'UPSTASH_REDIS_REST_URL', ok: true, value: cache.redis.url.substring(0, 20) + '...' });
      results.push({ key: 'UPSTASH_REDIS_REST_TOKEN', ok: true, value: '***' });
    } else {
      results.push({ key: 'UPSTASH_REDIS_REST_URL', ok: false });
      results.push({ key: 'UPSTASH_REDIS_REST_TOKEN', ok: false });
    }
  } catch {
    results.push({ key: 'CACHE_ENABLED', ok: false });
  }

  // Geolocation config 확인
  try {
    const geo = getGeolocationConfig();
    results.push({ key: 'IPGEOLOCATION_API_KEY', ok: !!geo.ipgeolocationApiKey });
    results.push({ key: 'MAXMIND_LICENSE_KEY', ok: !!geo.maxmindLicenseKey });
  } catch {
    results.push({ key: 'IPGEOLOCATION_API_KEY', ok: false });
    results.push({ key: 'MAXMIND_LICENSE_KEY', ok: false });
  }

  // 시스템 정보 (os 모듈은 유지 — 이것은 환경변수가 아님)
  // ... 기존 os.hostname(), os.homedir() 등은 그대로 유지
  return results;
}
```

- [ ] **Step 2: health-check.ts 수정**

```typescript
import { getResolvedCacheConfig } from '../cache/config';

// 기존:
// const cacheEnabled = process.env.CACHE_ENABLED !== 'false';
// 새:
let cacheEnabled = false;
try {
  cacheEnabled = getResolvedCacheConfig().enabled;
} catch {
  cacheEnabled = false;
}

// 기존:
// const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
// 새:
let redisUrl: string | undefined;
let redisToken: string | undefined;
try {
  const cacheConfig = getResolvedCacheConfig();
  redisUrl = cacheConfig.redis?.url;
  redisToken = cacheConfig.redis?.token;
} catch {
  // cache 미초기화
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add src/system/environment.ts src/system/health-check.ts
git commit -m "refactor(system): replace process.env with module configs in environment and health-check"
```

---

## Task 19: 전체 process.env 제거 확인 및 정리

**Files:**
- All `src/` files

- [ ] **Step 1: 남은 process.env 참조 검색**

Run: `grep -rn 'process\.env' src/ --include='*.ts' | grep -v 'node_modules' | grep -v '.test.'`

Expected: 다음만 남아야 합니다:
- `src/logger/logger.ts` — `process.env.VITEST`, `process.env.JEST_WORKER_ID`, `process.env.NEXT_PHASE` (환경 감지용, 라이브러리 설정 아님)

다른 `process.env` 참조가 있으면 제거합니다.

- [ ] **Step 2: 전체 테스트 실행**

Run: `npm test`
Expected: 기존 테스트 중 `process.env` 조작하던 테스트에서 실패할 수 있음 → 다음 Task에서 수정

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: remove remaining process.env references from library code"
```

---

## Task 20: 기존 테스트를 DI 패턴으로 마이그레이션

**Files:**
- Modify: 기존 테스트 파일들 (process.env 조작 → initialize 호출)

- [ ] **Step 1: 테스트에서 process.env 사용 검색**

Run: `grep -rn 'process\.env' __tests__/ --include='*.ts' --include='*.tsx'`

각 테스트 파일에서 `process.env.XXX = 'value'` 패턴을 `initializeXxx()` 호출로 교체.

- [ ] **Step 2: 공통 테스트 헬퍼 추가**

`__tests__/setup.ts`에 전역 초기화 추가:

```typescript
import { initialize } from '../src/initialize';
import { resetCommon } from '../src/config/common';
import { resetAuth } from '../src/auth/config';
import { resetLogger } from '../src/logger/config';
import { resetCache } from '../src/cache/config';
import { resetStorage } from '../src/storage/config';
import { resetGeolocation } from '../src/geolocation/config';
import { resetCors } from '../src/middleware/cors-config';

// 각 테스트 전 모든 config 리셋
beforeEach(() => {
  resetCommon();
  resetAuth();
  resetLogger();
  resetCache();
  resetStorage();
  resetGeolocation();
  resetCors();
});
```

- [ ] **Step 3: 각 테스트 파일 수정**

예시 — `__tests__/unit/logger/logger.test.ts`:
```typescript
// 기존:
// process.env.LOG_LEVEL = 'debug';

// 새:
import { initializeLogger } from '../../../src/logger/config';
import { initializeCommon } from '../../../src/config/common';

beforeEach(() => {
  initializeCommon({ nodeEnv: 'test' });
  initializeLogger({ level: 'debug' });
});
```

예시 — `__tests__/performance/cache/*.test.ts`:
```typescript
// 기존:
// process.env.CACHE_ENABLED = 'true';
// process.env.CACHE_INMEMORY_ENABLED = 'true';

// 새:
import { initializeCache } from '../../../src/cache/config';
import { initializeCommon } from '../../../src/config/common';

beforeEach(() => {
  initializeCommon({ nodeEnv: 'test' });
  initializeCache({ enabled: true, inmemory: { enabled: true } });
});
```

- [ ] **Step 4: 전체 테스트 실행**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 5: 커밋**

```bash
git add __tests__/
git commit -m "test: migrate existing tests from process.env to initialize() pattern"
```

---

## Task 21: types/env.ts 정리

**Files:**
- Modify: `src/types/env.ts`

- [ ] **Step 1: 기존 타입에 @deprecated 추가**

```typescript
/**
 * @deprecated Use types from '@withwiz/toolkit/initialize' instead.
 * Will be removed in 0.4.0.
 */
export interface ISharedEnvConfig { ... }

/**
 * @deprecated Use types from '@withwiz/toolkit/initialize' instead.
 */
export interface IRawEnv { ... }
```

새 타입은 각 모듈의 `config.ts`에 이미 정의되어 있으므로, `types/env.ts`는 하위 호환성을 위해 deprecated로 유지.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add src/types/env.ts
git commit -m "chore: deprecate ISharedEnvConfig and IRawEnv types in favor of new config types"
```

---

## Task 22: 최종 검증 및 버전 업데이트

**Files:**
- Modify: `package.json` (version)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 2: 전체 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: process.env 잔여 확인**

Run: `grep -rn 'process\.env' src/ --include='*.ts' | grep -v 'VITEST\|JEST_WORKER_ID\|NEXT_PHASE'`
Expected: 0 결과 (환경 감지용만 남음)

- [ ] **Step 4: 타입 체크**

Run: `npm run build:types`
Expected: 타입 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore: final verification for Config DI refactoring"
```
