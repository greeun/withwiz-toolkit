# Raw SQL 인증 어댑터

`core/auth` 리포지토리 인터페이스(`UserRepository`, `OAuthAccountRepository`,
`EmailTokenRepository`)의 내장 Raw SQL 구현체입니다. Prisma 없이 PostgreSQL 또는
MySQL 위에서 auth 모듈을 실행할 때 사용합니다.

드라이버 독립: `QueryExecutor`(드라이버를 한 줄로 감싸는 래퍼)를 주입하는 방식이므로
이 패키지는 SQL 드라이버에 의존하지 않습니다.

## 설치

이 패키지에서 추가 의존성은 없습니다. 드라이버(`pg`, `mysql2`, `postgres`, …)는
직접 설치하세요.

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

## 사용법

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

모든 테이블 및 컬럼 이름은 재정의 가능하며, 기본값은 snake_case입니다.

| 그룹 | 키 | 기본값 |
| --- | --- | --- |
| `tables` | user, oauthAccount, emailVerification, passwordReset, magicLink | `users`, `accounts`, `email_verification_tokens`, `password_reset_tokens`, `magic_link_tokens` |
| `userColumns` | id, email, name, password, role, image, emailVerified, isActive, createdAt, updatedAt, lastLoginAt | `id`, `email`, `name`, `password`, `role`, `image`, `email_verified`, `is_active`, `created_at`, `updated_at`, `last_login_at` |
| `oauthColumns` | id, userId, provider, providerAccountId, accessToken, refreshToken, expiresAt, tokenType, scope, createdAt, updatedAt | 각 항목의 snake_case |
| `emailTokenColumns` | id, email, token, expires, used, createdAt | 각 항목의 snake_case |

`dialect`는 필수 값입니다: `'postgres' | 'mysql'`.

## 권장 스키마 (PostgreSQL)

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

MySQL의 경우 `VARCHAR(255)` / `DATETIME` / `TINYINT(1)`을 사용하고
`{ dialect: 'mysql' }`로 설정하세요. 어댑터는 `crypto.randomUUID()`로 행 ID를
생성하므로 애플리케이션에서 생성하는 `TEXT`/`VARCHAR` 기본 키가 필요합니다
(`AUTO_INCREMENT` 아님).

## 주의 사항

- `findByEmail`은 로그인 핸들러에서 bcrypt 비교를 위해 비밀번호 해시가 포함된
  사용자를 반환합니다.
- OAuth 토큰은 단일 `accounts` 테이블에 인라인으로 저장됩니다(조인 없음).
- `expires_at`은 타임스탬프 컬럼으로, `Date`로 바인딩/반환됩니다.
