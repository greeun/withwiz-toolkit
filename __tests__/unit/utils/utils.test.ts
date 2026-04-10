/**
 * Unit Tests: @withwiz/utils utility functions tests
 * Achieve 100% coverage by importing actual source code functions
 */


// 실제 유틸리티 함수 import
import {
  normalizeUrl,
  validateUrl,
  hasValidScheme,
  extractScheme,
  isWebUrl,
  isAppScheme,
  getUrlType,
  SUPPORTED_SCHEMES,
} from "@withwiz/utils/url-normalizer";

import {
  generateShortCode,
  generateUniqueShortCode,
} from "@withwiz/utils/short-code-generator";

import {
  isPrivateIP,
  isIPv6,
  normalizeIP,
  extractClientIp,
  isValidIP,
} from "@withwiz/utils/ip-utils";

import {
  sanitizeHtml,
  sanitizeUrl,
  sanitizeInput,
  sanitizeArray,
  sanitizeObjectFields,
  removeEventHandlers,
} from "@withwiz/utils/sanitizer";

import {
  formatNumber,
  formatChartNumber,
} from "@withwiz/utils/format-number";

import {
  getCurrentUTC,
  utcToLocal,
  localToUTC,
  formatUserFriendlyDate,
  formatSimpleDate,
  formatSimpleTime,
  formatFullDateTime,
  formatTableDateTime,
  getRelativeTime,
  getUserTimezone,
  getTimezoneOffset,
  toUTCISOString,
} from "@withwiz/utils/timezone";

