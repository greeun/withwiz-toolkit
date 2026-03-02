/**
 * Password Module tests
 *
 * Test Scope:
 * - Password validation (length, casing, numbers, special characters)
 * - Password strength calculation
 * - Password hashing and verification
 * - Zod schema generation
 * - Timing attack protection
 */

import {
  PasswordValidator,
  PasswordHasher,
  defaultPasswordSchema,
  strongPasswordSchema,
} from "@withwiz/auth/core/password";
import { PasswordStrength } from "@withwiz/auth/types";

describe("Password Module", () => {
  describe("PasswordValidator", () => {
    describe("Basic Validation", () => {
      const validator = new PasswordValidator({
        minLength: 8,
        maxLength: 128,
        requireNumber: true,
        requireUppercase: true,
        requireLowercase: true,
        requireSpecialChar: true,
        bcryptRounds: 10,
      });

      it("should accept valid password", () => {
        const result = validator.validate("Password123!");
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should reject password without number", () => {
        const result = validator.validate("Password!");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must contain at least one number",
        );
      });

      it("should reject password without uppercase", () => {
        const result = validator.validate("password123!");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must contain at least one uppercase letter",
        );
      });

      it("should reject password without lowercase", () => {
        const result = validator.validate("PASSWORD123!");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must contain at least one lowercase letter",
        );
      });

      it("should reject password without special char", () => {
        const result = validator.validate("Password123");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must contain at least one special character",
        );
      });

      it("should reject too short password", () => {
        const result = validator.validate("Pass1!");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must be at least 8 characters long",
        );
      });

      it("should reject too long password", () => {
        const longPassword = "Password123!" + "a".repeat(120);
        const result = validator.validate(longPassword);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password cannot exceed 128 characters",
        );
      });
    });

    describe("Password Strength Calculation", () => {
      const validator = new PasswordValidator({
        minLength: 8,
        maxLength: 128,
        requireNumber: false,
        requireUppercase: false,
        requireLowercase: false,
        requireSpecialChar: false,
        bcryptRounds: 10,
      });

      it("should rate very weak password", () => {
        const result = validator.validate("aa"); // score: 10 (lowercase) = 10 < 20
        expect(result.strength).toBe(PasswordStrength.VERY_WEAK);
      });

      it("should rate weak password", () => {
        const result = validator.validate("pass"); // score: 30 (lowercase 10 + unique chars 20) = 30
        expect(result.strength).toBe(PasswordStrength.WEAK);
      });

      it("should rate medium password", () => {
        const result = validator.validate("password"); // score: 40 (length 10 + lowercase 10 + unique chars 20)
        expect(result.strength).toBe(PasswordStrength.MEDIUM);
      });

      it("should rate strong password", () => {
        const result = validator.validate("Password123"); // Casing+Number+Length
        expect(result.strength).toBe(PasswordStrength.STRONG);
      });

      it("should rate very strong password", () => {
        const result = validator.validate("MyVeryStr0ng!P@ssw0rd2024");
        expect(result.strength).toBe(PasswordStrength.VERY_STRONG);
      });
    });

    describe("Password Score Calculation", () => {
      const validator = new PasswordValidator({
        minLength: 8,
        maxLength: 128,
        requireNumber: false,
        requireUppercase: false,
        requireLowercase: false,
        requireSpecialChar: false,
        bcryptRounds: 10,
      });

      it("should give higher score for longer passwords", () => {
        const short = validator.validate("Pass1!");
        const medium = validator.validate("Password123!");
        const long = validator.validate("VeryLongPassword123!");

        expect(medium.score).toBeGreaterThan(short.score);
        expect(long.score).toBeGreaterThan(medium.score);
      });

      it("should give higher score for character variety", () => {
        const simple = validator.validate("password");
        const mixed = validator.validate("Password123!");

        expect(mixed.score).toBeGreaterThan(simple.score);
      });

      it("should give higher score for unique characters", () => {
        const repeated = validator.validate("aaaaaaa1");
        const unique = validator.validate("abcdefg1");

        expect(unique.score).toBeGreaterThan(repeated.score);
      });

      it("should cap score at 100", () => {
        const veryStrong = validator.validate(
          "MyVeryStr0ng!P@ssw0rd2024WithMoreChars123",
        );
        expect(veryStrong.score).toBeLessThanOrEqual(100);
      });
    });

    describe("Password Confirmation Validation", () => {
      const validator = new PasswordValidator({
        minLength: 8,
        maxLength: 128,
        requireNumber: true,
        requireUppercase: false,
        requireLowercase: false,
        requireSpecialChar: false,
        bcryptRounds: 10,
      });

      it("should accept matching passwords", () => {
        const result = validator.validateConfirmation(
          "password123",
          "password123",
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should reject non-matching passwords", () => {
        const result = validator.validateConfirmation(
          "password123",
          "password456",
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Passwords do not match");
      });
    });

    describe("Zod Schema Generation", () => {
      it("should create schema with minLength", () => {
        const validator = new PasswordValidator({
          minLength: 10,
          maxLength: 128,
          requireNumber: false,
          requireUppercase: false,
          requireLowercase: false,
          requireSpecialChar: false,
          bcryptRounds: 10,
        });

        const schema = validator.createZodSchema();
        expect(() => schema.parse("short")).toThrow();
        expect(() => schema.parse("longenoughpassword")).not.toThrow();
      });

      it("should create schema with all requirements", () => {
        const validator = new PasswordValidator({
          minLength: 8,
          maxLength: 128,
          requireNumber: true,
          requireUppercase: true,
          requireLowercase: true,
          requireSpecialChar: true,
          bcryptRounds: 10,
        });

        const schema = validator.createZodSchema();

        expect(() => schema.parse("password")).toThrow();
        expect(() => schema.parse("Password123!")).not.toThrow();
      });
    });

    describe("Password Hint Generation", () => {
      const validator = new PasswordValidator({
        minLength: 8,
        maxLength: 128,
        requireNumber: true,
        requireUppercase: true,
        requireLowercase: true,
        requireSpecialChar: true,
        bcryptRounds: 10,
      });

      it("should generate hints for incomplete password", () => {
        const hints = validator.generateHint("pass");

        expect(hints).toContain("Enter at least 8 characters");
        expect(hints).toContain("Include numbers");
        expect(hints).toContain("Include uppercase letters");
        // 'pass' has lowercase, so this hint is not included
        expect(hints).toContain("Include special characters");
      });

      it("should not generate hints for complete password", () => {
        const hints = validator.generateHint("Password123!");
        expect(hints).toEqual([]);
      });

      it("should generate partial hints", () => {
        const hints = validator.generateHint("Password");

        expect(hints).toContain("Include numbers");
        expect(hints).toContain("Include special characters");
        expect(hints).not.toContain("Include uppercase letters");
        expect(hints).not.toContain("Include lowercase letters");
      });
    });

    describe("Flexible Configuration", () => {
      it("should work with minimal requirements", () => {
        const validator = new PasswordValidator({
          minLength: 4,
          maxLength: 20,
          requireNumber: false,
          requireUppercase: false,
          requireLowercase: false,
          requireSpecialChar: false,
          bcryptRounds: 10,
        });

        const result = validator.validate("pass");
        expect(result.isValid).toBe(true);
      });

      it("should work with only number requirement", () => {
        const validator = new PasswordValidator({
          minLength: 8,
          maxLength: 128,
          requireNumber: true,
          requireUppercase: false,
          requireLowercase: false,
          requireSpecialChar: false,
          bcryptRounds: 10,
        });

        const result = validator.validate("password123");
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe("PasswordHasher", () => {
    const hasher = new PasswordHasher(10); // Lowering rounds for fast testing

    describe("Password Hashing", () => {
      it("should hash password", async () => {
        const password = "myPassword123";
        const hash = await hasher.hash(password);

        expect(hash).toBeDefined();
        expect(hash).not.toBe(password);
        expect(hash.length).toBeGreaterThan(50);
      });

      it("should generate different hashes for same password", async () => {
        const password = "myPassword123";
        const hash1 = await hasher.hash(password);
        const hash2 = await hasher.hash(password);

        expect(hash1).not.toBe(hash2); // Different salt
      });

      it("should use bcrypt format", async () => {
        const password = "myPassword123";
        const hash = await hasher.hash(password);

        expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
      });
    });

    describe("Password Verification", () => {
      it("should verify correct password", async () => {
        const password = "myPassword123";
        const hash = await hasher.hash(password);

        const isValid = await hasher.verify(password, hash);
        expect(isValid).toBe(true);
      });

      it("should reject incorrect password", async () => {
        const password = "myPassword123";
        const hash = await hasher.hash(password);

        const isValid = await hasher.verify("wrongPassword", hash);
        expect(isValid).toBe(false);
      });

      it("should be case-sensitive", async () => {
        const password = "MyPassword123";
        const hash = await hasher.hash(password);

        const isValid = await hasher.verify("mypassword123", hash);
        expect(isValid).toBe(false);
      });
    });

    describe("Timing Attack Protection", () => {
      it("should take similar time for correct and incorrect passwords", async () => {
        const password = "myPassword123";
        const hash = await hasher.hash(password);

        const start1 = Date.now();
        await hasher.verify(password, hash);
        const time1 = Date.now() - start1;

        const start2 = Date.now();
        await hasher.verify("wrongPassword", hash);
        const time2 = Date.now() - start2;

        // Time difference should not be significant (timing attack protection)
        const timeDiff = Math.abs(time1 - time2);
        expect(timeDiff).toBeLessThan(50); // Difference within 50ms
      });
    });

    describe("Salt Randomness", () => {
      it("should use random salt for each hash", async () => {
        const password = "myPassword123";
        const hashes = await Promise.all([
          hasher.hash(password),
          hasher.hash(password),
          hasher.hash(password),
        ]);

        // All hashes should be different
        expect(new Set(hashes).size).toBe(3);
      });
    });

    describe("Rounds Configuration", () => {
      it("should use configured rounds", async () => {
        const fastHasher = new PasswordHasher(4);
        const slowHasher = new PasswordHasher(12);

        const password = "myPassword123";

        const start1 = Date.now();
        await fastHasher.hash(password);
        const fastTime = Date.now() - start1;

        const start2 = Date.now();
        await slowHasher.hash(password);
        const slowTime = Date.now() - start2;

        // More rounds should be slower
        expect(slowTime).toBeGreaterThan(fastTime);
      });
    });
  });

  describe("Default Schema", () => {
    describe("defaultPasswordSchema", () => {
      it("should accept valid password", () => {
        expect(() => defaultPasswordSchema.parse("password123")).not.toThrow();
      });

      it("should reject password without number", () => {
        expect(() => defaultPasswordSchema.parse("password")).toThrow();
      });

      it("should reject too short password", () => {
        expect(() => defaultPasswordSchema.parse("pass1")).toThrow();
      });

      it("should reject too long password", () => {
        const longPassword = "a".repeat(130) + "1";
        expect(() => defaultPasswordSchema.parse(longPassword)).toThrow();
      });
    });

    describe("strongPasswordSchema", () => {
      it("should accept strong password", () => {
        expect(() =>
          strongPasswordSchema.parse("MyPassword123!"),
        ).not.toThrow();
      });

      it("should reject password without lowercase", () => {
        expect(() => strongPasswordSchema.parse("PASSWORD123!")).toThrow();
      });

      it("should reject password without uppercase", () => {
        expect(() => strongPasswordSchema.parse("password123!")).toThrow();
      });

      it("should reject password without number", () => {
        expect(() => strongPasswordSchema.parse("MyPassword!")).toThrow();
      });

      it("should reject password without special char", () => {
        expect(() => strongPasswordSchema.parse("MyPassword123")).toThrow();
      });

      it("should reject too short password", () => {
        expect(() => strongPasswordSchema.parse("MyPass1!")).toThrow();
      });
    });
  });

  describe("Static Methods", () => {
    describe("getStrengthMessage", () => {
      it("should return correct messages", () => {
        expect(
          PasswordValidator.getStrengthMessage(PasswordStrength.VERY_WEAK),
        ).toBe("Very Weak");
        expect(
          PasswordValidator.getStrengthMessage(PasswordStrength.WEAK),
        ).toBe("Weak");
        expect(
          PasswordValidator.getStrengthMessage(PasswordStrength.MEDIUM),
        ).toBe("Medium");
        expect(
          PasswordValidator.getStrengthMessage(PasswordStrength.STRONG),
        ).toBe("Strong");
        expect(
          PasswordValidator.getStrengthMessage(PasswordStrength.VERY_STRONG),
        ).toBe("Very Strong");
      });
    });

    describe("getStrengthColor", () => {
      it("should return correct colors", () => {
        expect(
          PasswordValidator.getStrengthColor(PasswordStrength.VERY_WEAK),
        ).toBe("text-red-600");
        expect(PasswordValidator.getStrengthColor(PasswordStrength.WEAK)).toBe(
          "text-orange-600",
        );
        expect(
          PasswordValidator.getStrengthColor(PasswordStrength.MEDIUM),
        ).toBe("text-yellow-600");
        expect(
          PasswordValidator.getStrengthColor(PasswordStrength.STRONG),
        ).toBe("text-blue-600");
        expect(
          PasswordValidator.getStrengthColor(PasswordStrength.VERY_STRONG),
        ).toBe("text-green-600");
      });
    });
  });

  describe("Common Password Defense", () => {
    const validator = new PasswordValidator({
      minLength: 8,
      maxLength: 128,
      requireNumber: true,
      requireUppercase: true,
      requireLowercase: true,
      requireSpecialChar: true,
      bcryptRounds: 10,
    });

    it("should accept common passwords if they meet requirements", () => {
      // Current implementation does not check for common passwords
      // Can be added if necessary
      const result = validator.validate("Password123!");
      expect(result.isValid).toBe(true);
    });
  });
});
