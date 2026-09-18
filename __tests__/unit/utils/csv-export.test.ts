/**
 * CSV 내보내기 실제 소스 검증 (TC-U-028)
 *
 * src/next/utils/csv-export.ts 와 csv-export-format.ts 를 직접 import 해 실행한다.
 * `next/server` 는 devDependency 실모듈을 사용하고 logger 만 목으로 대체한다.
 *
 * 이전 판은 NextResponse 의존을 피하려고 구현을 테스트 파일 안에 복제해
 * 소스를 한 줄도 실행하지 않았다(복제본 boolFormatter.korean 은 'Yes' 를 반환해
 * 소스의 '예' 와도 달랐다). 기존 검증 범위(SC-UNIT-CSV-001~004)는 그대로 옮겼다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  escapeCsvField,
  rowToCsv,
  createCsvHeader,
  createSimpleCsvResponse,
  createStreamingCsvResponse,
  dateFormatter,
  boolFormatter,
  type CsvColumn,
} from '@withwiz/toolkit/next/utils/csv-export';
import { customDateFormatter } from '@withwiz/toolkit/next/utils/csv-export-format';
import { logger } from '@withwiz/toolkit/core/logger/logger';

const BOM_BYTES = [0xef, 0xbb, 0xbf];
const FIXED_NOW = new Date('2026-09-15T08:00:00Z');

/** 응답 본문을 바이트 그대로 읽는다 (Response.text() 는 BOM 을 제거하므로 사용하지 않음). */
async function readBytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

function decodeWithoutBom(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
}

