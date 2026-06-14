# Auth Module (core tier)

**Package**: `@withwiz/toolkit` v0.7+
**Tier**: `core` — framework-independent (pure TypeScript)
**Status**: ✅ Production ready

## Overview

`@withwiz/toolkit/core/auth` is a **framework-independent** authentication module.
It contains only pure logic such as JWT, password hashing, OAuth, and email tokens,
and can be used in any Node.js runtime — Next.js / Express / Fastify / NestJS, and more.

### Its Place in the 0.7 4-Tier Model

```
core/   ← here (auth: jwt · password · oauth · services · types · email — zero framework dep)
  ↑
  ├─ next/    Next.js request handlers  → @withwiz/toolkit/next/auth-handlers
  │           handler types             → @withwiz/toolkit/next/auth-types
  └─ prisma/  Prisma adapter            → @withwiz/toolkit/prisma/auth-adapter
```

The framework-coupled parts (request/response handlers, DB adapters) are intentionally
split into separate tiers, so importing only `core/auth` brings zero framework dependencies.

## Features

✅ **Zero Framework Dependency (`core/auth` only)**: `core/auth` has no Next.js or Prisma
   dependencies. Next handlers and the Prisma adapter are split into the `next`/`prisma` tiers respectively
✅ **Pure TypeScript**: Contains only pure TypeScript logic
✅ **Minimal Dependencies**: Uses only minimal libraries such as `jose`, `bcryptjs`, `zod`
✅ **Fully Typed**: Complete TypeScript type support
✅ **Portable**: Can be copied into other projects and used immediately

## Directory Structure

```
src/shared/auth/
├── core/
│   ├── jwt/
│   │   ├── index.ts              # JWTManager (server)
│   │   ├── client.ts             # JWTClientManager (browser)
│   │   └── types.ts              # JWT type definitions
│   ├── password/                 # (TODO)
│   ├── oauth/                    # (TODO)
│   └── email/                    # (TODO)
├── errors/
│   └── index.ts                  # AuthError, JWTError, etc.
├── types/
│   └── index.ts                  # Common type definitions
├── utils/                        # (TODO)
├── index.ts                      # Main export
└── README.md                     # This document
```

## Installation & Usage

### Required Dependencies

```bash
npm install jose zod
```

### Basic Usage

```typescript
import { JWTManager } from '@/shared/auth/core/jwt';
import type { JWTConfig, Logger } from '@/shared/auth/types';

// Logger implementation (customize to your framework)
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

// Create a JWTManager instance
const jwt = new JWTManager(jwtConfig, logger);

// Create a token pair
const tokens = await jwt.createTokenPair({
  id: 'user-123',
  email: 'user@example.com',
  role: 'USER',
  emailVerified: new Date(),
});

console.log(tokens.accessToken);
console.log(tokens.refreshToken);

// Verify a token
const payload = await jwt.verifyAccessToken(tokens.accessToken);
console.log(payload.userId, payload.email);
```

### Usage on the Client (Browser)

```typescript
'use client';

import {
  storeTokens,
  getStoredTokens,
  extractUserFromToken,
  clearStoredTokens,
} from '@/shared/auth/core/jwt/client';

// Store tokens after login
storeTokens(accessToken, refreshToken, 7 * 24 * 60 * 60); // 7 days

// Get stored tokens
const tokens = getStoredTokens();
if (tokens) {
  const user = extractUserFromToken(tokens.accessToken);
  console.log(user?.userId, user?.email);
}

// Logout
clearStoredTokens();
```

## Framework Integration Guides

### Next.js (App Router)

```typescript
import { JWTManager } from '@withwiz/toolkit/core/auth';
import type { JWTConfig, Logger } from '@withwiz/toolkit/core/auth';

const jwt = new JWTManager(jwtConfig, logger);
const tokens = await jwt.createTokenPair(user);
```

### Express

