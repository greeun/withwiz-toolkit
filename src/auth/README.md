# Shared Auth Module

**버전**: 1.0.0 (Tier 3 - Framework Agnostic)
**상태**: ✅ 프로덕션 사용 가능
**계층**: 범용 공유 라이브러리 (프레임워크 독립적)

## 개요

`src/shared/auth/`는 **프레임워크에 완전히 독립적인** 인증 모듈입니다.
Next.js, Express, Fastify, NestJS 등 **어떤 Node.js 프레임워크에서도 사용 가능**합니다.

### 3-Tier 아키텍처에서의 위치

```
src/app/auth/              (Tier 1: Application Layer)
    ↓ 참조
src/lib/@auth/             (Tier 2: Library Layer - Next.js/Prisma)
    ↓ 참조
src/shared/auth/           (Tier 3: Shared Layer - Framework 독립) ← 여기
```

## 특징

✅ **Zero Framework Dependency**: Next.js, Prisma 등 프레임워크 의존성 없음
✅ **Pure TypeScript**: 순수 TypeScript 로직만 포함
✅ **Minimal Dependencies**: `jose`, `bcryptjs`, `zod` 등 최소한의 라이브러리만 사용
✅ **Fully Typed**: 완벽한 TypeScript 타입 지원
✅ **Portable**: 다른 프로젝트에 복사하여 즉시 사용 가능

## 디렉토리 구조

```
src/shared/auth/
├── core/
│   ├── jwt/
│   │   ├── index.ts              # JWTManager (서버용)
│   │   ├── client.ts             # JWTClientManager (브라우저용)
│   │   └── types.ts              # JWT 타입 정의
│   ├── password/                 # (TODO)
│   ├── oauth/                    # (TODO)
│   └── email/                    # (TODO)
├── errors/
│   └── index.ts                  # AuthError, JWTError 등
├── types/
│   └── index.ts                  # 공통 타입 정의
├── utils/                        # (TODO)
├── index.ts                      # 메인 export
└── README.md                     # 이 문서
```

## 설치 및 사용

### 필수 의존성

```bash
npm install jose zod
```

### 기본 사용법

```typescript
import { JWTManager } from '@/shared/auth/core/jwt';
import type { JWTConfig, Logger } from '@/shared/auth/types';

// Logger 구현 (프레임워크에 맞게 커스터마이즈)
const logger: Logger = {
  debug: (msg, meta) => console.debug(msg, meta),
  info: (msg, meta) => console.info(msg, meta),
  warn: (msg, meta) => console.warn(msg, meta),
  error: (msg, meta) => console.error(msg, meta),
};

// JWT Config
const jwtConfig: JWTConfig = {
  secret: process.env.JWT_SECRET!,
  accessTokenExpiry: '7d',
  refreshTokenExpiry: '30d',
  algorithm: 'HS256',
};

// JWTManager 인스턴스 생성
const jwt = new JWTManager(jwtConfig, logger);

// 토큰 쌍 생성
const tokens = await jwt.createTokenPair({
  id: 'user-123',
  email: 'user@example.com',
  role: 'USER',
  emailVerified: new Date(),
});

console.log(tokens.accessToken);
console.log(tokens.refreshToken);

// 토큰 검증
const payload = await jwt.verifyAccessToken(tokens.accessToken);
console.log(payload.userId, payload.email);
```

### 클라이언트 (브라우저)에서 사용

```typescript
'use client';

import {
  storeTokens,
  getStoredTokens,
  extractUserFromToken,
  clearStoredTokens,
} from '@/shared/auth/core/jwt/client';

// 로그인 후 토큰 저장
storeTokens(accessToken, refreshToken, 7 * 24 * 60 * 60); // 7일

// 저장된 토큰 가져오기
const tokens = getStoredTokens();
if (tokens) {
  const user = extractUserFromToken(tokens.accessToken);
  console.log(user?.userId, user?.email);
}

// 로그아웃
clearStoredTokens();
```

## 프레임워크별 통합 가이드

### Next.js (App Router)

```typescript
import { JWTManager } from '@withwiz/toolkit/auth';
import type { JWTConfig, Logger } from '@withwiz/toolkit/auth';

const jwt = new JWTManager(jwtConfig, logger);
const tokens = await jwt.createTokenPair(user);
```

### Express

```typescript
import { JWTManager } from '@/shared/auth/core/jwt';
import type { JWTConfig, Logger } from '@/shared/auth/types';

// Winston 또는 Pino logger와 통합
const logger: Logger = {
  debug: (msg, meta) => winston.debug(msg, meta),
  info: (msg, meta) => winston.info(msg, meta),
  warn: (msg, meta) => winston.warn(msg, meta),
  error: (msg, meta) => winston.error(msg, meta),
};

const jwt = new JWTManager(jwtConfig, logger);

// Express 미들웨어
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = jwt.extractTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = await jwt.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});
```