// ============================================================================
// SC-UNIT-UTIL-001: URL Normalization (url-normalizer.ts)
// ============================================================================
describe("SC-UNIT-UTIL-001: URL Normalization (url-normalizer.ts)", () => {
  // TC-UNIT-URL-001: normalizeUrl basic operations
  describe("TC-UNIT-URL-001: normalizeUrl basic operations", () => {
    test("empty string input → returns empty string", () => {
      expect(normalizeUrl("")).toBe("");
    });

    test("whitespace only string → returns empty string", () => {
      expect(normalizeUrl("   ")).toBe("");
    });

    test("http:// URL → returns as is", () => {
      expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    });

    test("https:// URL → returns as is", () => {
      expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    });

    test("URL without scheme → adds https://", () => {
      expect(normalizeUrl("example.com")).toBe("https://example.com");
    });

    test("URL starting with // → adds https:", () => {
      expect(normalizeUrl("//example.com")).toBe("https://example.com");
    });

    test("removes leading/trailing whitespace", () => {
      expect(normalizeUrl("  https://example.com  ")).toBe(
        "https://example.com",
      );
    });

    test("app scheme URL → returns as is", () => {
      expect(normalizeUrl("mailto:test@example.com")).toBe(
        "mailto:test@example.com",
      );
      expect(normalizeUrl("tel:+821012345678")).toBe("tel:+821012345678");
    });
  });

  // TC-UNIT-URL-002: hasValidScheme validation
  describe("TC-UNIT-URL-002: hasValidScheme validation", () => {
    test("http:// → true", () => {
      expect(hasValidScheme("http://example.com")).toBe(true);
    });

    test("https:// → true", () => {
      expect(hasValidScheme("https://example.com")).toBe(true);
    });

    test("mailto: → true", () => {
      expect(hasValidScheme("mailto:test@example.com")).toBe(true);
    });

    test("tel: → true", () => {
      expect(hasValidScheme("tel:+821012345678")).toBe(true);
    });

    test("app scheme → true", () => {
      expect(hasValidScheme("kakaotalk://send")).toBe(true);
      expect(hasValidScheme("instagram://user")).toBe(true);
    });

    test("invalid URL format → false", () => {
      expect(hasValidScheme("not-a-valid-url")).toBe(false);
    });
  });

  // TC-UNIT-URL-003: extractScheme validation
  describe("TC-UNIT-URL-003: extractScheme validation", () => {
    test("https:// URL → returns https", () => {
      expect(extractScheme("https://example.com")).toBe("https");
    });

    test("http:// URL → returns http", () => {
      expect(extractScheme("http://example.com")).toBe("http");
    });

    test("mailto: URL → returns mailto", () => {
      expect(extractScheme("mailto:test@example.com")).toBe("mailto");
    });

    test("string without scheme → null", () => {
      expect(extractScheme("example.com")).toBeNull();
    });
  });

  // TC-UNIT-URL-004: validateUrl validation
  describe("TC-UNIT-URL-004: validateUrl validation", () => {
    test("valid URL → isValid: true", () => {
      const result = validateUrl("https://example.com");
      expect(result.isValid).toBe(true);
      expect(result.messageKey).toBe("validUrl");
    });

    test("empty URL → isValid: false, urlRequired", () => {
      const result = validateUrl("");
      expect(result.isValid).toBe(false);
      expect(result.messageKey).toBe("urlRequired");
    });

    test("domain without scheme → valid after adding https", () => {
      const result = validateUrl("example.com");
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBe("https://example.com");
    });

    test("localhost → valid", () => {
      const result = validateUrl("http://localhost:3000");
      expect(result.isValid).toBe(true);
    });

    test("URL without domain → invalidDomain", () => {
      const result = validateUrl("https://");
      expect(result.isValid).toBe(false);
    });

    test("domain without dot (except localhost) → invalidDomainFormat", () => {
      const result = validateUrl("https://notadomain");
      expect(result.isValid).toBe(false);
      expect(result.messageKey).toBe("invalidDomainFormat");
    });

    test("mailto: valid email → valid", () => {
      const result = validateUrl("mailto:test@example.com");
      expect(result.isValid).toBe(true);
    });

    test("mailto: invalid email → invalidEmail", () => {
      const result = validateUrl("mailto:invalid-email");
      expect(result.isValid).toBe(false);
      expect(result.messageKey).toBe("invalidEmail");
    });

    test("tel: valid phone number → valid", () => {
      const result = validateUrl("tel:+821012345678");
      expect(result.isValid).toBe(true);
    });

    test("tel: phone number without digits → invalidPhone", () => {
      const result = validateUrl("tel:no-numbers");
      expect(result.isValid).toBe(false);
      expect(result.messageKey).toBe("invalidPhone");
    });

    test("URL exceeding 2048 chars → urlTooLong", () => {
      const longPath = "a".repeat(2100);
      const result = validateUrl(`https://example.com/${longPath}`);
      expect(result.isValid).toBe(false);
      expect(result.messageKey).toBe("urlTooLong");
    });

    test("skipNormalization option → validate without normalization", () => {
      const result = validateUrl("not-a-url", { skipNormalization: true });
      expect(result.isValid).toBe(false);
      expect(result.messageKey).toBe("invalidUrlFormat");
    });
  });

  // TC-UNIT-URL-005: isWebUrl, isAppScheme, getUrlType validation
  describe("TC-UNIT-URL-005: URL type validation functions", () => {
    test("isWebUrl - http/https → true", () => {
      expect(isWebUrl("http://example.com")).toBe(true);
      expect(isWebUrl("https://example.com")).toBe(true);
    });

    test("isWebUrl - app scheme → false", () => {
      expect(isWebUrl("mailto:test@example.com")).toBe(false);
      expect(isWebUrl("tel:123")).toBe(false);
    });

    test("isWebUrl - invalid URL → false", () => {
      expect(isWebUrl("not-a-url")).toBe(false);
    });

    test("isAppScheme - mailto/tel → true", () => {
      expect(isAppScheme("mailto:test@example.com")).toBe(true);
      expect(isAppScheme("tel:123")).toBe(true);
    });

    test("isAppScheme - http/https → false", () => {
      expect(isAppScheme("http://example.com")).toBe(false);
      expect(isAppScheme("https://example.com")).toBe(false);
    });

    test("isAppScheme - invalid URL → false", () => {
      expect(isAppScheme("not-a-url")).toBe(false);
    });

    test("getUrlType - web", () => {
      expect(getUrlType("https://example.com")).toBe("web");
    });

    test("getUrlType - email", () => {
      expect(getUrlType("mailto:test@example.com")).toBe("email");
    });

    test("getUrlType - tel", () => {
      expect(getUrlType("tel:123")).toBe("tel");
      expect(getUrlType("sms:123")).toBe("tel");
    });

    test("getUrlType - app", () => {
      expect(getUrlType("kakaotalk://send")).toBe("app");
    });

    test("getUrlType - invalid → other", () => {
      expect(getUrlType("not-a-url")).toBe("other");
    });
  });

  // TC-UNIT-URL-006: SUPPORTED_SCHEMES constant validation
  describe("TC-UNIT-URL-006: SUPPORTED_SCHEMES constant", () => {
    test("verify inclusion of required schemes", () => {
      expect(SUPPORTED_SCHEMES).toContain("http:");
      expect(SUPPORTED_SCHEMES).toContain("https:");
      expect(SUPPORTED_SCHEMES).toContain("mailto:");
      expect(SUPPORTED_SCHEMES).toContain("tel:");
    });

    test("verify exclusion of dangerous schemes", () => {
      expect(SUPPORTED_SCHEMES).not.toContain("javascript:");
      expect(SUPPORTED_SCHEMES).not.toContain("data:");
      expect(SUPPORTED_SCHEMES).not.toContain("file:");
    });
  });
});