```typescript
import { JWTManager } from '@/shared/auth/core/jwt';
import type { JWTConfig, Logger } from '@/shared/auth/types';

// Integrate with a Winston or Pino logger
const logger: Logger = {
  debug: (msg, meta) => winston.debug(msg, meta),
  info: (msg, meta) => winston.info(msg, meta),
  warn: (msg, meta) => winston.warn(msg, meta),
  error: (msg, meta) => winston.error(msg, meta),
};

const jwt = new JWTManager(jwtConfig, logger);

// Express middleware
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

// Fastify plugin
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

## API Reference

### JWTManager

#### `createAccessToken(payload)`
Create an access token

```typescript
const token = await jwt.createAccessToken({
  id: 'user-123',
  userId: 'user-123',
  email: 'user@example.com',
  role: 'USER', // role is a plain string — define your own role vocabulary in your app
  emailVerified: new Date(),
});
```

#### `createRefreshToken(userId)`
Create a refresh token

```typescript
const refreshToken = await jwt.createRefreshToken('user-123');
```

#### `createTokenPair(user)`
Create an access + refresh token pair

```typescript
const { accessToken, refreshToken } = await jwt.createTokenPair(user);
```

#### `verifyAccessToken(token)`
Verify an access token

```typescript
const payload = await jwt.verifyAccessToken(token);
console.log(payload.userId, payload.email);
```

#### `verifyRefreshToken(token)`
Verify a refresh token

```typescript
const { userId } = await jwt.verifyRefreshToken(refreshToken);
```

#### `extractTokenFromHeader(authHeader)`
Extract the token from the Authorization header

```typescript
const token = jwt.extractTokenFromHeader('Bearer abc123...');
// → 'abc123...'
```

### JWTClientManager (Browser)

#### `storeTokens(accessToken, refreshToken, expiresIn)`
Store tokens in LocalStorage

```typescript
storeTokens(accessToken, refreshToken, 7 * 24 * 60 * 60);
```

#### `getStoredTokens()`
Get stored tokens

```typescript
const tokens = getStoredTokens();
```

#### `clearStoredTokens()`
Delete tokens

```typescript
clearStoredTokens();
```

#### `extractUserFromToken(token)`
Extract user information from a token

```typescript
const user = extractUserFromToken(accessToken);
console.log(user?.userId, user?.email, user?.role);
```

## Type Definitions

### JWTConfig

```typescript
interface JWTConfig {
  secret: string; // at least 32 characters
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
  role: string; // consumer-owned vocabulary — the toolkit never ships a fixed role enum
  emailVerified?: Date | null;
  tokenType?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
```

> **Roles are consumer-owned.** `role` is a plain `string`. The toolkit does **not**
> define a `UserRole` enum — your app owns its own role vocabulary
> (`USER` / `EDITOR` / `ADMIN`, `PATIENT` / `DOCTOR`, …). Declare it in your app and
> pass the values through; the toolkit only carries and matches the string.

### Logger

```typescript
interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}
```

## Error Handling

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

### Error Codes

```typescript
import { AUTH_ERROR_CODES } from '@/shared/auth/errors';

AUTH_ERROR_CODES.TOKEN_EXPIRED
AUTH_ERROR_CODES.TOKEN_INVALID
AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED
AUTH_ERROR_CODES.INVALID_PAYLOAD
// ... etc.
```

## TODO (Planned Additions)

- [ ] Password module (`core/password/`)
- [ ] OAuth module (`core/oauth/`)
- [ ] Email token generation (`core/email/`)
- [ ] Utility functions (`utils/`)

## Migration

Code that used the existing `@/lib/@auth/core/jwt` continues to work without changes.

```typescript
import { JWTManager } from '@withwiz/toolkit/core/auth';
```

## License

Written for internal project use. Copying and modification are freely permitted.

## Contact

- **Issues**: GitHub Issues
- **Docs**: [AUTH_3TIER_REFACTORING_PLAN.md](../../../docs/AUTH_3TIER_REFACTORING_PLAN.md)

---

**Made with ❤️ for universal authentication**