### Fastify

```typescript
import { JWTManager } from '@/shared/auth/core/jwt';

const jwt = new JWTManager(jwtConfig, logger);

// Fastify 플러그인
fastify.decorateRequest('user', null);

fastify.addHook('onRequest', async (request, reply) => {
  const authHeader = request.headers.authorization;
  const token = jwt.extractTokenFromHeader(authHeader);

  if (!token) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    const payload = await jwt.verifyAccessToken(token);
    request.user = payload;
  } catch (error) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
});
```

## API 레퍼런스

### JWTManager

#### `createAccessToken(payload)`
Access 토큰 생성

```typescript
const token = await jwt.createAccessToken({
  id: 'user-123',
  userId: 'user-123',
  email: 'user@example.com',
  role: UserRole.USER,
  emailVerified: new Date(),
});
```

#### `createRefreshToken(userId)`
Refresh 토큰 생성

```typescript
const refreshToken = await jwt.createRefreshToken('user-123');
```

#### `createTokenPair(user)`
Access + Refresh 토큰 쌍 생성

```typescript
const { accessToken, refreshToken } = await jwt.createTokenPair(user);
```

#### `verifyAccessToken(token)`
Access 토큰 검증

```typescript
const payload = await jwt.verifyAccessToken(token);
console.log(payload.userId, payload.email);
```

#### `verifyRefreshToken(token)`
Refresh 토큰 검증

```typescript
const { userId } = await jwt.verifyRefreshToken(refreshToken);
```

#### `extractTokenFromHeader(authHeader)`
Authorization 헤더에서 토큰 추출

```typescript
const token = jwt.extractTokenFromHeader('Bearer abc123...');
// → 'abc123...'
```

### JWTClientManager (Browser)

#### `storeTokens(accessToken, refreshToken, expiresIn)`
LocalStorage에 토큰 저장

```typescript
storeTokens(accessToken, refreshToken, 7 * 24 * 60 * 60);
```

#### `getStoredTokens()`
저장된 토큰 가져오기

```typescript
const tokens = getStoredTokens();
```

#### `clearStoredTokens()`
토큰 삭제

```typescript
clearStoredTokens();
```

#### `extractUserFromToken(token)`
토큰에서 사용자 정보 추출

```typescript
const user = extractUserFromToken(accessToken);
console.log(user?.userId, user?.email, user?.role);
```

## 타입 정의

### JWTConfig

```typescript
interface JWTConfig {
  secret: string; // 최소 32자
  accessTokenExpiry: string; // '7d', '1h', etc.
  refreshTokenExpiry: string; // '30d', '7d', etc.
  algorithm: 'HS256' | 'HS384' | 'HS512';
}
```

### JWTPayload

```typescript
interface JWTPayload {
  id: string;
  userId: string;
  email: string;
  role: UserRole;
  emailVerified?: Date | null;
  tokenType?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
```

### Logger

```typescript
interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}
```

## 에러 처리

### JWTError

```typescript
import { JWTError } from '@/shared/auth/errors';

try {
  const payload = await jwt.verifyAccessToken(token);
} catch (error) {
  if (error instanceof JWTError) {
    console.error(error.code); // 'TOKEN_EXPIRED', 'TOKEN_INVALID', etc.
    console.error(error.statusCode); // 401
  }
}
```

### 에러 코드

```typescript
import { AUTH_ERROR_CODES } from '@/shared/auth/errors';

AUTH_ERROR_CODES.TOKEN_EXPIRED
AUTH_ERROR_CODES.TOKEN_INVALID
AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED
AUTH_ERROR_CODES.INVALID_PAYLOAD
// ... 등
```

## TODO (향후 추가 예정)

- [ ] Password 모듈 (`core/password/`)
- [ ] OAuth 모듈 (`core/oauth/`)
- [ ] Email Token 생성 (`core/email/`)
- [ ] 유틸리티 함수들 (`utils/`)

## 마이그레이션

기존 `@/lib/@auth/core/jwt`를 사용하던 코드는 변경 없이 계속 작동합니다.

```typescript
import { JWTManager } from '@withwiz/toolkit/auth';
```

## 라이센스

프로젝트 내부용으로 작성되었습니다. 복사 및 수정은 자유롭게 가능합니다.

## 문의

- **이슈**: GitHub Issues
- **문서**: [AUTH_3TIER_REFACTORING_PLAN.md](../../../docs/AUTH_3TIER_REFACTORING_PLAN.md)

---

**Made with ❤️ for universal authentication**
