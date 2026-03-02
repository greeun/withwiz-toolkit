/**
 * Unit Tests: @withwiz/error AppError class tests
 * Based on: TEST_SCENARIOS.md - error module
 */

import { AppError } from "@withwiz/error/app-error";
import { ERROR_CODES } from "@withwiz/constants/error-codes";

// ============================================================================
describe("SC-ERR-001: Create with error code", () => {
  // TC-ERR-001: Create with error code
  test("TC-ERR-001: Create with error code (400xx)", () => {
    const error = new AppError(40001);

    expect(error.code).toBe(40001);
    expect(error.status).toBe(400);
    expect(error.category).toBe("validation");
    expect(error.name).toBe("AppError");
  });

  test("TC-ERR-001b: Create with error code (404xx)", () => {
    const error = new AppError(40401);

    expect(error.code).toBe(40401);
    expect(error.status).toBe(404);
    expect(error.category).toBe("resource");
  });

  test("TC-ERR-001c: Create with error code (500xx)", () => {
    const error = new AppError(50001);

    expect(error.code).toBe(50001);
    expect(error.status).toBe(500);
    expect(error.category).toBe("server");
  });

  // TC-ERR-003: Include custom message
  test("TC-ERR-003: Include custom message", () => {
    const customMessage = "Link not found";
    const error = new AppError(40401, customMessage);

    expect(error.message).toBe(customMessage);
    expect(error.message).not.toContain("[40401]");
  });

  // TC-ERR-004: Include details
  test("TC-ERR-004: Include details", () => {
    const details = { field: "email", value: "invalid@" };
    const error = new AppError(40001, "Invalid email", details);

    expect(error.details).toBeDefined();
    expect(error.details?.field).toBe("email");
    expect(error.details?.value).toBe("invalid@");
  });
});

// ============================================================================
// SC-ERR-002: 에러 키로 생성
// ============================================================================
describe("SC-ERR-002: Create with error key", () => {
  // TC-ERR-002: Create with error key
  test("TC-ERR-002: Create with error key", () => {
    const error = AppError.fromKey("NOT_FOUND");

    expect(error.code).toBe(ERROR_CODES.NOT_FOUND.code);
    expect(error.status).toBe(404);
    expect(error.key).toBe("NOT_FOUND");
  });

  test("TC-ERR-002b: Create with error key + custom message", () => {
    const error = AppError.fromKey("VALIDATION_ERROR", "Invalid input values");

    expect(error.message).toContain("Invalid input values");
    expect(error.key).toBe("VALIDATION_ERROR");
  });
});

// ============================================================================
// SC-ERR-003: 팩토리 메서드
// ============================================================================
describe("SC-ERR-003: Factory methods", () => {
  // TC-ERR-005: Factory method - validation()
  test("TC-ERR-005: Factory method - validation()", () => {
    const error = AppError.validation("Invalid input");

    expect(error.status).toBe(400);
    expect(error.category).toBe("validation");
    expect(error.message).toContain("Invalid input");
  });

  // TC-ERR-006: Factory method - notFound()
  test("TC-ERR-006: Factory method - notFound()", () => {
    const error = AppError.notFound();

    expect(error.status).toBe(404);
    expect(error.category).toBe("resource");
  });

  // TC-ERR-007: Factory method - unauthorized()
  test("TC-ERR-007: Factory method - unauthorized()", () => {
    const error = AppError.unauthorized();

    expect(error.status).toBe(401);
    expect(error.category).toBe("auth");
  });

  // TC-ERR-008: Factory method - rateLimit()
  test("TC-ERR-008: Factory method - rateLimit()", () => {
    const error = AppError.rateLimit(60);

    expect(error.status).toBe(429);
    expect(error.category).toBe("rateLimit");
    expect(error.details?.retryAfter).toBe(60);
  });

  test("Various factory methods tests", () => {
    // forbidden
    const forbidden = AppError.forbidden();
    expect(forbidden.status).toBe(403);

    // serverError
    const serverError = AppError.serverError();
    expect(serverError.status).toBe(500);

    // conflict
    const conflict = AppError.conflict();
    expect(conflict.status).toBe(409);

    // badRequest
    const badRequest = AppError.badRequest();
    expect(badRequest.status).toBe(400);

    // invalidToken
    const invalidToken = AppError.invalidToken();
    expect(invalidToken.status).toBe(401);

    // emailNotVerified
    const emailNotVerified = AppError.emailNotVerified();
    expect(emailNotVerified.status).toBe(403);
  });

  test("Resource related factory methods", () => {
    const userNotFound = AppError.userNotFound();
    expect(userNotFound.status).toBe(404);

    const linkNotFound = AppError.linkNotFound();
    expect(linkNotFound.status).toBe(404);

    const tagNotFound = AppError.tagNotFound();
    expect(tagNotFound.status).toBe(404);
  });

  test("Business logic error factory methods", () => {
    const quotaExceeded = AppError.quotaExceeded("API call");
    expect(quotaExceeded.status).toBe(422);
    expect(quotaExceeded.message).toContain("API call");

    const businessRule = AppError.businessRule("Rule violation");
    expect(businessRule.status).toBe(422);

    const reservedWord = AppError.reservedWord("admin");
    expect(reservedWord.details?.value).toBe("admin");
  });
});

