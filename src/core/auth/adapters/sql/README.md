# Raw SQL Auth Adapter

Built-in raw SQL implementation of the `core/auth` repository interfaces
(`UserRepository`, `OAuthAccountRepository`, `EmailTokenRepository`). Use this
to run the auth module on PostgreSQL or MySQL without Prisma.

Driver-independent: you inject a `QueryExecutor` (a one-line wrapper around your
driver), so this package depends on no SQL driver.

## Install

No extra dependency from this package. Bring your own driver (`pg`, `mysql2`,
`postgres`, …).

## QueryExecutor

```ts
import type { QueryExecutor } from '@withwiz/toolkit/core/auth/adapters/sql';

// pg (node-postgres)
const exec: QueryExecutor = {
  query: (sql, params) => pool.query(sql, params).then((r) => r.rows),
};

// mysql2/promise
const exec: QueryExecutor = {
  query: (sql, params) => pool.query(sql, params).then(([rows]) => rows as any[]),
};

// postgres.js (sql = postgres instance)
const exec: QueryExecutor = {
  query: (text, params) => sql.unsafe(text, params),
};
```

## Usage

```ts
import {
  SqlUserRepository,
  SqlOAuthAccountRepository,
  SqlEmailTokenRepository,
} from '@withwiz/toolkit/core/auth/adapters/sql';
import { LoginService } from '@withwiz/toolkit/core/auth/services/login.service';

const userRepository = new SqlUserRepository(exec, { dialect: 'postgres' });
const login = new LoginService({ userRepository, jwtSecret: process.env.JWT_SECRET! });
```

## Config

All table and column names are overridable; defaults are snake_case.

| Group | Keys | Defaults |
| --- | --- | --- |
| `tables` | user, oauthAccount, emailVerification, passwordReset, magicLink | `users`, `accounts`, `email_verification_tokens`, `password_reset_tokens`, `magic_link_tokens` |
| `userColumns` | id, email, name, password, role, image, emailVerified, isActive, createdAt, updatedAt, lastLoginAt | `id`, `email`, `name`, `password`, `role`, `image`, `email_verified`, `is_active`, `created_at`, `updated_at`, `last_login_at` |
| `oauthColumns` | id, userId, provider, providerAccountId, accessToken, refreshToken, expiresAt, tokenType, scope, createdAt, updatedAt | snake_case of each |
| `emailTokenColumns` | id, email, token, expires, used, createdAt | snake_case of each |

`dialect` is required: `'postgres' | 'mysql'`.

## Recommended schema (PostgreSQL)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  password      TEXT,
  role          TEXT,
  image         TEXT,
  email_verified TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,
  last_login_at TIMESTAMPTZ
);

CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token        TEXT,
  refresh_token       TEXT,
  expires_at          TIMESTAMPTZ,
  token_type          TEXT,
  scope               TEXT,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE email_verification_tokens (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE password_reset_tokens (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE magic_link_tokens (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL
);
```

For MySQL use `VARCHAR(255)` / `DATETIME` / `TINYINT(1)` and set
`{ dialect: 'mysql' }`. The adapter generates row IDs with `crypto.randomUUID()`,
so an application-generated `TEXT`/`VARCHAR` primary key is expected (not
`AUTO_INCREMENT`).

## Notes

- `findByEmail` returns the user with the password hash attached, for bcrypt
  comparison in the login handler.
- OAuth tokens are stored inline on a single `accounts` table (no join).
- `expires_at` is a timestamp column (bound/returned as `Date`).