// ============================================================================
// SC-UNIT-UTIL-002: ShortCode Generation (short-code-generator.ts)
// ============================================================================
describe("SC-UNIT-UTIL-002: ShortCode Generation (short-code-generator.ts)", () => {
  // TC-UNIT-SC-001: generateShortCode basic operation
  describe("TC-UNIT-SC-001: generateShortCode basic operation", () => {
    test("generate default length (8 chars)", () => {
      const code = generateShortCode();
      expect(code).toHaveLength(8);
    });

    test("generate specified length", () => {
      expect(generateShortCode(6)).toHaveLength(6);
      expect(generateShortCode(10)).toHaveLength(10);
      expect(generateShortCode(4)).toHaveLength(4);
    });

    test("only include alphanumeric characters", () => {
      const code = generateShortCode(100);
      expect(/^[a-zA-Z0-9]+$/.test(code)).toBe(true);
    });

    test("invalid length → error", () => {
      expect(() => generateShortCode(0)).toThrow(
        "length must be a positive integer",
      );
      expect(() => generateShortCode(-1)).toThrow(
        "length must be a positive integer",
      );
      expect(() => generateShortCode(1.5)).toThrow(
        "length must be a positive integer",
      );
    });

    test("10,000 generations → high uniqueness", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 10000; i++) {
        codes.add(generateShortCode(8));
      }
      // Collisions should be extremely rare with 62^8 combinations
      expect(codes.size).toBeGreaterThan(9900);
    });
  });

  // TC-UNIT-SC-002: generateUniqueShortCode basic operation
  describe("TC-UNIT-SC-002: generateUniqueShortCode basic operation", () => {
    test("generate without duplicate check", async () => {
      const code = await generateUniqueShortCode();
      expect(code).toHaveLength(8);
    });

    test("generate with custom length", async () => {
      const code = await generateUniqueShortCode({ length: 6 });
      expect(code).toHaveLength(6);
    });

    test("using duplicate check function", async () => {
      let attempts = 0;
      const code = await generateUniqueShortCode({
        length: 6,
        checkDuplicate: async () => {
          attempts++;
          // Treat first 2 as duplicates
          return attempts <= 2;
        },
      });
      expect(code).toHaveLength(6);
      expect(attempts).toBe(3); // Success on 3rd attempt
    });

    test("exceeding maxAttempts → error", async () => {
      await expect(
        generateUniqueShortCode({
          maxAttempts: 5,
          checkDuplicate: async () => true, // Always duplicate
        }),
      ).rejects.toThrow(
        "Failed to generate unique shortCode after multiple attempts",
      );
    });
  });
});

