import { randomUUID } from 'node:crypto';
import type {
  EmailTokenRepository,
  EmailToken,
  TokenType,
} from '@withwiz/toolkit/core/auth/types';
import type {
  QueryExecutor,
  ResolvedSqlConfig,
  EmailTokenColumns,
  SqlAdapterConfig,
} from './types';
import { resolveConfig } from './types';
import { getDialect, ParamBuilder, columnList, type DialectStrategy } from './dialect';

export class SqlEmailTokenRepository implements EmailTokenRepository {
  private config: ResolvedSqlConfig;
  private dialect: DialectStrategy;

  constructor(private exec: QueryExecutor, config: SqlAdapterConfig) {
    this.config = resolveConfig(config);
    this.dialect = getDialect(this.config.dialect);
  }

  private get cols(): EmailTokenColumns {
    return this.config.emailTokenColumns;
  }

  private tableName(type: TokenType): string {
    switch (type) {
      case 'EMAIL_VERIFICATION':
        return this.config.tables.emailVerification;
      case 'PASSWORD_RESET':
        return this.config.tables.passwordReset;
      case 'MAGIC_LINK':
        return this.config.tables.magicLink;
      default:
        throw new Error(`Unsupported token type: ${type}`);
    }
  }

  private quotedTable(type: TokenType): string {
    return this.dialect.quoteId(this.tableName(type));
  }

  private selectColumns(includeUsed: boolean): string[] {
    const c = this.cols;
    const base = [c.id, c.email, c.token, c.expires, c.createdAt];
    return includeUsed ? [...base, c.used] : base;
  }

  async create(email: string, token: string, type: TokenType, expiresAt: Date): Promise<EmailToken> {
    const c = this.cols;
    const id = randomUUID();
    const now = new Date();
    const isMagic = type === 'MAGIC_LINK';
    const pb = new ParamBuilder(this.dialect);

    const entries: Array<[string, unknown]> = [
      [c.id, id],
      [c.email, email],
      [c.token, token],
      [c.expires, expiresAt],
      [c.createdAt, now],
    ];
    if (isMagic) entries.push([c.used, false]);

    const colSql = entries.map(([col]) => this.dialect.quoteId(col)).join(', ');
    const valSql = entries.map(([, val]) => pb.add(val)).join(', ');
    const sql = `INSERT INTO ${this.quotedTable(type)} (${colSql}) VALUES (${valSql})`;
    await this.exec.query(sql, pb.params);

    return {
      id,
      email,
      token,
      type,
      expires: expiresAt,
      used: false,
      createdAt: now,
    };
  }

  async findByEmailAndToken(email: string, token: string, type: TokenType): Promise<EmailToken | null> {
    const c = this.cols;
    const isMagic = type === 'MAGIC_LINK';
    const pb = new ParamBuilder(this.dialect);
    const sql = `SELECT ${columnList(this.selectColumns(isMagic), this.dialect)} FROM ${this.quotedTable(type)} WHERE ${this.dialect.quoteId(c.email)} = ${pb.add(email)} AND ${this.dialect.quoteId(c.token)} = ${pb.add(token)}`;
    const rows = await this.exec.query(sql, pb.params);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row[c.id] as string,
      email: row[c.email] as string,
      token: row[c.token] as string,
      type,
      expires: row[c.expires] as Date,
      used: isMagic ? Boolean(row[c.used]) : false,
      createdAt: row[c.createdAt] as Date,
    };
  }

  async delete(email: string, token: string, type: TokenType): Promise<void> {
    const c = this.cols;
    const pb = new ParamBuilder(this.dialect);
    const sql = `DELETE FROM ${this.quotedTable(type)} WHERE ${this.dialect.quoteId(c.email)} = ${pb.add(email)} AND ${this.dialect.quoteId(c.token)} = ${pb.add(token)}`;
    await this.exec.query(sql, pb.params);
  }

  async deleteExpired(): Promise<void> {
    const c = this.cols;
    const tables = [
      this.config.tables.emailVerification,
      this.config.tables.passwordReset,
      this.config.tables.magicLink,
    ];
    await Promise.all(
      tables.map((t) => {
        const pb = new ParamBuilder(this.dialect);
        const sql = `DELETE FROM ${this.dialect.quoteId(t)} WHERE ${this.dialect.quoteId(c.expires)} < ${pb.add(new Date())}`;
        return this.exec.query(sql, pb.params);
      }),
    );
  }

  async markAsUsed(id: string): Promise<void> {
    const c = this.cols;
    const pb = new ParamBuilder(this.dialect);
    const sql = `UPDATE ${this.dialect.quoteId(this.config.tables.magicLink)} SET ${this.dialect.quoteId(c.used)} = ${pb.add(true)} WHERE ${this.dialect.quoteId(c.id)} = ${pb.add(id)}`;
    await this.exec.query(sql, pb.params);
  }
}
