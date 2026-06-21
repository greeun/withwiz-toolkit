/**
 * Raw SQL Auth Adapter — 공유 타입 & config 해석.
 */

/** 실행할 SQL 방언. */
export type SqlDialect = 'postgres' | 'mysql';

/**
 * 드라이버 독립 쿼리 실행기. 소비자가 자기 드라이버를 한 줄 wrapping 해 주입한다.
 *
 * @example
 * // pg
 * const exec = { query: (sql, p) => pool.query(sql, p).then((r) => r.rows) };
 * // mysql2/promise
 * const exec = { query: (sql, p) => pool.query(sql, p).then(([rows]) => rows) };
 */
export interface QueryExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface UserColumns {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  image: string;
  emailVerified: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface OAuthColumns {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTokenColumns {
  id: string;
  email: string;
  token: string;
  expires: string;
  used: string;
  createdAt: string;
}

export interface SqlAdapterConfig {
  dialect: SqlDialect;
  tables?: {
    user?: string;
    oauthAccount?: string;
    emailVerification?: string;
    passwordReset?: string;
    magicLink?: string;
  };
  userColumns?: Partial<UserColumns>;
  oauthColumns?: Partial<OAuthColumns>;
  emailTokenColumns?: Partial<EmailTokenColumns>;
}

export interface ResolvedSqlConfig {
  dialect: SqlDialect;
  tables: Required<NonNullable<SqlAdapterConfig['tables']>>;
  userColumns: UserColumns;
  oauthColumns: OAuthColumns;
  emailTokenColumns: EmailTokenColumns;
}

const DEFAULT_TABLES = {
  user: 'users',
  oauthAccount: 'accounts',
  emailVerification: 'email_verification_tokens',
  passwordReset: 'password_reset_tokens',
  magicLink: 'magic_link_tokens',
} as const;

const DEFAULT_USER_COLUMNS: UserColumns = {
  id: 'id',
  email: 'email',
  name: 'name',
  password: 'password',
  role: 'role',
  image: 'image',
  emailVerified: 'email_verified',
  isActive: 'is_active',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  lastLoginAt: 'last_login_at',
};

const DEFAULT_OAUTH_COLUMNS: OAuthColumns = {
  id: 'id',
  userId: 'user_id',
  provider: 'provider',
  providerAccountId: 'provider_account_id',
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  expiresAt: 'expires_at',
  tokenType: 'token_type',
  scope: 'scope',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const DEFAULT_EMAIL_TOKEN_COLUMNS: EmailTokenColumns = {
  id: 'id',
  email: 'email',
  token: 'token',
  expires: 'expires',
  used: 'used',
  createdAt: 'created_at',
};

/** SqlAdapterConfig를 기본값으로 채워 완전한 ResolvedSqlConfig로 해석한다. */
export function resolveConfig(config: SqlAdapterConfig): ResolvedSqlConfig {
  return {
    dialect: config.dialect,
    tables: { ...DEFAULT_TABLES, ...config.tables },
    userColumns: { ...DEFAULT_USER_COLUMNS, ...config.userColumns },
    oauthColumns: { ...DEFAULT_OAUTH_COLUMNS, ...config.oauthColumns },
    emailTokenColumns: { ...DEFAULT_EMAIL_TOKEN_COLUMNS, ...config.emailTokenColumns },
  };
}
