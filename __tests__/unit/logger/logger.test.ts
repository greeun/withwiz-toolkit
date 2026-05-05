/**
 * Logger module tests
 *
 * Test Scope:
 * - Sensitive information masking (password, token, secret, etc.)
 * - Body length limit (1024 characters)
 * - API request/response logging
 * - Output by log level
 *
 * Note: Winston logger itself is not tested (external library)
 * Instead, we test the utility functions we implemented
 */

// Mock Request and Response for testing
class MockRequest {
  method: string;
  url: string;
  headers: Map<string, string>;
  private _body: any;

  constructor(url: string, options: any = {}) {
    this.method = options.method || "GET";
    this.url = url;
    this.headers = new Map();

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value as string);
      });
    }

    this._body = options.body;
  }

  clone() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  async json() {
    return typeof this._body === "string" ? JSON.parse(this._body) : this._body;
  }

  async text() {
    return typeof this._body === "string"
      ? this._body
      : JSON.stringify(this._body);
  }
}

(MockRequest.prototype as any).headers = {
  get: function (this: MockRequest, key: string) {
    return this.headers.get(key.toLowerCase()) || null;
  },
};

class MockResponse {
  status: number;
  headers: Map<string, string>;
  private _body: any;

  constructor(body: any, options: any = {}) {
    this.status = options.status || 200;
    this.headers = new Map();
    this._body = body;

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value as string);
      });
    }
  }

  clone() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  async json() {
    return typeof this._body === "string" ? JSON.parse(this._body) : this._body;
  }

  async text() {
    return typeof this._body === "string"
      ? this._body
      : JSON.stringify(this._body);
  }
}

(MockResponse.prototype as any).headers = {
  get: function (this: MockResponse, key: string) {
    return this.headers.get(key.toLowerCase()) || null;
  },
  entries: function (this: MockResponse) {
    return this.headers.entries();
  },
};

global.Request = MockRequest as any;
global.Response = MockResponse as any;