function startsWithBom(bytes: Uint8Array): boolean {
  return BOM_BYTES.every((b, i) => bytes[i] === b);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// SC-UNIT-CSV-001: CSV 필드 이스케이프
// ============================================================================
describe('SC-UNIT-CSV-001: escapeCsvField', () => {
  it('null → 빈 따옴표', () => {
    expect(escapeCsvField(null)).toBe('""');
  });

  it('undefined → 빈 따옴표', () => {
    expect(escapeCsvField(undefined)).toBe('""');
  });

  it('일반 문자열 → 따옴표로 감싼다', () => {
    expect(escapeCsvField('hello')).toBe('"hello"');
  });

  it('따옴표 포함 → 따옴표를 두 번 쓴다', () => {
    expect(escapeCsvField('a"b')).toBe('"a""b"');
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it('숫자 → 문자열로 바꿔 감싼다', () => {
    expect(escapeCsvField(123)).toBe('"123"');
  });

  it('불리언 → 문자열로 바꿔 감싼다', () => {
    expect(escapeCsvField(true)).toBe('"true"');
    expect(escapeCsvField(false)).toBe('"false"');
  });

  it('쉼표와 줄바꿈은 따옴표 안에 그대로 둔다', () => {
    expect(escapeCsvField('a,b\nc')).toBe('"a,b\nc"');
  });
});

// ============================================================================
// SC-UNIT-CSV-002: 행·헤더 생성
// ============================================================================
describe('SC-UNIT-CSV-002: rowToCsv·createCsvHeader', () => {
  interface TestData {
    name: string;
    age: number;
    active: boolean;
    memo?: string | null;
  }

  const columns: CsvColumn<TestData>[] = [
    { header: 'Name', accessor: 'name' },
    { header: 'Age', accessor: 'age' },
    { header: 'Active', accessor: (row) => (row.active ? 'Yes' : 'No') },
  ];

  it('객체 데이터 → CSV 행', () => {
    expect(rowToCsv({ name: 'John', age: 30, active: true }, columns)).toBe('"John","30","Yes"');
  });

  it('accessor 함수 결과를 사용한다', () => {
    expect(rowToCsv({ name: 'Jane', age: 25, active: false }, columns)).toBe('"Jane","25","No"');
  });

  it('값이 null·undefined 인 컬럼은 빈 따옴표가 된다', () => {
    const memoColumns: CsvColumn<TestData>[] = [
      { header: 'Memo', accessor: 'memo' },
      { header: 'Missing', accessor: () => undefined },
    ];
    expect(rowToCsv({ name: 'x', age: 1, active: true, memo: null }, memoColumns)).toBe('"",""');
  });

  it('헤더 행을 만든다', () => {
    expect(createCsvHeader(columns)).toBe('"Name","Age","Active"');
  });
});

// ============================================================================
// SC-UNIT-CSV-003: 날짜 포맷터
// ============================================================================
describe('SC-UNIT-CSV-003: dateFormatter·customDateFormatter', () => {
  const testDate = new Date('2025-01-15T12:30:00Z');

  it('iso: Date → YYYY-MM-DD (UTC)', () => {
    expect(dateFormatter.iso(testDate)).toBe('2025-01-15');
  });

  it('iso: null → 빈 문자열', () => {
    expect(dateFormatter.iso(null)).toBe('');
  });

  it('iso: undefined → 빈 문자열', () => {
    expect(dateFormatter.iso(undefined)).toBe('');
  });

  it('korean: ko-KR 로케일 문자열', () => {
    expect(dateFormatter.korean(testDate)).toBe(testDate.toLocaleString('ko-KR'));
  });

  it('korean: null → 빈 문자열', () => {
    expect(dateFormatter.korean(null)).toBe('');
  });

  it('english: en-US 로케일 문자열', () => {
    expect(dateFormatter.english(testDate)).toBe(testDate.toLocaleString('en-US'));
  });

  it('english: null → 빈 문자열', () => {
    expect(dateFormatter.english(null)).toBe('');
  });

  it('customDateFormatter: null·undefined → 빈 문자열', () => {
    expect(customDateFormatter(null, 'yyyy-MM-dd')).toBe('');
    expect(customDateFormatter(undefined, 'yyyy-MM-dd')).toBe('');
  });

  it('customDateFormatter: date-fns 형식 문자열을 적용한다', () => {
    expect(customDateFormatter(testDate, 'yyyy')).toBe('2025');
  });

  it('customDateFormatter: date-fns 가 거부하는 형식이면 ISO 문자열로 폴백한다', () => {
    expect(customDateFormatter(testDate, 'j')).toBe(testDate.toISOString());
  });
});

// ============================================================================
// SC-UNIT-CSV-004: 불리언 포맷터
// ============================================================================
describe('SC-UNIT-CSV-004: boolFormatter', () => {
  it.each([
    ['activeInactive', true, 'Active'],
    ['activeInactive', false, 'Inactive'],
    ['yesNo', true, 'Yes'],
    ['yesNo', false, 'No'],
    ['numeric', true, '1'],
    ['numeric', false, '0'],
    ['verified', true, 'Verified'],
    ['verified', false, 'Not Verified'],
    ['korean', true, '예'],
    ['korean', false, '아니오'],
  ] as const)('%s(%s) → %s', (name, value, expected) => {
    expect(boolFormatter[name](value)).toBe(expected);
  });
});

// ============================================================================
// createSimpleCsvResponse
// ============================================================================
describe('createSimpleCsvResponse', () => {
  const columns: CsvColumn<{ name: string }>[] = [{ header: '이름', accessor: 'name' }];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('BOM + 헤더 + 행을 CRLF 로 잇고 CSV 다운로드 헤더를 붙인다', async () => {
    const response = createSimpleCsvResponse([{ name: '홍길동' }], { filename: 'users', columns });
    const bytes = await readBytes(response);

    expect(response.status).toBe(200);
    expect(startsWithBom(bytes)).toBe(true);
    expect(decodeWithoutBom(bytes)).toBe('﻿"이름"\r\n"홍길동"');
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="users_2026-09-15.csv"');
  });

  it('includeBom: false 이면 BOM 없이 시작한다', async () => {
    const response = createSimpleCsvResponse([{ name: '홍길동' }], { filename: 'users', columns, includeBom: false });
    const bytes = await readBytes(response);

    expect(startsWithBom(bytes)).toBe(false);
    expect(decodeWithoutBom(bytes)).toBe('"이름"\r\n"홍길동"');
  });

  it('데이터가 없으면 헤더만 담고 완료 로그에 행 수 0 과 logContext 를 남긴다', async () => {
    const response = createSimpleCsvResponse([], { filename: 'users', columns, logContext: { adminId: 'a1' } });

    expect(decodeWithoutBom(await readBytes(response))).toBe('﻿"이름"');
    expect(logger.info).toHaveBeenCalledWith('CSV export completed', { filename: 'users', rowCount: 0, adminId: 'a1' });
  });

  it('accessor 가 throw 하면 오류를 기록하고 다시 던진다', () => {
    const failing: CsvColumn<{ name: string }>[] = [
      { header: 'x', accessor: () => { throw new Error('bad row'); } },
    ];

    expect(() => createSimpleCsvResponse([{ name: 'a' }], { filename: 'users', columns: failing })).toThrow('bad row');
    expect(logger.error).toHaveBeenCalledWith('CSV export error', expect.objectContaining({ filename: 'users' }));
  });
});

// ============================================================================
// createStreamingCsvResponse
// ============================================================================
describe('createStreamingCsvResponse', () => {
  const columns: CsvColumn<{ name: string }>[] = [{ header: '이름', accessor: 'name' }];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('배치를 이어 읽어 헤더 + 전체 행을 스트리밍한다', async () => {
    const fetcher = vi.fn(async (cursor?: string) =>
      cursor === undefined
        ? { data: [{ name: 'a' }, { name: 'b' }], nextCursor: 'c1' }
        : { data: [{ name: 'c' }] },
    );

    const response = createStreamingCsvResponse({ filename: 'stream', columns, batchSize: 2, fetcher });
    const bytes = await readBytes(response);

    expect(startsWithBom(bytes)).toBe(true);
    expect(decodeWithoutBom(bytes)).toBe('﻿"이름"\r\n"a"\r\n"b"\r\n"c"\r\n');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(1, undefined);
    expect(fetcher).toHaveBeenNthCalledWith(2, 'c1');
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="stream_2026-09-15.csv"');
    expect(logger.info).toHaveBeenCalledWith(
      'Streaming CSV export completed',
      expect.objectContaining({ filename: 'stream', totalCount: 3, batchCount: 2 }),
    );
  });

  it('첫 배치가 비어 있으면 헤더만 보내고 fetcher 를 1회만 호출한다', async () => {
    const fetcher = vi.fn(async () => ({ data: [] as { name: string }[], nextCursor: 'ignored' }));

    const response = createStreamingCsvResponse({ filename: 'empty', columns, includeBom: false, fetcher });

    expect(decodeWithoutBom(await readBytes(response))).toBe('"이름"\r\n');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('nextCursor 가 없으면 배치가 가득 차도 종료한다', async () => {
    const fetcher = vi.fn(async () => ({ data: [{ name: 'a' }, { name: 'b' }] }));

    const response = createStreamingCsvResponse({ filename: 'full', columns, batchSize: 2, includeBom: false, fetcher });

    expect(decodeWithoutBom(await readBytes(response))).toBe('"이름"\r\n"a"\r\n"b"\r\n');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fetcher 가 throw 하면 스트림이 중단되어 본문 읽기가 reject 되고 오류를 기록한다', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('db down');
    });

    const response = createStreamingCsvResponse({ filename: 'broken', columns, fetcher });

    await expect(response.arrayBuffer()).rejects.toThrow('db down');
    expect(logger.error).toHaveBeenCalledWith(
      'Streaming CSV export error',
      expect.objectContaining({ filename: 'broken' }),
    );
  });
});

// ============================================================================
// Content-Disposition 파일명 인코딩
// ============================================================================
describe('Content-Disposition 파일명 인코딩', () => {
  const columns: CsvColumn<{ name: string }>[] = [{ header: '이름', accessor: 'name' }];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** filename*=UTF-8''... 값을 디코딩한다. */
  function decodeExtendedFilename(disposition: string | null): string | null {
    const match = disposition?.match(/filename\*=UTF-8''([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  it('한글 파일명도 응답을 만들고 ASCII 대체 이름과 UTF-8 filename* 을 함께 싣는다', async () => {
    const response = createSimpleCsvResponse([{ name: '홍길동' }], { filename: '회원목록', columns });
    const disposition = response.headers.get('Content-Disposition');

    expect(disposition).toBe(
      "attachment; filename=\"_____2026-09-15.csv\"; filename*=UTF-8''%ED%9A%8C%EC%9B%90%EB%AA%A9%EB%A1%9D_2026-09-15.csv",
    );
    expect(decodeExtendedFilename(disposition)).toBe('회원목록_2026-09-15.csv');
    expect(decodeWithoutBom(await readBytes(response))).toBe('\uFEFF"이름"\r\n"홍길동"');
  });

  it('스트리밍 응답도 한글 파일명으로 만들고 본문을 끝까지 읽을 수 있다', async () => {
    const fetcher = vi.fn(async () => ({ data: [{ name: 'a' }] }));

    const response = createStreamingCsvResponse({ filename: '주문내역', columns, includeBom: false, fetcher });

    expect(decodeExtendedFilename(response.headers.get('Content-Disposition'))).toBe('주문내역_2026-09-15.csv');
    expect(decodeWithoutBom(await readBytes(response))).toBe('"이름"\r\n"a"\r\n');
  });

  it('따옴표가 들어간 파일명은 대체 이름에서 치환하고 filename* 에 원래 이름을 싣는다', () => {
    const response = createSimpleCsvResponse([], { filename: 'report "Q3"', columns });
    const disposition = response.headers.get('Content-Disposition')!;

    expect(disposition.startsWith('attachment; filename="report _Q3__2026-09-15.csv";')).toBe(true);
    expect(decodeExtendedFilename(disposition)).toBe('report "Q3"_2026-09-15.csv');
  });

  it('줄바꿈이 들어간 파일명으로 헤더를 추가 주입할 수 없다', () => {
    const response = createSimpleCsvResponse([], { filename: 'a\r\nX-Injected: 1', columns });

    expect(response.headers.get('X-Injected')).toBeNull();
    expect(response.headers.get('Content-Disposition')).not.toMatch(/[\r\n]/);
  });
});