// ============================================================================
// SC-UNIT-UTIL-003: IP Utilities (ip-utils.ts)
// ============================================================================
describe("SC-UNIT-UTIL-003: IP Utilities (ip-utils.ts)", () => {
  // TC-UNIT-IP-001: isPrivateIP validation
  describe("TC-UNIT-IP-001: isPrivateIP validation", () => {
    test("empty string → false", () => {
      expect(isPrivateIP("")).toBe(false);
    });

    test("10.x.x.x → private", () => {
      expect(isPrivateIP("10.0.0.1")).toBe(true);
      expect(isPrivateIP("10.255.255.255")).toBe(true);
    });

    test("172.16-31.x.x → private", () => {
      expect(isPrivateIP("172.16.0.1")).toBe(true);
      expect(isPrivateIP("172.31.255.255")).toBe(true);
    });

    test("192.168.x.x → private", () => {
      expect(isPrivateIP("192.168.1.1")).toBe(true);
      expect(isPrivateIP("192.168.0.1")).toBe(true);
    });

    test("127.x.x.x → private (localhost)", () => {
      expect(isPrivateIP("127.0.0.1")).toBe(true);
    });

    test("169.254.x.x → private (link-local)", () => {
      expect(isPrivateIP("169.254.1.1")).toBe(true);
    });

    test("public IP → false", () => {
      expect(isPrivateIP("8.8.8.8")).toBe(false);
      expect(isPrivateIP("1.1.1.1")).toBe(false);
    });

    test("IPv6 ::1 → private", () => {
      expect(isPrivateIP("::1")).toBe(true);
    });

    test("IPv6 fe80: → private (link-local)", () => {
      expect(isPrivateIP("fe80:0000:0000:0000")).toBe(true);
    });

    test("IPv6 fc00:/fd00: → private (unique local)", () => {
      expect(isPrivateIP("fc00:0000:0000:0000")).toBe(true);
      expect(isPrivateIP("fd00:0000:0000:0000")).toBe(true);
    });
  });

  // TC-UNIT-IP-002: isIPv6 validation
  describe("TC-UNIT-IP-002: isIPv6 validation", () => {
    test("IPv4 → false", () => {
      expect(isIPv6("192.168.1.1")).toBe(false);
    });

    test("IPv6 → true", () => {
      expect(isIPv6("::1")).toBe(true);
      expect(isIPv6("2001:db8::1")).toBe(true);
    });
  });

  // TC-UNIT-IP-003: normalizeIP validation
  describe("TC-UNIT-IP-003: normalizeIP validation", () => {
    test("empty string → empty string", () => {
      expect(normalizeIP("")).toBe("");
    });

    test("IPv4 → returns as is", () => {
      expect(normalizeIP("192.168.1.1")).toBe("192.168.1.1");
    });

    test("IPv6 → converts to lowercase", () => {
      expect(normalizeIP("::1")).toBe("::1");
      expect(normalizeIP("2001:DB8::1")).toBe("2001:db8::1");
    });
  });

  // TC-UNIT-IP-004: isValidIP validation
  describe("TC-UNIT-IP-004: isValidIP validation", () => {
    test("empty/null input → false", () => {
      expect(isValidIP("")).toBe(false);
      expect(isValidIP(null as unknown as string)).toBe(false);
    });

    test("valid IPv4 → true", () => {
      expect(isValidIP("192.168.1.1")).toBe(true);
      expect(isValidIP("0.0.0.0")).toBe(true);
      expect(isValidIP("255.255.255.255")).toBe(true);
    });

    test("invalid IPv4 → false", () => {
      expect(isValidIP("256.1.1.1")).toBe(false);
      expect(isValidIP("1.1.1")).toBe(false);
      expect(isValidIP("1.1.1.1.1")).toBe(false);
    });

    test("valid IPv6 → true", () => {
      expect(isValidIP("::1")).toBe(true);
    });

    test("invalid string → false", () => {
      expect(isValidIP("not-an-ip")).toBe(false);
    });
  });

  // TC-UNIT-IP-005: extractClientIp validation
  describe("TC-UNIT-IP-005: extractClientIp validation", () => {
    test("cf-connecting-ip header → prioritized use", () => {
      const headers = new Headers();
      headers.set("cf-connecting-ip", "1.2.3.4");
      headers.set("x-forwarded-for", "5.6.7.8");
      expect(extractClientIp(headers)).toBe("1.2.3.4");
    });

    test("true-client-ip header", () => {
      const headers = new Headers();
      headers.set("true-client-ip", "1.2.3.4");
      expect(extractClientIp(headers)).toBe("1.2.3.4");
    });

    test("x-real-ip header → ignored (spoofable)", () => {
      const headers = new Headers();
      headers.set("x-real-ip", "1.2.3.4");
      expect(extractClientIp(headers)).toBeNull();
    });

    test("x-forwarded-for header → uses last IP (proxy-added)", () => {
      const headers = new Headers();
      headers.set("x-forwarded-for", "1.2.3.4, 5.6.7.8, 9.10.11.12");
      expect(extractClientIp(headers)).toBe("9.10.11.12");
    });

    test("x-client-ip header → ignored (spoofable)", () => {
      const headers = new Headers();
      headers.set("x-client-ip", "1.2.3.4");
      expect(extractClientIp(headers)).toBeNull();
    });

    test("no headers → null", () => {
      const headers = new Headers();
      expect(extractClientIp(headers)).toBeNull();
    });

    test("invalid IP header → attempts next header", () => {
      const headers = new Headers();
      headers.set("cf-connecting-ip", "invalid-ip");
      headers.set("x-forwarded-for", "5.6.7.8");
      expect(extractClientIp(headers)).toBe("5.6.7.8");
    });
  });
});