// ============================================================================
// SC-ERR-004: 에러 변환
// ============================================================================
describe("SC-ERR-004: Error conversion", () => {
  // TC-ERR-009: Convert Error -> AppError
  test("TC-ERR-009: Convert Error -> AppError", () => {
    const normalError = new Error("General error");
    const appError = AppError.from(normalError);

    expect(appError).toBeInstanceOf(AppError);
    expect(appError.status).toBe(500); // 기본 서버 에러
  });

  // TC-ERR-010: Convert AppError -> AppError (Return as is)
  test("TC-ERR-010: Convert AppError -> AppError (Return as is)", () => {
    const original = AppError.notFound("Original error");
    const converted = AppError.from(original);

    expect(converted).toBe(original); // Same instance
    expect(converted.message).toContain("Original error");
  });

  test("Convert error message containing error code", () => {
    const errorWithCode = new Error("Error occurred [40001]");
    const appError = AppError.from(errorWithCode);

    expect(appError.code).toBe(40001);
  });

  test("Convert unknown types", () => {
    const unknownError = "String error";
    const appError = AppError.from(unknownError);

    expect(appError).toBeInstanceOf(AppError);
    expect(appError.status).toBe(500);
  });

  test("Use fallbackMessage", () => {
    const normalError = new Error("Original message");
    const appError = AppError.from(normalError, "Alternative message");

    expect(appError.message).toContain("Alternative message");
  });
});

// ============================================================================
// SC-ERR-005: JSON Serialization
// ============================================================================
describe("SC-ERR-005: JSON Serialization", () => {
  // TC-ERR-011: toJSON() Serialization
  test("TC-ERR-011: toJSON() Serialization", () => {
    const error = new AppError(40401, "Resource not found", { field: "id" });
    error.requestId = "req-123";

    const json = error.toJSON();

    expect(json).toHaveProperty("code", 40401);
    expect(json).toHaveProperty("message");
    expect(json).toHaveProperty("status", 404);
    expect(json).toHaveProperty("key");
    expect(json).toHaveProperty("category", "resource");
    expect(json).toHaveProperty("timestamp");
    expect(json).toHaveProperty("requestId", "req-123");
    expect(json.details?.field).toBe("id");
  });

  // TC-ERR-012: toLogString() format
  test("TC-ERR-012: toLogString() format", () => {
    const error = new AppError(40401, "Resource not found");
    error.requestId = "req-456";

    const logString = error.toLogString();

    expect(logString).toContain("[40401]");
    expect(logString).toContain("resource");
    expect(logString).toContain("req-456");
  });

  test("toLogString() - no requestId", () => {
    const error = new AppError(40401, "Resource not found");

    const logString = error.toLogString();

    expect(logString).toContain("no-request-id");
  });
});

// ============================================================================
// Additional Tests: Utility methods
// ============================================================================
describe("Utility methods", () => {
  test("toFriendlyMessage() - User friendly message", () => {
    const error = new AppError(40401, "Page not found");

    expect(error.toFriendlyMessage()).toBe("Page not found");
    expect(error.toFriendlyMessage()).not.toContain("[40401]");
  });

  test("isCategory() - Check category", () => {
    const error = AppError.notFound();

    expect(error.isCategory("resource")).toBe(true);
    expect(error.isCategory("validation")).toBe(false);
  });

  test("Automatic timestamp setting", () => {
    const before = new Date();
    const error = new AppError(40001);
    const after = new Date();

    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
