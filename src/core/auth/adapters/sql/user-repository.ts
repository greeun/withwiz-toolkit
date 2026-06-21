import { randomUUID } from 'node:crypto';
import type {
  UserRepository,
  BaseUser,
  CreateUserData,
  UpdateUserData,
} from '@withwiz/toolkit/core/auth/types';
import type {
  QueryExecutor,
  ResolvedSqlConfig,
  UserColumns,
  SqlAdapterConfig,
} from './types';
import { resolveConfig } from './types';
import { getDialect, ParamBuilder, columnList, type DialectStrategy } from './dialect';

export class SqlUserRepository implements UserRepository {
  private config: ResolvedSqlConfig;
  private dialect: DialectStrategy;

  constructor(private exec: QueryExecutor, config: SqlAdapterConfig) {
    this.config = resolveConfig(config);
    this.dialect = getDialect(this.config.dialect);
  }

  private get table(): string {
    return this.dialect.quoteId(this.config.tables.user);
  }

  private get cols(): UserColumns {
    return this.config.userColumns;
  }

  /** password 제외 SELECT/매핑 대상 컬럼. */
  private selectColumns(): string[] {
    const c = this.cols;
    return [c.id, c.email, c.name, c.role, c.image, c.emailVerified, c.isActive, c.createdAt, c.updatedAt];
  }

  async findById(id: string): Promise<BaseUser | null> {
    const pb = new ParamBuilder(this.dialect);
    const sql = `SELECT ${columnList(this.selectColumns(), this.dialect)} FROM ${this.table} WHERE ${this.dialect.quoteId(this.cols.id)} = ${pb.add(id)}`;
    const rows = await this.exec.query(sql, pb.params);
    return rows[0] ? this.mapToBaseUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<BaseUser | null> {
    const pb = new ParamBuilder(this.dialect);
    const cols = [...this.selectColumns(), this.cols.password];
    const sql = `SELECT ${columnList(cols, this.dialect)} FROM ${this.table} WHERE ${this.dialect.quoteId(this.cols.email)} = ${pb.add(email)}`;
    const rows = await this.exec.query(sql, pb.params);
    if (!rows[0]) return null;
    const baseUser = this.mapToBaseUser(rows[0]);
    // 인증 핸들러 호환: bcrypt 비교용 password 해시를 반환 객체에 포함한다.
    return Object.assign(baseUser, { password: rows[0][this.cols.password] ?? null });
  }

  async create(data: CreateUserData): Promise<BaseUser> {
    const c = this.cols;
    const id = randomUUID();
    const now = new Date();
    const pb = new ParamBuilder(this.dialect);

    const entries: Array<[string, unknown]> = [
      [c.id, id],
      [c.email, data.email],
      [c.name, data.name ?? null],
      [c.password, data.password ?? null],
      [c.role, data.role ?? null],
      [c.emailVerified, data.emailVerified ?? null],
      [c.image, data.image ?? null],
      [c.isActive, true],
      [c.createdAt, now],
      [c.updatedAt, now],
    ];

    const colSql = entries.map(([col]) => this.dialect.quoteId(col)).join(', ');
    const valSql = entries.map(([, val]) => pb.add(val)).join(', ');
    const sql = `INSERT INTO ${this.table} (${colSql}) VALUES (${valSql})`;
    await this.exec.query(sql, pb.params);

    return {
      id,
      email: data.email,
      name: data.name ?? null,
      role: data.role ?? undefined,
      emailVerified: data.emailVerified ?? null,
      image: data.image ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, data: UpdateUserData): Promise<BaseUser> {
    const c = this.cols;
    const pb = new ParamBuilder(this.dialect);
    const sets: string[] = [];
    const assign = (col: string, val: unknown) => {
      sets.push(`${this.dialect.quoteId(col)} = ${pb.add(val)}`);
    };

    if (data.email !== undefined) assign(c.email, data.email);
    if (data.name !== undefined) assign(c.name, data.name);
    if (data.isActive !== undefined) assign(c.isActive, data.isActive);
    if (data.password !== undefined) assign(c.password, data.password);
    if (data.role !== undefined) assign(c.role, data.role);
    if (data.emailVerified !== undefined) assign(c.emailVerified, data.emailVerified);
    if (data.image !== undefined) assign(c.image, data.image);
    assign(c.updatedAt, new Date());

    const sql = `UPDATE ${this.table} SET ${sets.join(', ')} WHERE ${this.dialect.quoteId(c.id)} = ${pb.add(id)}`;
    await this.exec.query(sql, pb.params);

    const updated = await this.findById(id);
    if (!updated) throw new Error(`User not found after update: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const pb = new ParamBuilder(this.dialect);
    const sql = `DELETE FROM ${this.table} WHERE ${this.dialect.quoteId(this.cols.id)} = ${pb.add(id)}`;
    await this.exec.query(sql, pb.params);
  }

  async updateLastLoginAt(id: string): Promise<void> {
    const pb = new ParamBuilder(this.dialect);
    const sql = `UPDATE ${this.table} SET ${this.dialect.quoteId(this.cols.lastLoginAt)} = ${pb.add(new Date())} WHERE ${this.dialect.quoteId(this.cols.id)} = ${pb.add(id)}`;
    await this.exec.query(sql, pb.params);
  }

  async verifyEmail(email: string): Promise<void> {
    const pb = new ParamBuilder(this.dialect);
    const sql = `UPDATE ${this.table} SET ${this.dialect.quoteId(this.cols.emailVerified)} = ${pb.add(new Date())} WHERE ${this.dialect.quoteId(this.cols.email)} = ${pb.add(email)}`;
    await this.exec.query(sql, pb.params);
  }

  private mapToBaseUser(row: Record<string, unknown>): BaseUser {
    const c = this.cols;
    return {
      id: row[c.id] as string,
      email: row[c.email] as string,
      name: (row[c.name] as string | null) ?? null,
      role: row[c.role] as string | undefined,
      emailVerified: (row[c.emailVerified] as Date | null) ?? null,
      isActive: row[c.isActive] as boolean | undefined,
      image: (row[c.image] as string | null) ?? null,
      createdAt: row[c.createdAt] as Date | undefined,
      updatedAt: row[c.updatedAt] as Date | undefined,
    };
  }
}