// ============================================================================
// SC-UNIT-UTIL-004: Sanitizer (sanitizer.ts)
// ============================================================================
describe("SC-UNIT-UTIL-004: Sanitizer (sanitizer.ts)", () => {
  // TC-UNIT-SAN-001: sanitizeHtml validation
  describe("TC-UNIT-SAN-001: sanitizeHtml validation", () => {
    test("empty/null input → empty string", () => {
      expect(sanitizeHtml("")).toBe("");
      expect(sanitizeHtml(null as unknown as string)).toBe("");
    });

    test("remove HTML tags", () => {
      expect(sanitizeHtml("<b>bold</b>")).toBe("bold");
      expect(sanitizeHtml("<div>content</div>")).toBe("content");
    });

    test("script tag removal", () => {
      // sanitizeHtml only removes tags, content remains
      const result = sanitizeHtml('<script>alert("xss")</script>Hello');
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("</script>");
      expect(result).toContain("Hello");
    });

    test("handle escaped HTML entities", () => {
      expect(sanitizeHtml("&lt;script&gt;")).toBe("");
      expect(sanitizeHtml("&amp;")).toBe("&");
      expect(sanitizeHtml("&quot;")).toBe('"');
    });

    test("numeric HTML entity XSS prevention", () => {
      // &#60; = <, &#62; = > — 숫자 엔티티 우회 차단
      expect(sanitizeHtml("&#60;script&#62;alert(1)&#60;/script&#62;")).not.toContain("<");
      expect(sanitizeHtml("&#60;script&#62;alert(1)&#60;/script&#62;")).not.toContain(">");
    });

    test("incomplete tag XSS prevention", () => {
      // 닫는 >가 없는 불완전 태그 — HTML5 파서 우회 방지
      const result = sanitizeHtml("&lt;img src=x onerror=alert(1)//");
      expect(result).not.toContain("<img");
    });

    test("공백 trim 처리", () => {
      expect(sanitizeHtml("  hello world  ")).toBe("hello world");
    });
  });

  // TC-UNIT-SAN-002: removeEventHandlers validation
  describe("TC-UNIT-SAN-002: removeEventHandlers validation", () => {
    test("empty/null input → empty string", () => {
      expect(removeEventHandlers("")).toBe("");
      expect(removeEventHandlers(null as unknown as string)).toBe("");
    });

    test("remove onclick", () => {
      expect(removeEventHandlers('<div onclick="alert(1)">test</div>')).toBe(
        "<div >test</div>",
      );
    });

    test("remove onerror", () => {
      expect(removeEventHandlers('<img onerror="alert(1)">')).toBe("<img >");
    });

    test("remove onload", () => {
      expect(removeEventHandlers('<body onload="init()">')).toBe("<body >");
    });
  });

  // TC-UNIT-SAN-003: sanitizeUrl validation
  describe("TC-UNIT-SAN-003: sanitizeUrl validation", () => {
    test("empty/null input → empty string", () => {
      expect(sanitizeUrl("")).toBe("");
      expect(sanitizeUrl(null as unknown as string)).toBe("");
    });

    test("javascript: protocol → empty string", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("");
      expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBe("");
    });

    test("vbscript: protocol → empty string", () => {
      expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("");
    });

    test("data:text/html → empty string", () => {
      expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    });

    test("safe URL → returns as is", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
      expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
    });

    test("trim whitespace", () => {
      expect(sanitizeUrl("  https://example.com  ")).toBe(
        "https://example.com",
      );
    });
  });

  // TC-UNIT-SAN-004: sanitizeInput integration validation
  describe("TC-UNIT-SAN-004: sanitizeInput integration validation", () => {
    test("empty/null input → empty string", () => {
      expect(sanitizeInput("")).toBe("");
      expect(sanitizeInput(null as unknown as string)).toBe("");
    });

    test("remove both HTML and event handlers", () => {
      const result = sanitizeInput('<div onclick="test"><b>Hello</b></div>');
      expect(result).not.toContain("<");
      expect(result).not.toContain("onclick");
    });

    test("normalize consecutive whitespace", () => {
      expect(sanitizeInput("hello    world")).toBe("hello world");
    });
  });

  // TC-UNIT-SAN-005: sanitizeArray validation
  describe("TC-UNIT-SAN-005: sanitizeArray validation", () => {
    test("non-array input → empty array", () => {
      expect(sanitizeArray(null as unknown as string[])).toEqual([]);
    });

    test("sanitize string array", () => {
      const result = sanitizeArray(["<b>bold</b>", "  normal  ", ""]);
      expect(result).toEqual(["bold", "normal"]);
    });

    test("remove empty strings", () => {
      const result = sanitizeArray(["hello", "", "world"]);
      expect(result).toEqual(["hello", "world"]);
    });
  });

  // TC-UNIT-SAN-006: sanitizeObjectFields validation
  describe("TC-UNIT-SAN-006: sanitizeObjectFields validation", () => {
    test("sanitize only specified fields", () => {
      const obj = {
        name: "<b>Test</b>",
        description: "<script>alert(1)</script>Hello",
        untouched: "<i>italic</i>",
      };
      const result = sanitizeObjectFields(obj, ["name", "description"]);
      expect(result.name).toBe("Test");
      // sanitizeHtml only removes tags, content remains
      expect(result.description).not.toContain("<script>");
      expect(result.description).toContain("Hello");
      expect(result.untouched).toBe("<i>italic</i>");
    });

    test("sanitize array fields", () => {
      const obj = {
        tags: ["<b>tag1</b>", "tag2", ""],
      };
      const result = sanitizeObjectFields(obj, ["tags"]);
      expect(result.tags).toEqual(["tag1", "tag2"]);
    });
  });
});

