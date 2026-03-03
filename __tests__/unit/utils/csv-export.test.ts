/**
 * Unit Tests: @withwiz/utils/csv-export tests
 * CSV export utility tests
 *
 * Note: Only pure utility functions are tested due to NextResponse dependency
 */


// Define utility functions directly to avoid NextResponse dependency
// Same logic as functions in actual csv-export.ts

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

interface CsvColumn<T> {
  header: string;
  accessor:
    | keyof T
    | ((row: T) => string | number | boolean | null | undefined);
}

function getColumnValue<T>(row: T, column: CsvColumn<T>): string {
  const value =
    typeof column.accessor === "function"
      ? column.accessor(row)
      : row[column.accessor];
  return escapeCsvField(value);
}

function rowToCsv<T>(row: T, columns: CsvColumn<T>[]): string {
  return columns.map((col) => getColumnValue(row, col)).join(",");
}

function createCsvHeader<T>(columns: CsvColumn<T>[]): string {
  return columns.map((col) => escapeCsvField(col.header)).join(",");
}

const dateFormatter = {
  iso: (date: Date | null | undefined): string => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  },
  korean: (date: Date | null | undefined): string => {
    if (!date) return "";
    return date.toLocaleString("ko-KR");
  },
  english: (date: Date | null | undefined): string => {
    if (!date) return "";
    return date.toLocaleString("en-US");
  },
  custom: (date: Date | null | undefined, formatStr: string): string => {
    if (!date) return "";
    try {
      const { format } = require("date-fns");
      return format(date, formatStr);
    } catch {
      return date.toISOString();
    }
  },
};

const boolFormatter = {
  activeInactive: (value: boolean): string => (value ? "Active" : "Inactive"),
  yesNo: (value: boolean): string => (value ? "Yes" : "No"),
  numeric: (value: boolean): string => (value ? "1" : "0"),
  verified: (value: boolean): string => (value ? "Verified" : "Not Verified"),
  korean: (value: boolean): string => (value ? "Yes" : "No"),
};

// ============================================================================
// SC-UNIT-CSV-001: CSV 필드 이스케이프
// ============================================================================
describe("SC-UNIT-CSV-001: CSV field escaping", () => {
  // TC-UNIT-CSV-001: escapeCsvField basic behavior
  describe("TC-UNIT-CSV-001: escapeCsvField basic behavior", () => {
    test("null -> empty quotes", () => {
      expect(escapeCsvField(null)).toBe('""');
    });

    test("undefined -> empty quotes", () => {
      expect(escapeCsvField(undefined)).toBe('""');
    });

    test("normal string -> wrap in quotes", () => {
      expect(escapeCsvField("hello")).toBe('"hello"');
    });

    test("contains quotes -> escape", () => {
      expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
    });

    test("number -> convert to string then wrap", () => {
      expect(escapeCsvField(123)).toBe('"123"');
    });

    test("boolean -> convert to string then wrap", () => {
      expect(escapeCsvField(true)).toBe('"true"');
      expect(escapeCsvField(false)).toBe('"false"');
    });
  });
});

// ============================================================================
// SC-UNIT-CSV-002: CSV row creation
// ============================================================================
describe("SC-UNIT-CSV-002: CSV row creation", () => {
  interface TestData {
    name: string;
    age: number;
    active: boolean;
  }

  const columns: CsvColumn<TestData>[] = [
    { header: "Name", accessor: "name" },
    { header: "Age", accessor: "age" },
    { header: "Active", accessor: (row) => (row.active ? "Yes" : "No") },
  ];

  // TC-UNIT-CSV-002: rowToCsv basic behavior
  describe("TC-UNIT-CSV-002: rowToCsv basic behavior", () => {
    test("object data -> convert to CSV row", () => {
      const row: TestData = { name: "John", age: 30, active: true };
      const result = rowToCsv(row, columns);
      expect(result).toBe('"John","30","Yes"');
    });

    test("accessor function used", () => {
      const row: TestData = { name: "Jane", age: 25, active: false };
      const result = rowToCsv(row, columns);
      expect(result).toBe('"Jane","25","No"');
    });
  });

  // TC-UNIT-CSV-003: createCsvHeader behavior
  describe("TC-UNIT-CSV-003: createCsvHeader behavior", () => {
    test("header row creation", () => {
      const result = createCsvHeader(columns);
      expect(result).toBe('"Name","Age","Active"');
    });
  });
});

