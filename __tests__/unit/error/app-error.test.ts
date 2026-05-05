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

    const notFound = AppError.notFound("Custom resource");
    expect(notFound.status).toBe(404);
    expect(notFound.message).toBe("Custom resource");
  });

  test("Business logic error factory methods", () => {
    const quotaExceeded = AppError.quotaExceeded("API call");
    expect(quotaExceeded.status).toBe(422);
    expect(quotaExceeded.message).toContain("API call");

    const businessRule = AppError.businessRule("Rule violation");
    expect(businessRule.status).toBe(422);
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

// ============================================================================
// SC-ERR-006: 코드 유효성 검증 (생성자)
// ============================================================================
describe("SC-ERR-006: Constructor code validation", () => {
  test("should fallback to INTERNAL_SERVER_ERROR for code below 10000", () => {
    const error = new AppError(999);
    expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR.code);
    expect(error.status).toBe(500);
    expect(error.key).toBe("INTERNAL_SERVER_ERROR");
  });

  test("should fallback to INTERNAL_SERVER_ERROR for code above 59999", () => {
    const error = new AppError(60000);
    expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR.code);
  });

  test("should fallback to INTERNAL_SERVER_ERROR for non-integer code", () => {
    const error = new AppError(40001.5);
    expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR.code);
  });

  test("should fallback to INTERNAL_SERVER_ERROR for NaN", () => {
    const error = new AppError(NaN);
    expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR.code);
  });

  test("should accept valid 5-digit code at boundaries", () => {
    const errorLow = new AppError(10000);
    expect(errorLow.code).toBe(10000);

    const errorHigh = new AppError(59999);
    expect(errorHigh.code).toBe(59999);
  });
});

// ============================================================================
// SC-ERR-007: CORS_VIOLATION 팩토리 메서드
// ============================================================================
describe("SC-ERR-007: corsViolation factory method", () => {
  test("should create CORS_VIOLATION error with correct code", () => {
    const error = AppError.corsViolation();
    expect(error.code).toBe(ERROR_CODES.CORS_VIOLATION.code);
    expect(error.status).toBe(403);
    expect(error.category).toBe("security");
  });

  test("should include origin in details", () => {
    const error = AppError.corsViolation("https://evil.com");
    expect(error.details?.value).toBe("https://evil.com");
  });
});

// ============================================================================
// SC-ERR-009: AppError.from() classifyError 연동
// ============================================================================
describe("SC-ERR-009: AppError.from() uses classifyError", () => {
  test("should classify database error", () => {
    const error = AppError.from(new Error("Prisma P2010 query failed"));
    expect(error.code).toBe(ERROR_CODES.DATABASE_ERROR.code);
    expect(error.status).toBe(500);
  });

  test("should classify network error via errno code", () => {
    const netErr = new Error("Connection refused");
    (netErr as NodeJS.ErrnoException).code = "ECONNREFUSED";
    const error = AppError.from(netErr);
    expect(error.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR.code);
    expect(error.status).toBe(503);
  });

  test("should classify redis error", () => {
    const error = AppError.from(new Error("Redis cluster unavailable"));
    expect(error.code).toBe(ERROR_CODES.CACHE_ERROR.code);
  });

  test("should classify email error", () => {
    const error = AppError.from(new Error("Failed to send email via SMTP"));
    expect(error.code).toBe(ERROR_CODES.EMAIL_SEND_FAILED.code);
  });

  test("should classify upload error", () => {
    const error = AppError.from(new Error("Upload to R2 failed"));
    expect(error.code).toBe(ERROR_CODES.FILE_UPLOAD_FAILED.code);
  });

  test("should use fallbackMessage when provided", () => {
    const error = AppError.from(new Error("Something"), "Custom fallback");
    expect(error.message).toBe("Custom fallback");
  });

  test("should return same AppError if already AppError", () => {
    const original = AppError.notFound("test");
    const converted = AppError.from(original);
    expect(converted).toBe(original);
  });

  test("should handle non-Error types", () => {
    const error = AppError.from("string error");
    expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR.code);
  });
});