// ============================================================================
// SC-UNIT-UTIL-005: Number Formatting (format-number.ts)
// ============================================================================
describe("SC-UNIT-UTIL-005: Number Formatting (format-number.ts)", () => {
  // TC-UNIT-FMT-001: formatNumber basic operations
  describe("TC-UNIT-FMT-001: formatNumber basic operations", () => {
    test("null/undefined → '-'", () => {
      expect(formatNumber(null)).toBe("-");
      expect(formatNumber(undefined)).toBe("-");
    });

    test("NaN → 'NaN'", () => {
      expect(formatNumber(NaN)).toBe("NaN");
      expect(formatNumber("not-a-number")).toBe("NaN");
    });

    test("Infinity → 'Infinity'", () => {
      expect(formatNumber(Infinity)).toBe("Infinity");
      expect(formatNumber(-Infinity)).toBe("-Infinity");
    });

    test("less than 1000 → display as is", () => {
      expect(formatNumber(999)).toBe("999");
      expect(formatNumber(0)).toBe("0");
      expect(formatNumber(100)).toBe("100");
    });

    test("1000 or more and less than 10M → locale format", () => {
      const result = formatNumber(1000);
      expect(result).toMatch(/1[,.]?000/);
    });

    test("10M or more → display in M units", () => {
      expect(formatNumber(10000000)).toBe("10.0M");
      expect(formatNumber(25500000)).toBe("25.5M");
    });

    test("negative number handling", () => {
      expect(formatNumber(-10000000)).toBe("-10.0M");
    });

    test("string number handling", () => {
      expect(formatNumber("1000")).toMatch(/1[,.]?000/);
    });
  });

  // TC-UNIT-FMT-002: formatChartNumber validation
  describe("TC-UNIT-FMT-002: formatChartNumber validation", () => {
    test("same behavior as formatNumber", () => {
      expect(formatChartNumber(null)).toBe("-");
      expect(formatChartNumber(10000000)).toBe("10.0M");
    });
  });
});