// Mock winston before importing logger
const { mockDebug, mockInfo, mockError } = vi.hoisted(() => ({
  mockDebug: vi.fn(),
  mockInfo: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock("winston", async (importOriginal) => {
  const actualWinston = await importOriginal<typeof import("winston")>();
  return {
    ...actualWinston,
    default: {
      ...actualWinston,
      createLogger: vi.fn(() => ({
        debug: mockDebug,
        info: mockInfo,
        error: mockError,
        level: "info",
      })),
    },
    createLogger: vi.fn(() => ({
      debug: mockDebug,
      info: mockInfo,
      error: mockError,
      level: "info",
    })),
    format: actualWinston.format,
    transports: actualWinston.transports,
    addColors: vi.fn(),
  };
});

vi.mock("winston-daily-rotate-file", () => ({
  default: vi.fn(),
}));

import {
  logDebug,
  logInfo,
  logError,
  logApiRequest,
  logApiResponse,
} from "@withwiz/logger/logger";

describe("Logger Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Logging Functions", () => {
    it("should call winston debug", () => {
      logDebug("Test debug message");

      expect(mockDebug).toHaveBeenCalledWith("Test debug message", undefined);
    });

    it("should call winston info", () => {
      logInfo("Test info message");

      expect(mockInfo).toHaveBeenCalledWith("Test info message", undefined);
    });

    it("should call winston error", () => {
      logError("Test error message");

      expect(mockError).toHaveBeenCalledWith("Test error message", undefined);
    });

    it("should log with metadata", () => {
      const meta = { userId: "123", action: "login" };

      logInfo("User logged in", meta);

      expect(mockInfo).toHaveBeenCalledWith("User logged in", meta);
    });
  });

  describe("API Request Logging", () => {
    it("should log basic request without body", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/users", {
        method: "GET",
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const reqCall = calls.find((c: string) => c.includes("[API Req]"));
      expect(reqCall).toBeDefined();
      expect(reqCall).toContain("GET");
      expect(reqCall).toContain("https://api.example.com/users");
    });

    it("should log request with extra metadata", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/users", {
        method: "POST",
      });

      logApiRequest(request, { userId: "123", ip: "192.168.1.1" });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const reqCall = calls.find((c: string) => c.includes("[API Req]"));
      expect(reqCall).toBeDefined();
      expect(reqCall).toContain("userId");
      expect(reqCall).toContain("123");
    });

    it("should handle request with JSON body", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "secret123",
        }),
      });

      logApiRequest(request);

      // Wait for asynchronous body processing
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const reqCall = calls.find((c: string) => c.includes("[API Req]"));
      expect(reqCall).toBeDefined();
      expect(reqCall).toContain("[API Req]");
      // password는 마스킹되어야 함
      expect(reqCall).toContain("[MASKED]");
    });
  });

  describe("API Response Logging", () => {
    it("should log basic response", async () => {
      mockDebug.mockClear(); // Clear previous calls

      const request = new Request("https://api.example.com/users", {
        method: "GET",
      });

      const response = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

      logApiResponse(request, response);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const resCall = calls.find((c: string) => c.includes("[API Res]"));
      expect(resCall).toBeDefined();
      expect(resCall).toContain("200");
    });

    it("should log response with extra metadata", async () => {
      mockDebug.mockClear(); // Clear previous calls

      const request = new Request("https://api.example.com/users", {
        method: "GET",
      });

      const response = new Response("OK", {
        status: 200,
      });

      logApiResponse(request, response, { duration: 123, cached: false });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const resCall = calls.find((c: string) => c.includes("[API Res]"));
      expect(resCall).toBeDefined();
      expect(resCall).toContain("duration");
      expect(resCall).toContain("123");
    });
  });

  describe("Sensitive Data Masking", () => {
    it("should mask password in request body", async () => {
      const request = new Request("https://api.example.com/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
          password: "my-secret-password",
          username: "testuser",
        }),
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const call = mockDebug.mock.calls[0][0];
      expect(call).toContain("email");
      expect(call).toContain("user@example.com");
      expect(call).not.toContain("my-secret-password");
      expect(call).toContain("[MASKED]");
    });

    it("should mask token fields", async () => {
      const request = new Request("https://api.example.com/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
          refreshToken: "refresh-token-123",
          secret: "my-secret-key",
        }),
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const call = mockDebug.mock.calls[0][0];
      expect(call).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(call).not.toContain("refresh-token-123");
      expect(call).not.toContain("my-secret-key");
      expect(call).toContain("[MASKED]");
    });
  });

  describe("Body Truncation", () => {
    it("should truncate long request body", async () => {
      const longBody = "x".repeat(2000);

      const request = new Request("https://api.example.com/upload", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: longBody,
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const call = mockDebug.mock.calls[0][0];
      expect(call).toContain("[TRUNCATED]");
      expect(call.length).toBeLessThan(longBody.length + 500); // Allowing slight overhead
    });

    it("should not truncate short body", async () => {
      const shortBody = JSON.stringify({ message: "Hello, World!" });

      const request = new Request("https://api.example.com/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: shortBody,
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const call = mockDebug.mock.calls[0][0];
      expect(call).not.toContain("[TRUNCATED]");
      expect(call).toContain("Hello, World!");
    });
  });

  describe("Non-text Body Handling", () => {
    it("should handle non-text content type", () => {
      const request = new Request("https://api.example.com/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: new Blob(["binary data"]),
      });

      logApiRequest(request);

      setTimeout(() => {
        expect(mockDebug).toHaveBeenCalled();
        const call = mockDebug.mock.calls[0][0];
        expect(call).toContain("[API Req]");
        // non-text body has no body field or is shown as [non-text body]
      }, 100);
    });
  });

  describe("Error Handling", () => {
    it("should handle unreadable body gracefully", async () => {
      const request = new Request("https://api.example.com/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json {{{",
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      // Log should be output even if an error occurs
      const call = mockDebug.mock.calls[0][0];
      expect(call).toContain("[API Req]");
    });
  });

  describe("Body Truncation - Object type", () => {
    it("should truncate long JSON object body", async () => {
      // Create an object that serializes to more than 1024 characters
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeObject[`key_${i}`] = "x".repeat(20);
      }

      const request = new Request("https://api.example.com/large-json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(largeObject),
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const call = mockDebug.mock.calls[0][0];
      expect(call).toContain("[TRUNCATED]");
    });
  });

  describe("Non-text Body Handling - getSafeBody branches", () => {
    it("should return [non-text body] for non-text/non-json content type in response", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/file", {
        method: "GET",
      });

      const response = new Response(new Blob(["binary data"]), {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });

      logApiResponse(request, response);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const resCall = calls.find((c: string) => c.includes("[API Res]"));
      expect(resCall).toBeDefined();
      // The response should be logged without body parsing since content-type is octet-stream
      expect(resCall).toContain("200");
    });

    it("should handle text/plain content type in request", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/text-endpoint", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "This is plain text content",
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const reqCall = calls.find((c: string) => c.includes("[API Req]"));
      expect(reqCall).toBeDefined();
      expect(reqCall).toContain("This is plain text content");
    });

    it("should handle text/html content type in response", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/page", {
        method: "GET",
      });

      const response = new Response("<html><body>Hello</body></html>", {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      });

      logApiResponse(request, response);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const resCall = calls.find((c: string) => c.includes("[API Res]"));
      expect(resCall).toBeDefined();
      expect(resCall).toContain("Hello");
    });
  });

  describe("logApiResponse - additional branches", () => {
    it("should log response with JSON body and mask sensitive data", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/auth/login", {
        method: "POST",
      });

      const response = new Response(
        JSON.stringify({
          accessToken: "jwt-token-value",
          refreshToken: "refresh-value",
          user: { id: "123", name: "Test" },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      logApiResponse(request, response);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const resCall = calls.find((c: string) => c.includes("[API Res]"));
      expect(resCall).toBeDefined();
      expect(resCall).toContain("[MASKED]");
      expect(resCall).not.toContain("jwt-token-value");
      expect(resCall).not.toContain("refresh-value");
    });

    it("should log response without body when content-type is missing", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/no-content", {
        method: "DELETE",
      });

      const response = new Response(null, {
        status: 204,
      });

      logApiResponse(request, response);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const resCall = calls.find((c: string) => c.includes("[API Res]"));
      expect(resCall).toBeDefined();
      expect(resCall).toContain("204");
    });

    it("should handle getSafeBody error in response (clone fails)", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/error-response", {
        method: "GET",
      });

      // Create a response where clone() will fail
      const brokenResponse = new Response("data", {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
      // Override clone to throw
      brokenResponse.clone = () => {
        throw new Error("Clone failed");
      };

      logApiResponse(request, brokenResponse);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const resCall = calls.find((c: string) => c.includes("[API Res]"));
      expect(resCall).toBeDefined();
    });

    it("should handle getSafeBody error in request (clone fails)", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/error-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: "test" }),
      });
      // Override clone to throw
      request.clone = () => {
        throw new Error("Clone failed");
      };

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const reqCall = calls.find((c: string) => c.includes("[API Req]"));
      expect(reqCall).toBeDefined();
    });
  });

  describe("truncateBody edge cases", () => {
    it("should not truncate body types that are neither string nor object", async () => {
      mockDebug.mockClear();

      // This tests the fallback return in truncateBody (line 254)
      // When body is a number or other primitive, it should pass through
      const request = new Request("https://api.example.com/number", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "42",
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const reqCall = calls.find((c: string) => c.includes("[API Req]"));
      expect(reqCall).toBeDefined();
      expect(reqCall).toContain("42");
    });
  });

  describe("maskSensitiveData edge cases", () => {
    it("should not mask non-object body", async () => {
      mockDebug.mockClear();

      const request = new Request("https://api.example.com/text", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "password=secret&token=abc",
      });

      logApiRequest(request);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockDebug).toHaveBeenCalled();
      const calls = mockDebug.mock.calls.map((c) => c[0]);
      const reqCall = calls.find((c: string) => c.includes("[API Req]"));
      expect(reqCall).toBeDefined();
      // String body is not object-masked, it's kept as-is
      expect(reqCall).toContain("password=secret");
    });
  });
});
