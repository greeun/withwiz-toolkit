/**
 * Unit Tests: @withwiz/constants/error-codes tests
 * Based on: TEST_SCENARIOS.md - constants module
 */

import {
  ERROR_CODES,
  HTTP_STATUS,
  getErrorInfo,
  getErrorByCode,
  getHttpStatus,
  getErrorCategory,
  getDefaultErrorMessage,
  getLogLevel,
  getAllErrorCodes,
  getErrorCodesByCategory,
  formatErrorMessage,
} from "@withwiz/constants/error-codes";
import type { ErrorCodeKey } from "@withwiz/constants/error-codes";

// ============================================================================
// SC-CONST-ERR-001: Error Code Structure
// ============================================================================
describe("SC-CONST-ERR-001: Error Code Structure", () => {
  // TC-CONST-ERR-001: All error codes are 5 digits
  test("TC-CONST-ERR-001: All error codes are 5 digits", () => {
    const allCodes = getAllErrorCodes();

    allCodes.forEach((errorInfo) => {
      expect(errorInfo.code).toBeGreaterThanOrEqual(10000);
      expect(errorInfo.code).toBeLessThan(99999);
      expect(errorInfo.code.toString()).toHaveLength(5);
    });
  });

  test("All error codes have required fields", () => {
    const allCodes = getAllErrorCodes();

    allCodes.forEach((errorInfo) => {
      expect(errorInfo).toHaveProperty("code");
      expect(errorInfo).toHaveProperty("key");
      expect(errorInfo).toHaveProperty("status");
      expect(errorInfo).toHaveProperty("message");

      expect(typeof errorInfo.code).toBe("number");
      expect(typeof errorInfo.key).toBe("string");
      expect(typeof errorInfo.status).toBe("number");
      expect(typeof errorInfo.message).toBe("string");
    });
  });

  test("HTTP_STATUS constant validation", () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.CREATED).toBe(201);
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.CONFLICT).toBe(409);
    expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
    expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
    expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
  });
});

// ============================================================================
// SC-CONST-ERR-002: HTTP Status Mapping
// ============================================================================
describe("SC-CONST-ERR-002: HTTP Status Mapping", () => {
  // TC-CONST-ERR-002: getHttpStatus() - 400xx
  test("TC-CONST-ERR-002: getHttpStatus() - 400xx", () => {
    expect(getHttpStatus(40001)).toBe(400);
    expect(getHttpStatus(40008)).toBe(400);
  });

  // TC-CONST-ERR-003: getHttpStatus() - 404xx
  test("TC-CONST-ERR-003: getHttpStatus() - 404xx", () => {
    expect(getHttpStatus(40401)).toBe(404);
    expect(getHttpStatus(40499)).toBe(404);
  });

  // TC-CONST-ERR-004: getHttpStatus() - 500xx
  test("TC-CONST-ERR-004: getHttpStatus() - 500xx", () => {
    expect(getHttpStatus(50001)).toBe(500);
    expect(getHttpStatus(50008)).toBe(500);
  });

  test("getHttpStatus() - various status codes", () => {
    expect(getHttpStatus(40101)).toBe(401);
    expect(getHttpStatus(40301)).toBe(403);
    expect(getHttpStatus(40901)).toBe(409);
    expect(getHttpStatus(42201)).toBe(422);
    expect(getHttpStatus(42901)).toBe(429);
    expect(getHttpStatus(50301)).toBe(503);
  });
});

// ============================================================================
// SC-CONST-ERR-003: Category Classification
// ============================================================================
describe("SC-CONST-ERR-003: Category Classification", () => {
  // TC-CONST-ERR-005: getErrorCategory() - validation
  test("TC-CONST-ERR-005: getErrorCategory() - validation", () => {
    expect(getErrorCategory(40001)).toBe("validation");
    expect(getErrorCategory(40008)).toBe("validation");
  });

  // TC-CONST-ERR-006: getErrorCategory() - auth
  test("TC-CONST-ERR-006: getErrorCategory() - auth", () => {
    expect(getErrorCategory(40101)).toBe("auth");
    expect(getErrorCategory(40105)).toBe("auth");
  });

  // TC-CONST-ERR-007: getErrorCategory() - permission
  test("TC-CONST-ERR-007: getErrorCategory() - permission", () => {
    expect(getErrorCategory(40301)).toBe("permission");
    expect(getErrorCategory(40305)).toBe("permission");
  });

  // TC-CONST-ERR-008: getErrorCategory() - resource
  test("TC-CONST-ERR-008: getErrorCategory() - resource", () => {
    expect(getErrorCategory(40401)).toBe("resource");
    expect(getErrorCategory(40405)).toBe("resource");
  });

  test("getErrorCategory() - conflict", () => {
    expect(getErrorCategory(40901)).toBe("conflict");
    expect(getErrorCategory(40907)).toBe("conflict");
  });

  test("getErrorCategory() - business", () => {
    expect(getErrorCategory(42201)).toBe("business");
    expect(getErrorCategory(42212)).toBe("business");
  });

  test("getErrorCategory() - rateLimit", () => {
    expect(getErrorCategory(42901)).toBe("rateLimit");
    expect(getErrorCategory(42903)).toBe("rateLimit");
  });

  test("getErrorCategory() - server", () => {
    expect(getErrorCategory(50001)).toBe("server");
    expect(getErrorCategory(50305)).toBe("server");
  });

  test("getErrorCategory() - security (403xx, 71-79)", () => {
    expect(getErrorCategory(40371)).toBe("security");
    expect(getErrorCategory(40375)).toBe("security");
    expect(getErrorCategory(40376)).toBe("security");
  });

  test("getErrorCategory() - unknown", () => {
    expect(getErrorCategory(99999)).toBe("unknown");
    expect(getErrorCategory(20001)).toBe("unknown");
  });
});

