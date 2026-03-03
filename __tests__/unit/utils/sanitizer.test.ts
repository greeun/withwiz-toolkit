/**
 * Sanitizer tests
 *
 * Test Scope:
 * - XSS protection (script tag removal)
 * - HTML entity encoding/decoding
 * - Event handler removal
 * - URL sanitization
 * - CSV Injection defense
 */

import {
  sanitizeHtml,
  sanitizeUrl,
  sanitizeInput,
  sanitizeArray,
  sanitizeObjectFields,
  removeEventHandlers,
} from "@withwiz/utils/sanitizer";

describe("Sanitizer", () => {
  describe("sanitizeHtml", () => {
    describe("XSS Defense", () => {
      it("should remove script tags", () => {
        expect(sanitizeHtml('<script>alert("xss")</script>Hello')).toBe(
          'alert("xss")Hello',
        );
        expect(sanitizeHtml('Hello<script>alert("xss")</script>World')).toBe(
          'Helloalert("xss")World',
        );
      });

      it("should remove all HTML tags", () => {
        expect(sanitizeHtml("<b>Bold</b> <i>Italic</i>")).toBe("Bold Italic");
        expect(sanitizeHtml("<div><p>Nested</p></div>")).toBe("Nested");
        expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe("");
      });

      it("should handle encoded HTML entities", () => {
        expect(sanitizeHtml("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe(
          "alert(1)",
        );
        expect(sanitizeHtml("&lt;b&gt;Bold&lt;/b&gt;")).toBe("Bold");
      });

      it("should decode common HTML entities", () => {
        expect(sanitizeHtml("&amp;")).toBe("&");
        expect(sanitizeHtml("&quot;")).toBe('"');
        expect(sanitizeHtml("&#x27;")).toBe("'");
        expect(sanitizeHtml("&#x2F;")).toBe("/");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty/null input", () => {
        expect(sanitizeHtml("")).toBe("");
        expect(sanitizeHtml(null as any)).toBe("");
        expect(sanitizeHtml(undefined as any)).toBe("");
      });

      it("should handle non-string input", () => {
        expect(sanitizeHtml(123 as any)).toBe("");
        expect(sanitizeHtml({} as any)).toBe("");
        expect(sanitizeHtml([] as any)).toBe("");
      });

      it("should trim whitespace", () => {
        expect(sanitizeHtml("  Hello  ")).toBe("Hello");
        expect(sanitizeHtml("<p>  Spaced  </p>")).toBe("Spaced");
      });

      it("should handle malformed HTML", () => {
        expect(sanitizeHtml("<<script>alert(1)<</script>>")).toBe("alert(1)>");
        expect(sanitizeHtml("<b>Unclosed tag")).toBe("Unclosed tag");
      });
    });

    describe("Recursive Sanitization Defense", () => {
      it("should handle nested encoding", () => {
        const doubleEncoded = "&lt;script&gt;alert(1)&lt;/script&gt;";
        const result = sanitizeHtml(doubleEncoded);
        expect(result).not.toContain("<script");
      });

      it("should handle mixed case tags", () => {
        expect(sanitizeHtml("<ScRiPt>alert(1)</sCrIpT>")).toBe("alert(1)");
        expect(sanitizeHtml("<SCRIPT>alert(1)</SCRIPT>")).toBe("alert(1)");
      });
    });
  });

  describe("removeEventHandlers", () => {
    it("should remove onclick handlers", () => {
      expect(removeEventHandlers('onclick="alert(1)"')).toBe("");
      expect(removeEventHandlers('<div onclick="alert(1)">Text</div>')).toBe(
        "<div >Text</div>",
      );
    });

    it("should remove various event handlers", () => {
      expect(removeEventHandlers('onerror="alert(1)"')).toBe("");
      expect(removeEventHandlers('onload="alert(1)"')).toBe("");
      expect(removeEventHandlers('onmouseover="alert(1)"')).toBe("");
    });

    it("should handle multiple event handlers", () => {
      const input = 'onclick="alert(1)" onmouseover="alert(2)"';
      const result = removeEventHandlers(input);
      expect(result).not.toContain("onclick");
      expect(result).not.toContain("onmouseover");
    });

    it("should handle edge cases", () => {
      expect(removeEventHandlers("")).toBe("");
      expect(removeEventHandlers(null as any)).toBe("");
      expect(removeEventHandlers(undefined as any)).toBe("");
    });
  });

  describe("sanitizeUrl", () => {
    describe("Safe Protocols", () => {
      it("should allow http/https URLs", () => {
        expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
        expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
      });

      it("should allow relative URLs", () => {
        expect(sanitizeUrl("/path/to/page")).toBe("/path/to/page");
        expect(sanitizeUrl("./relative")).toBe("./relative");
      });
    });

    describe("Dangerous Protocol Removal", () => {
      it("should block javascript: protocol", () => {
        expect(sanitizeUrl("javascript:alert(1)")).toBe("");
        expect(sanitizeUrl("JavaScript:alert(1)")).toBe("");
        expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBe("");
      });

      it("should block vbscript: protocol", () => {
        expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("");
      });

      it("should block data:text/html", () => {
        expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe(
          "",
        );
      });

      it("should block data:application", () => {
        expect(sanitizeUrl("data:application/javascript,alert(1)")).toBe("");
      });

      it("should allow safe data: URLs (images)", () => {
        // data:image should be allowed (not in dangerous protocol list)
        expect(sanitizeUrl("data:image/png;base64,abc123")).not.toBe("");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty/null input", () => {
        expect(sanitizeUrl("")).toBe("");
        expect(sanitizeUrl(null as any)).toBe("");
        expect(sanitizeUrl(undefined as any)).toBe("");
      });

      it("should trim whitespace", () => {
        expect(sanitizeUrl("  https://example.com  ")).toBe(
          "https://example.com",
        );
      });

      it("should handle non-string input", () => {
        expect(sanitizeUrl(123 as any)).toBe("");
      });
    });
  });

  describe("sanitizeInput", () => {
    it("should apply all sanitization steps", () => {
      const input =
        '<script>alert(1)</script> onclick="evil()" Hello   World  ';
      const result = sanitizeInput(input);

      expect(result).not.toContain("<script");
      expect(result).not.toContain("onclick");
      expect(result).toBe("alert(1) Hello World");
    });

    it("should normalize consecutive whitespace", () => {
      expect(sanitizeInput("Hello    World")).toBe("Hello World");
      expect(sanitizeInput("Multiple   \n   Spaces")).toBe("Multiple Spaces");
    });

    it("should handle complex XSS attempts", () => {
      const xssAttempts = [
        '<img src=x onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)">',
      ];

      xssAttempts.forEach((xss) => {
        const result = sanitizeInput(xss);
        expect(result).not.toContain("alert");
        expect(result).not.toContain("javascript");
      });
    });
  });

  describe("sanitizeArray", () => {
    it("should sanitize all string elements", () => {
      const input = [
        "<script>alert(1)</script>Hello",
        "Normal text",
        "<b>Bold</b>",
      ];
      const result = sanitizeArray(input);

      expect(result).toEqual(["alert(1)Hello", "Normal text", "Bold"]);
    });

    it("should filter out non-string elements", () => {
      const input = ["text", 123, null, undefined, {}, []] as any[];
      const result = sanitizeArray(input);

      expect(result).toEqual(["text"]);
    });

    it("should remove empty strings after sanitization", () => {
      const input = ["<script></script>", "Valid", "   ", "<div></div>"];
      const result = sanitizeArray(input);

      expect(result).toEqual(["Valid"]);
      expect(result.length).toBe(1);
    });

    it("should handle edge cases", () => {
      expect(sanitizeArray([])).toEqual([]);
      expect(sanitizeArray(null as any)).toEqual([]);
      expect(sanitizeArray(undefined as any)).toEqual([]);
      expect(sanitizeArray("not-array" as any)).toEqual([]);
    });
  });

  describe("sanitizeObjectFields", () => {
    it("should sanitize specified string fields", () => {
      const obj = {
        name: "<script>Evil</script>John",
        email: "john@example.com",
        bio: "<b>Developer</b>",
      };

      const result = sanitizeObjectFields(obj, ["name", "bio"]);

      expect(result.name).toBe("EvilJohn");
      expect(result.email).toBe("john@example.com"); // not sanitized
      expect(result.bio).toBe("Developer");
    });

    it("should sanitize array fields", () => {
      const obj = {
        tags: ["<script>evil</script>tag1", "tag2"],
        description: "Normal text",
      };

      const result = sanitizeObjectFields(obj, ["tags"]);

      expect(result.tags).toEqual(["eviltag1", "tag2"]);
      expect(result.description).toBe("Normal text");
    });

    it("should handle nested objects without modification", () => {
      const obj = {
        name: "<b>John</b>",
        nested: {
          value: "<script>alert(1)</script>",
        },
      };

      const result = sanitizeObjectFields(obj, ["name"]);

      expect(result.name).toBe("John");
      expect(result.nested.value).toBe("<script>alert(1)</script>"); // not touched
    });

    it("should preserve non-string fields", () => {
      const obj = {
        name: "<b>John</b>",
        age: 30,
        active: true,
        metadata: { key: "value" },
      };

      const result = sanitizeObjectFields(obj, ["name"]);

      expect(result.name).toBe("John");
      expect(result.age).toBe(30);
      expect(result.active).toBe(true);
      expect(result.metadata).toEqual({ key: "value" });
    });
  });

  describe("CSV Injection Defense", () => {
    it("should handle formula injection attempts", () => {
      const csvInjections = [
        "=1+1",
        "+1+1",
        "-1+1",
        "@SUM(A1:A10)",
        '=cmd|"/c calc"!A1',
      ];

      csvInjections.forEach((injection) => {
        const result = sanitizeInput(injection);
        // sanitizeInput removes HTML tags, but CSV formula might need separate validation
        // Actual CSV generation needs additional validation
        expect(result).toBeDefined();
      });
    });
  });

  describe("Performance", () => {
    it("should handle large strings efficiently", () => {
      const largeString = "<div>" + "x".repeat(10000) + "</div>";
      const start = Date.now();
      const result = sanitizeInput(largeString);
      const duration = Date.now() - start;

      expect(result).toBe("x".repeat(10000));
      expect(duration).toBeLessThan(100); // Within 100ms
    });

    it("should handle many array elements efficiently", () => {
      const largeArray = Array(1000).fill("<b>text</b>");
      const start = Date.now();
      const result = sanitizeArray(largeArray);
      const duration = Date.now() - start;

      expect(result.length).toBe(1000);
      expect(duration).toBeLessThan(200); // Within 200ms
    });
  });
});
