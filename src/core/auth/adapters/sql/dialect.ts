import type { SqlDialect } from './types';

export interface DialectStrategy {
  /** 1-based 파라미터 placeholder. postgres: $1,$2.. / mysql: ? */
  placeholder(index: number): string;
  /** 식별자 따옴표. postgres: "id" / mysql: `id` */
  quoteId(id: string): string;
}

const POSTGRES: DialectStrategy = {
  placeholder: (index) => `$${index}`,
  quoteId: (id) => `"${id}"`,
};

const MYSQL: DialectStrategy = {
  placeholder: () => '?',
  quoteId: (id) => `\`${id}\``,
};

export function getDialect(dialect: SqlDialect): DialectStrategy {
  switch (dialect) {
    case 'postgres':
      return POSTGRES;
    case 'mysql':
      return MYSQL;
    default:
      throw new Error(`Unsupported SQL dialect: ${dialect}`);
  }
}

/**
 * placeholder 순번과 params 배열을 동기화해 누적하는 빌더.
 * add()는 값을 저장하고 그 위치의 placeholder 문자열을 돌려준다.
 */
export class ParamBuilder {
  private _params: unknown[] = [];

  constructor(private dialect: DialectStrategy) {}

  add(value: unknown): string {
    this._params.push(value);
    return this.dialect.placeholder(this._params.length);
  }

  get params(): unknown[] {
    return this._params;
  }
}

/** 컬럼명 배열을 방언 따옴표로 감싸 ', ' 결합. */
export function columnList(columns: string[], dialect: DialectStrategy): string {
  return columns.map((c) => dialect.quoteId(c)).join(', ');
}