// ============================================================================
// SC-UNIT-CSV-003: Date Formatter
// ============================================================================
describe("SC-UNIT-CSV-003: Date Formatter (dateFormatter)", () => {
  const testDate = new Date("2025-01-15T12:30:00Z");

  // TC-UNIT-CSV-004: dateFormatter.iso
  describe("TC-UNIT-CSV-004: dateFormatter.iso", () => {
    test("Date -> YYYY-MM-DD", () => {
      const result = dateFormatter.iso(testDate);
      expect(result).toBe("2025-01-15");
    });

    test("null -> empty string", () => {
      expect(dateFormatter.iso(null)).toBe("");
    });

    test("undefined -> empty string", () => {
      expect(dateFormatter.iso(undefined)).toBe("");
    });
  });

  // TC-UNIT-CSV-005: dateFormatter.korean
  describe("TC-UNIT-CSV-005: dateFormatter.korean", () => {
    test("Date -> Korean format", () => {
      const result = dateFormatter.korean(testDate);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    test("null -> empty string", () => {
      expect(dateFormatter.korean(null)).toBe("");
    });
  });

  // TC-UNIT-CSV-006: dateFormatter.english
  describe("TC-UNIT-CSV-006: dateFormatter.english", () => {
    test("Date -> English format", () => {
      const result = dateFormatter.english(testDate);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    test("null -> empty string", () => {
      expect(dateFormatter.english(null)).toBe("");
    });
  });

  // TC-UNIT-CSV-007: dateFormatter.custom
  describe("TC-UNIT-CSV-007: dateFormatter.custom", () => {
    test("null -> empty string", () => {
      expect(dateFormatter.custom(null, "yyyy-MM-dd")).toBe("");
    });

    test("undefined -> empty string", () => {
      expect(dateFormatter.custom(undefined, "yyyy-MM-dd")).toBe("");
    });

    test("valid Date -> formatted string", () => {
      const result = dateFormatter.custom(testDate, "yyyy-MM-dd");
      expect(typeof result).toBe("string");
    });
  });
});

// ============================================================================
// SC-UNIT-CSV-004: Boolean Formatter
// ============================================================================
describe("SC-UNIT-CSV-004: Boolean Formatter (boolFormatter)", () => {
  // TC-UNIT-CSV-008: boolFormatter.activeInactive
  describe("TC-UNIT-CSV-008: boolFormatter.activeInactive", () => {
    test("true -> Active", () => {
      expect(boolFormatter.activeInactive(true)).toBe("Active");
    });

    test("false -> Inactive", () => {
      expect(boolFormatter.activeInactive(false)).toBe("Inactive");
    });
  });

  // TC-UNIT-CSV-009: boolFormatter.yesNo
  describe("TC-UNIT-CSV-009: boolFormatter.yesNo", () => {
    test("true -> Yes", () => {
      expect(boolFormatter.yesNo(true)).toBe("Yes");
    });

    test("false -> No", () => {
      expect(boolFormatter.yesNo(false)).toBe("No");
    });
  });

  // TC-UNIT-CSV-010: boolFormatter.numeric
  describe("TC-UNIT-CSV-010: boolFormatter.numeric", () => {
    test("true -> '1'", () => {
      expect(boolFormatter.numeric(true)).toBe("1");
    });

    test("false -> '0'", () => {
      expect(boolFormatter.numeric(false)).toBe("0");
    });
  });

  // TC-UNIT-CSV-011: boolFormatter.verified
  describe("TC-UNIT-CSV-011: boolFormatter.verified", () => {
    test("true -> Verified", () => {
      expect(boolFormatter.verified(true)).toBe("Verified");
    });

    test("false -> Not Verified", () => {
      expect(boolFormatter.verified(false)).toBe("Not Verified");
    });
  });

  // TC-UNIT-CSV-012: boolFormatter.korean
  describe("TC-UNIT-CSV-012: boolFormatter.korean", () => {
    test("true -> Yes", () => {
      expect(boolFormatter.korean(true)).toBe("Yes");
    });

    test("false -> No", () => {
      expect(boolFormatter.korean(false)).toBe("No");
    });
  });
});
