import { randomUUID } from 'node:crypto';
import type {
  OAuthAccountRepository,
  OAuthAccount,
  CreateOAuthAccountData,
  UpdateOAuthAccountData,
} from '@withwiz/toolkit/core/auth/types';
import type {
  QueryExecutor,
  ResolvedSqlConfig,
  OAuthColumns,
  SqlAdapterConfig,
} from './types';
import { resolveConfig } from './types';
import { getDialect, ParamBuilder, columnList, type DialectStrategy } from './dialect';

export class SqlOAuthAccountRepository implements OAuthAccountRepository {
  private config: ResolvedSqlConfig;
  private dialect: DialectStrategy;

  constructor(private exec: QueryExecutor, config: SqlAdapterConfig) {
    this.config = resolveConfig(config);
    this.dialect = getDialect(this.config.dialect);
  }

  private get table(): string {
    return this.dialect.quoteId(this.config.tables.oauthAccount);
  }

  private get cols(): OAuthColumns {
    return this.config.oauthColumns;
  }

  private selectColumns(): string[] {
    const c = this.cols;
    return [
      c.id, c.userId, c.provider, c.providerAccountId,
      c.accessToken, c.refreshToken, c.expiresAt, c.tokenType, c.scope,
      c.createdAt, c.updatedAt,
    ];
  }

  async findByProvider(provider: string, providerAccountId: string): Promise<OAuthAccount | null> {
    const c = this.cols;
    const pb = new ParamBuilder(this.dialect);
    const sql = `SELECT ${columnList(this.selectColumns(), this.dialect)} FROM ${this.table} WHERE ${this.dialect.quoteId(c.provider)} = ${pb.add(provider)} AND ${this.dialect.quoteId(c.providerAccountId)} = ${pb.add(providerAccountId)}`;
    const rows = await this.exec.query(sql, pb.params);
    return rows[0] ? this.mapToOAuthAccount(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    const pb = new ParamBuilder(this.dialect);
    const sql = `SELECT ${columnList(this.selectColumns(), this.dialect)} FROM ${this.table} WHERE ${this.dialect.quoteId(this.cols.userId)} = ${pb.add(userId)}`;
    const rows = await this.exec.query(sql, pb.params);
    return rows.map((r) => this.mapToOAuthAccount(r));
  }

  async create(data: CreateOAuthAccountData): Promise<OAuthAccount> {
    const c = this.cols;
    const id = randomUUID();
    const now = new Date();
    const pb = new ParamBuilder(this.dialect);

    const entries: Array<[string, unknown]> = [
      [c.id, id],
      [c.userId, data.userId],
      [c.provider, data.provider],
      [c.providerAccountId, data.providerAccountId],
      [c.accessToken, data.accessToken ?? null],
      [c.refreshToken, data.refreshToken ?? null],
      [c.expiresAt, data.expiresAt ?? null],
      [c.tokenType, data.tokenType ?? null],
      [c.scope, data.scope ?? null],
      [c.createdAt, now],
      [c.updatedAt, now],
    ];
    const colSql = entries.map(([col]) => this.dialect.quoteId(col)).join(', ');
    const valSql = entries.map(([, val]) => pb.add(val)).join(', ');
    const sql = `INSERT INTO ${this.table} (${colSql}) VALUES (${valSql})`;
    await this.exec.query(sql, pb.params);

    return {
      id,
      userId: data.userId,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      accessToken: data.accessToken ?? null,
      refreshToken: data.refreshToken ?? null,
      expiresAt: data.expiresAt ?? null,
      tokenType: data.tokenType ?? null,
      scope: data.scope ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, data: UpdateOAuthAccountData): Promise<OAuthAccount> {
    const c = this.cols;
    const pb = new ParamBuilder(this.dialect);
    const sets: string[] = [];
    const assign = (col: string, val: unknown) => sets.push(`${this.dialect.quoteId(col)} = ${pb.add(val)}`);

    if (data.accessToken !== undefined) assign(c.accessToken, data.accessToken);
    if (data.refreshToken !== undefined) assign(c.refreshToken, data.refreshToken);
    if (data.expiresAt !== undefined) assign(c.expiresAt, data.expiresAt);
    if (data.tokenType !== undefined) assign(c.tokenType, data.tokenType);
    if (data.scope !== undefined) assign(c.scope, data.scope);
    assign(c.updatedAt, new Date());

    const sql = `UPDATE ${this.table} SET ${sets.join(', ')} WHERE ${this.dialect.quoteId(c.id)} = ${pb.add(id)}`;
    await this.exec.query(sql, pb.params);

    const updated = await this.selectById(id);
    if (!updated) throw new Error(`OAuth account not found after update: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const pb = new ParamBuilder(this.dialect);
    const sql = `DELETE FROM ${this.table} WHERE ${this.dialect.quoteId(this.cols.id)} = ${pb.add(id)}`;
    await this.exec.query(sql, pb.params);
  }

  private async selectById(id: string): Promise<OAuthAccount | null> {
    const pb = new ParamBuilder(this.dialect);
    const sql = `SELECT ${columnList(this.selectColumns(), this.dialect)} FROM ${this.table} WHERE ${this.dialect.quoteId(this.cols.id)} = ${pb.add(id)}`;
    const rows = await this.exec.query(sql, pb.params);
    return rows[0] ? this.mapToOAuthAccount(rows[0]) : null;
  }

  private mapToOAuthAccount(row: Record<string, unknown>): OAuthAccount {
    const c = this.cols;
    return {
      id: row[c.id] as string,
      userId: row[c.userId] as string,
      provider: row[c.provider] as string,
      providerAccountId: row[c.providerAccountId] as string,
      accessToken: (row[c.accessToken] as string | null) ?? null,
      refreshToken: (row[c.refreshToken] as string | null) ?? null,
      expiresAt: (row[c.expiresAt] as Date | null) ?? null,
      tokenType: (row[c.tokenType] as string | null) ?? null,
      scope: (row[c.scope] as string | null) ?? null,
      createdAt: row[c.createdAt] as Date,
      updatedAt: (row[c.updatedAt] as Date) ?? (row[c.createdAt] as Date),
    };
  }
}