// ============================================================================
// SC-UNIT-UTIL-006: Timezone Utilities (timezone.ts)
// ============================================================================
describe("SC-UNIT-UTIL-006: Timezone Utilities (timezone.ts)", () => {
  // TC-UNIT-TZ-001: getCurrentUTC validation
  describe("TC-UNIT-TZ-001: getCurrentUTC validation", () => {
    test("returns Date object", () => {
      const result = getCurrentUTC();
      expect(result).toBeInstanceOf(Date);
    });
  });

  // TC-UNIT-TZ-002: utcToLocal validation
  describe("TC-UNIT-TZ-002: utcToLocal validation", () => {
    test("Date object input", () => {
      const utc = new Date("2025-01-15T12:00:00Z");
      const result = utcToLocal(utc);
      expect(result).toBeInstanceOf(Date);
    });

    test("string input", () => {
      const result = utcToLocal("2025-01-15T12:00:00Z");
      expect(result).toBeInstanceOf(Date);
    });

    test("specific timezone", () => {
      const utc = new Date("2025-01-15T12:00:00Z");
      const result = utcToLocal(utc, "Asia/Seoul");
      expect(result).toBeInstanceOf(Date);
    });
  });

  // TC-UNIT-TZ-003: localToUTC validation
  describe("TC-UNIT-TZ-003: localToUTC validation", () => {
    test("returns Date object", () => {
      const local = new Date();
      const result = localToUTC(local);
      expect(result).toBeInstanceOf(Date);
    });
  });

  // TC-UNIT-TZ-004: formatting functions validation
  describe("TC-UNIT-TZ-004: formatting functions validation", () => {
    const testDate = new Date("2025-01-15T12:30:45Z");

    test("formatUserFriendlyDate → returns string", () => {
      const result = formatUserFriendlyDate(testDate);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    test("formatSimpleDate → date format", () => {
      const result = formatSimpleDate(testDate);
      expect(typeof result).toBe("string");
    });

    test("formatSimpleTime → time format", () => {
      const result = formatSimpleTime(testDate);
      expect(typeof result).toBe("string");
    });

    test("formatFullDateTime → full datetime", () => {
      const result = formatFullDateTime(testDate);
      expect(typeof result).toBe("string");
    });

    test("formatTableDateTime → {date, time} object", () => {
      const result = formatTableDateTime(testDate);
      expect(result).toHaveProperty("date");
      expect(result).toHaveProperty("time");
    });
  });

  // TC-UNIT-TZ-005: getRelativeTime validation
  describe("TC-UNIT-TZ-005: getRelativeTime validation", () => {
    test("just now (less than 60s)", () => {
      const recent = new Date(Date.now() - 30000); // 30s ago
      expect(getRelativeTime(recent)).toBe("just now");
    });

    test("minutes", () => {
      const past = new Date(Date.now() - 5 * 60 * 1000); // 5m ago
      expect(getRelativeTime(past)).toBe("5m ago");
    });

    test("hours", () => {
      const past = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h ago
      expect(getRelativeTime(past)).toBe("3h ago");
    });

    test("days", () => {
      const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3d ago
      expect(getRelativeTime(past)).toBe("3d ago");
    });

    test("weeks", () => {
      const past = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 2w ago
      expect(getRelativeTime(past)).toBe("2w ago");
    });

    test("months", () => {
      const past = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // approx 2mo ago
      expect(getRelativeTime(past)).toBe("2mo ago");
    });

    test("years", () => {
      const past = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // approx 1y ago
      expect(getRelativeTime(past)).toBe("1y ago");
    });
  });

  // TC-UNIT-TZ-006: Timezone info functions
  describe("TC-UNIT-TZ-006: Timezone info functions", () => {
    test("getUserTimezone → returns string", () => {
      const tz = getUserTimezone();
      expect(typeof tz).toBe("string");
    });

    test("getTimezoneOffset → returns number", () => {
      const offset = getTimezoneOffset();
      expect(typeof offset).toBe("number");
    });

    test("toUTCISOString → ISO format string", () => {
      const result = toUTCISOString(new Date());
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