// ============================================================================
// SC-ERR-010: 팩토리 메서드 확장 (미커버된 메서드들)
// ============================================================================
describe("SC-ERR-010: AppError factory methods - extended coverage", () => {
  // 403xx - account status
  test("accountLocked returns 403", () => {
    const err = AppError.accountLocked();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  test("accountDisabled returns 403", () => {
    const err = AppError.accountDisabled();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  // 409xx - conflict/duplicate
  test("duplicate without resource name", () => {
    const err = AppError.duplicate();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
  });

  test("duplicate with resource name", () => {
    const err = AppError.duplicate("user");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
    expect(err.message).toContain("user");
  });

  test("emailExists without email", () => {
    const err = AppError.emailExists();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
  });

  test("emailExists with email", () => {
    const err = AppError.emailExists("test@example.com");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
    expect(err.details?.value).toBe("test@example.com");
  });

  // 422xx - business logic
  test("invalidOperation without message", () => {
    const err = AppError.invalidOperation();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
  });

  test("invalidOperation with message", () => {
    const err = AppError.invalidOperation("cannot delete active record");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
    expect(err.message).toContain("cannot delete active record");
  });

  test("quotaExceeded without quotaType", () => {
    const err = AppError.quotaExceeded();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
  });

  test("fileTooLarge without maxSize", () => {
    const err = AppError.fileTooLarge();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
  });

  test("fileTooLarge with maxSize", () => {
    const err = AppError.fileTooLarge("10MB");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
    expect(err.message).toContain("10MB");
  });

  test("unsupportedFileType without fileType", () => {
    const err = AppError.unsupportedFileType();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
  });

  test("unsupportedFileType with fileType", () => {
    const err = AppError.unsupportedFileType(".exe");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
    expect(err.message).toContain(".exe");
  });

  // 429xx - rate limiting
  test("rateLimit without retryAfter", () => {
    const err = AppError.rateLimit();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(429);
    expect(err.details).toBeUndefined();
  });

  test("dailyLimit", () => {
    const err = AppError.dailyLimit();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(429);
  });

  test("apiQuotaExceeded", () => {
    const err = AppError.apiQuotaExceeded();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(429);
  });

  // 500xx - server errors
  test("internalError without message", () => {
    const err = AppError.internalError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
  });

  test("internalError with message", () => {
    const err = AppError.internalError("unexpected failure");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
    expect(err.message).toContain("unexpected failure");
  });

  test("databaseError without message", () => {
    const err = AppError.databaseError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
  });

  test("databaseError with message", () => {
    const err = AppError.databaseError("connection timeout");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
    expect(err.message).toContain("connection timeout");
  });

  test("emailSendFailed", () => {
    const err = AppError.emailSendFailed();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
  });

  test("cacheError", () => {
    const err = AppError.cacheError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
  });

  test("fileUploadFailed", () => {
    const err = AppError.fileUploadFailed();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
  });

  // 503xx - service unavailable
  test("externalServiceError without service name", () => {
    const err = AppError.externalServiceError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(503);
  });

  test("externalServiceError with service name", () => {
    const err = AppError.externalServiceError("Stripe");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(503);
    expect(err.message).toContain("Stripe");
  });

  test("serviceUnavailable without message", () => {
    const err = AppError.serviceUnavailable();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(503);
  });

  test("serviceUnavailable with message", () => {
    const err = AppError.serviceUnavailable("under maintenance");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(503);
    expect(err.message).toContain("under maintenance");
  });

  // Security errors (403xx - 71~79)
  test("accessBlocked without reason", () => {
    const err = AppError.accessBlocked();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  test("accessBlocked with reason", () => {
    const err = AppError.accessBlocked("IP banned");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
    expect(err.message).toContain("IP banned");
  });

  test("securityValidationFailed", () => {
    const err = AppError.securityValidationFailed();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  test("blockedUrl without url", () => {
    const err = AppError.blockedUrl();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  test("blockedUrl with url", () => {
    const err = AppError.blockedUrl("http://evil.com");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
    expect(err.details?.value).toBe("http://evil.com");
  });

  test("suspiciousActivity", () => {
    const err = AppError.suspiciousActivity();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  test("ipBlocked without ip", () => {
    const err = AppError.ipBlocked();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  test("ipBlocked with ip", () => {
    const err = AppError.ipBlocked("192.168.1.100");
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
    expect(err.details?.value).toBe("192.168.1.100");
  });

  test("corsViolation without origin", () => {
    const err = AppError.corsViolation();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });
});
