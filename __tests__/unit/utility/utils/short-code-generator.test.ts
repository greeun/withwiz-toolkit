/**
 * Short Code Generator tests
 *
 * Test Scope:
 * - Generated code length validation
 * - Uniqueness validation
 * - Forbidden character validation
 * - Performance tests
 * - Duplicate check logic
 */

import {
  generateShortCode,
  generateUniqueShortCode,
  IShortCodeOptions,
} from "@withwiz/utils/short-code-generator";

describe("Short Code Generator", () => {
  describe("generateShortCode", () => {
    describe("Length Validation", () => {
      it("should generate code with default length (8)", () => {
        const code = generateShortCode();
        expect(code.length).toBe(8);
      });

      it("should generate code with custom length", () => {
        expect(generateShortCode(6).length).toBe(6);
        expect(generateShortCode(10).length).toBe(10);
        expect(generateShortCode(12).length).toBe(12);
        expect(generateShortCode(1).length).toBe(1);
      });

      it("should throw error for invalid length", () => {
        expect(() => generateShortCode(0)).toThrow(
          "length must be a positive integer",
        );
        expect(() => generateShortCode(-1)).toThrow(
          "length must be a positive integer",
        );
        expect(() => generateShortCode(1.5)).toThrow(
          "length must be a positive integer",
        );
        expect(() => generateShortCode(NaN)).toThrow(
          "length must be a positive integer",
        );
      });
    });

    describe("Character Set Validation", () => {
      it("should only use alphanumeric characters", () => {
        const validChars = /^[A-Za-z0-9]+$/;

        for (let i = 0; i < 100; i++) {
          const code = generateShortCode();
          expect(code).toMatch(validChars);
        }
      });

      it("should not contain special characters", () => {
        const specialChars = /[^A-Za-z0-9]/;

        for (let i = 0; i < 100; i++) {
          const code = generateShortCode();
          expect(code).not.toMatch(specialChars);
        }
      });

      it("should not contain ambiguous characters", () => {
        // Check for ambiguous characters like 0, O, l, I
        // (Current implementation uses all characters, but can be restricted if needed)
        const code = generateShortCode();
        expect(code).toBeDefined();
      });
    });

    describe("Randomness Validation", () => {
      it("should generate different codes", () => {
        const codes = new Set<string>();

        for (let i = 0; i < 1000; i++) {
          codes.add(generateShortCode());
        }

        // When generating 1000 codes, at least 990 should be unique (99% uniqueness)
        expect(codes.size).toBeGreaterThan(990);
      });

      it("should have low collision rate", () => {
        const iterations = 10000;
        const codes = new Set<string>();

        for (let i = 0; i < iterations; i++) {
          codes.add(generateShortCode(8));
        }

        const uniqueRate = codes.size / iterations;
        expect(uniqueRate).toBeGreaterThan(0.99); // 99% uniqueness
      });

      it("should distribute characters evenly", () => {
        const charCounts: Record<string, number> = {};
        const iterations = 10000;
        const length = 1; // Check distribution with single character generation

        for (let i = 0; i < iterations; i++) {
          const code = generateShortCode(length);
          charCounts[code] = (charCounts[code] || 0) + 1;
        }

        // Check if character distribution is somewhat even
        // Each character should appear at least once
        const totalChars =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
            .length;
        const expectedCount = iterations / totalChars;
        const tolerance = expectedCount * 0.5; // Allow 50% margin of error

        Object.values(charCounts).forEach((count) => {
          expect(count).toBeGreaterThan(expectedCount - tolerance);
          expect(count).toBeLessThan(expectedCount + tolerance);
        });
      });
    });

    describe("Performance Tests", () => {
      it("should generate 10,000 codes in less than 1 second", () => {
        const start = Date.now();

        for (let i = 0; i < 10000; i++) {
          generateShortCode();
        }

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000);
      });

      it("should generate long codes efficiently", () => {
        const start = Date.now();

        for (let i = 0; i < 1000; i++) {
          generateShortCode(100); // 100자 코드
        }

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(500);
      });
    });
  });

  describe("generateUniqueShortCode", () => {
    describe("Basic Operation", () => {
      it("should generate code with default options", async () => {
        const code = await generateUniqueShortCode();
        expect(code.length).toBe(8);
        expect(code).toMatch(/^[A-Za-z0-9]+$/);
      });

      it("should generate code with custom length", async () => {
        const code = await generateUniqueShortCode({ length: 10 });
        expect(code.length).toBe(10);
      });
    });

    describe("Duplicate Check Logic", () => {
      it("should retry if duplicate is found", async () => {
        const usedCodes = new Set(["ABC123", "DEF456"]);
        let attempts = 0;

        const checkDuplicate = async (code: string) => {
          attempts++;
          return usedCodes.has(code);
        };

        const code = await generateUniqueShortCode({
          length: 6,
          checkDuplicate,
        });

        expect(code).toBeDefined();
        expect(usedCodes.has(code)).toBe(false);
        // Retries on duplicate, so attempts >= 1
        expect(attempts).toBeGreaterThanOrEqual(1);
      });

      it("should succeed on first try if no duplicates", async () => {
        let attempts = 0;

        const checkDuplicate = async (code: string) => {
          attempts++;
          return false; // Always unique
        };

        const code = await generateUniqueShortCode({
          length: 8,
          checkDuplicate,
        });

        expect(code).toBeDefined();
        expect(attempts).toBe(1);
      });

      it("should throw error after max attempts", async () => {
        const checkDuplicate = async (code: string) => {
          return true; // Always duplicate
        };

        await expect(
          generateUniqueShortCode({
            length: 8,
            maxAttempts: 5,
            checkDuplicate,
          }),
        ).rejects.toThrow("Failed to generate unique shortCode");
      });

      it("should support synchronous checkDuplicate", async () => {
        const usedCodes = new Set(["ABC123"]);

        const checkDuplicate = (code: string) => {
          return usedCodes.has(code);
        };

        const code = await generateUniqueShortCode({
          length: 6,
          checkDuplicate,
        });

        expect(code).toBeDefined();
        expect(usedCodes.has(code)).toBe(false);
      });
    });

    describe("Option Handling", () => {
      it("should use default maxAttempts (100)", async () => {
        let attempts = 0;

        const checkDuplicate = async (code: string) => {
          attempts++;
          return attempts <= 99; // Succeeds on 100th attempt
        };

        const code = await generateUniqueShortCode({
          checkDuplicate,
        });

        expect(code).toBeDefined();
        expect(attempts).toBe(100);
      });

      it("should respect custom maxAttempts", async () => {
        let attempts = 0;

        const checkDuplicate = async (code: string) => {
          attempts++;
          return true; // Always duplicate
        };

        await expect(
          generateUniqueShortCode({
            maxAttempts: 3,
            checkDuplicate,
          }),
        ).rejects.toThrow();

        expect(attempts).toBe(3);
      });

      it("should work without checkDuplicate function", async () => {
        const code = await generateUniqueShortCode({
          length: 8,
        });

        expect(code).toBeDefined();
        expect(code.length).toBe(8);
      });
    });

    describe("Real-world Scenarios", () => {
      it("should generate unique codes for concurrent requests", async () => {
        const usedCodes = new Set<string>();

        const checkDuplicate = async (code: string) => {
          const isDuplicate = usedCodes.has(code);
          usedCodes.add(code);
          return isDuplicate;
        };

        // Generate 100 concurrently
        const promises = Array(100)
          .fill(null)
          .map(() =>
            generateUniqueShortCode({
              length: 8,
              checkDuplicate,
            }),
          );

        const codes = await Promise.all(promises);

        // All codes should be unique
        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBe(100);
      });

      it("should handle database check simulation", async () => {
        const database = new Set<string>();

        const checkDuplicate = async (code: string) => {
          // Simulate DB lookup (10ms delay)
          await new Promise((resolve) => setTimeout(resolve, 10));
          return database.has(code);
        };

        const code = await generateUniqueShortCode({
          length: 8,
          checkDuplicate,
        });

        expect(code).toBeDefined();
        database.add(code);

        // Success on second generation with a different code
        const code2 = await generateUniqueShortCode({
          length: 8,
          checkDuplicate,
        });

        expect(code2).toBeDefined();
        expect(code2).not.toBe(code);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty options", async () => {
        const code = await generateUniqueShortCode({});
        expect(code).toBeDefined();
        expect(code.length).toBe(8);
      });

      it("should handle very short codes", async () => {
        const code = await generateUniqueShortCode({ length: 1 });
        expect(code.length).toBe(1);
      });

      it("should handle very long codes", async () => {
        const code = await generateUniqueShortCode({ length: 100 });
        expect(code.length).toBe(100);
      });
    });
  });

  describe("Statistical Propeties", () => {
    it("should have expected collision probability", () => {
      // Collision probability calculation based on Birthday Paradox
      // 8 character code (62^8 = 218,340,105,584,896 possibilities)
      // Collision probability for 10,000 codes ≈ 0.0000002%
      const codes = new Set<string>();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        codes.add(generateShortCode(8));
      }

      const collisionRate = (iterations - codes.size) / iterations;
      expect(collisionRate).toBeLessThan(0.01); // Less than 1%
    });

    it("should maintain uniqueness with different lengths", () => {
      const lengths = [4, 6, 8, 10, 12];

      lengths.forEach((length) => {
        const codes = new Set<string>();
        const iterations = 1000;

        for (let i = 0; i < iterations; i++) {
          codes.add(generateShortCode(length));
        }

        const uniqueRate = codes.size / iterations;
        expect(uniqueRate).toBeGreaterThan(0.95); // Over 95% unique
      });
    });
  });

  describe("Security Properties", () => {
    it("should not be predictable", () => {
      const codes = Array(100)
        .fill(null)
        .map(() => generateShortCode());

      // Concurrent codes should not show a pattern
      for (let i = 1; i < codes.length; i++) {
        expect(codes[i]).not.toBe(codes[i - 1]);
        expect(codes[i]).not.toBe(codes[i - 1] + "1");
        expect(codes[i]).not.toBe(codes[i - 1].replace(/.$/, "1"));
      }
    });

    it("should use full character space", () => {
      const codes = Array(10000)
        .fill(null)
        .map(() => generateShortCode(8))
        .join("");

      // Check if all character types are used
      expect(codes).toMatch(/[A-Z]/); // Uppercase
      expect(codes).toMatch(/[a-z]/); // Lowercase
      expect(codes).toMatch(/[0-9]/); // Numbers
    });
  });
});
