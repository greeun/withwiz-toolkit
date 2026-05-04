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
});