// ============================================================================
// SC-CONST-ERR-004: Message Formatting
// ============================================================================
describe("SC-CONST-ERR-004: Message Formatting", () => {
  // TC-CONST-ERR-009: formatErrorMessage()
  test("TC-CONST-ERR-009: formatErrorMessage()", () => {
    const message = formatErrorMessage(40001, "Invalid request");

    expect(message).toBe("Invalid request");
    expect(message).not.toContain("[40001]");
  });

  test("formatErrorMessage() - without custom message", () => {
    const message = formatErrorMessage(40401);

    expect(message).toBe("Requested resource not found.");
    expect(message).not.toContain("[40401]");
  });
});

// ============================================================================
// Additional Utility Function Tests
// ============================================================================
describe("Error Code Utility Functions", () => {
  test("getErrorInfo() - look up by error key", () => {
    const info = getErrorInfo("NOT_FOUND");

    expect(info.code).toBe(40401);
    expect(info.key).toBe("NOT_FOUND");
    expect(info.status).toBe(404);
    expect(info.message).toBeDefined();
  });

  test("getErrorByCode() - look up by code", () => {
    const info = getErrorByCode(40401);

    expect(info).not.toBeNull();
    expect(info?.key).toBe("NOT_FOUND");
    expect(info?.status).toBe(404);
  });

  test("getErrorByCode() - non-existent code", () => {
    const info = getErrorByCode(99999);
    expect(info).toBeNull();
  });

  test("getDefaultErrorMessage() - default message by status code", () => {
    expect(getDefaultErrorMessage(400)).toBe("Invalid request.");
    expect(getDefaultErrorMessage(401)).toBe("Authentication required.");
    expect(getDefaultErrorMessage(403)).toBe("Access denied.");
    expect(getDefaultErrorMessage(404)).toBe("Requested resource not found.");
    expect(getDefaultErrorMessage(409)).toBe("Resource conflict occurred.");
    expect(getDefaultErrorMessage(422)).toBe("Unable to process request.");
    expect(getDefaultErrorMessage(429)).toBe("Too many requests.");
    expect(getDefaultErrorMessage(500)).toBe("Server error occurred.");
    expect(getDefaultErrorMessage(503)).toBe(
      "Service temporarily unavailable.",
    );
    expect(getDefaultErrorMessage(999)).toBe("An error occurred.");
  });

  test("getLogLevel() - log level by status code", () => {
    expect(getLogLevel(200)).toBe("info");
    expect(getLogLevel(201)).toBe("info");
    expect(getLogLevel(399)).toBe("info");
    expect(getLogLevel(400)).toBe("warn");
    expect(getLogLevel(404)).toBe("warn");
    expect(getLogLevel(499)).toBe("warn");
    expect(getLogLevel(500)).toBe("error");
    expect(getLogLevel(503)).toBe("error");
  });

  test("getErrorCodesByCategory() - look up error by category", () => {
    const validationErrors = getErrorCodesByCategory("validation");
    expect(validationErrors.length).toBeGreaterThan(0);
    validationErrors.forEach((e) => {
      expect(getErrorCategory(e.code)).toBe("validation");
    });

    const authErrors = getErrorCodesByCategory("auth");
    expect(authErrors.length).toBeGreaterThan(0);
    authErrors.forEach((e) => {
      expect(getErrorCategory(e.code)).toBe("auth");
    });

    const resourceErrors = getErrorCodesByCategory("resource");
    expect(resourceErrors.length).toBeGreaterThan(0);
    resourceErrors.forEach((e) => {
      expect(getErrorCategory(e.code)).toBe("resource");
    });
  });

  test("getAllErrorCodes() - look up all error codes", () => {
    const allCodes = getAllErrorCodes();

    expect(allCodes.length).toBeGreaterThan(0);
    expect(Array.isArray(allCodes)).toBe(true);
  });
});

// ============================================================================
// Core Error Code Existence Check
// ============================================================================
describe("Core Error Code Existence Check", () => {
  const requiredErrorKeys: ErrorCodeKey[] = [
    "VALIDATION_ERROR",
    "BAD_REQUEST",
    "UNAUTHORIZED",
    "INVALID_TOKEN",
    "TOKEN_EXPIRED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "RATE_LIMIT_EXCEEDED",
    "INTERNAL_SERVER_ERROR",
    "SERVER_ERROR",
  ];

  test.each(requiredErrorKeys)("Verify existence of error code '%s'", (key) => {
    expect(ERROR_CODES[key]).toBeDefined();
    expect(ERROR_CODES[key].code).toBeDefined();
    expect(ERROR_CODES[key].message).toBeDefined();
  });
});
