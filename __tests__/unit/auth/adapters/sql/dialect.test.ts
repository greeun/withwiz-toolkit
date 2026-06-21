import { describe, it, expect } from 'vitest';
import { getDialect, ParamBuilder, columnList } from '@withwiz/toolkit/core/auth/adapters/sql';

describe('getDialect', () => {
  it('postgres는 $n placeholder와 큰따옴표 식별자를 쓴다', () => {
    const d = getDialect('postgres');
    expect(d.placeholder(1)).toBe('$1');
    expect(d.placeholder(2)).toBe('$2');
    expect(d.quoteId('email')).toBe('"email"');
  });

  it('mysql은 ? placeholder와 백틱 식별자를 쓴다', () => {
    const d = getDialect('mysql');
    expect(d.placeholder(1)).toBe('?');
    expect(d.placeholder(2)).toBe('?');
    expect(d.quoteId('email')).toBe('`email`');
  });

  it('미지원 방언은 throw', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => getDialect('oracle' as any)).toThrow('Unsupported SQL dialect: oracle');
  });
});

describe('ParamBuilder', () => {
  it('add는 값을 누적하고 순번 placeholder를 반환 (postgres)', () => {
    const pb = new ParamBuilder(getDialect('postgres'));
    expect(pb.add('a')).toBe('$1');
    expect(pb.add('b')).toBe('$2');
    expect(pb.params).toEqual(['a', 'b']);
  });

  it('mysql은 항상 ? 반환하되 params 순서 보존', () => {
    const pb = new ParamBuilder(getDialect('mysql'));
    expect(pb.add('a')).toBe('?');
    expect(pb.add('b')).toBe('?');
    expect(pb.params).toEqual(['a', 'b']);
  });
});

describe('columnList', () => {
  it('컬럼을 방언 따옴표로 감싸 결합', () => {
    expect(columnList(['id', 'email'], getDialect('postgres'))).toBe('"id", "email"');
    expect(columnList(['id', 'email'], getDialect('mysql'))).toBe('`id`, `email`');
  });
});
