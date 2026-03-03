// @vitest-environment jsdom
/**
 * Client Utils Tests
 *
 * 테스트 범위:
 * - copyToClipboard: Clipboard API and fallback support
 */

import { copyToClipboard } from "@withwiz/utils/client/client-utils";

// Mock Logger
vi.mock("@withwiz/logger/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Client Utils", () => {
  describe("copyToClipboard", () => {
    let mockClipboard: any;

    beforeEach(() => {
      // Mock navigator.clipboard
      mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
      };

      Object.defineProperty(navigator, "clipboard", {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      // Mock isSecureContext
      Object.defineProperty(window, "isSecureContext", {
        value: true,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should copy text using Clipboard API when available", async () => {
      await copyToClipboard("test text");

      expect(mockClipboard.writeText).toHaveBeenCalledWith("test text");
    });

    it("should handle empty string", async () => {
      await copyToClipboard("");

      expect(mockClipboard.writeText).toHaveBeenCalledWith("");
    });

    it("should handle long text", async () => {
      const longText = "a".repeat(10000);
      await copyToClipboard(longText);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(longText);
    });

    it("should handle special characters", async () => {
      const specialText = "Hello\nWorld\t!@#$%^&*()";
      await copyToClipboard(specialText);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(specialText);
    });

    it("should handle unicode characters", async () => {
      const unicodeText = "안녕하세요 🎉 Hello 世界";
      await copyToClipboard(unicodeText);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(unicodeText);
    });

    it("should handle Clipboard API failure and return false", async () => {
      // Make Clipboard API fail (reject throws caught as error)
      mockClipboard.writeText.mockRejectedValueOnce(new Error("Clipboard error"));

      const result = await copyToClipboard("fallback test");

      // When Clipboard API fails and throws, catch block returns false
      expect(typeof result).toBe("boolean");
      expect(result).toBe(false);
    });

    it("should work in secure context", async () => {
      Object.defineProperty(window, "isSecureContext", {
        value: true,
        writable: true,
        configurable: true,
      });

      await copyToClipboard("secure text");

      expect(mockClipboard.writeText).toHaveBeenCalled();
    });

    it("should handle insecure context gracefully", async () => {
      Object.defineProperty(window, "isSecureContext", {
        value: false,
        writable: true,
        configurable: true,
      });

      const execCommandMock = vi.fn().mockReturnValue(true);
      Object.defineProperty(document, "execCommand", {
        value: execCommandMock,
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard("insecure text");

      // isSecureContext=false skips Clipboard API, uses execCommand fallback
      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
      // execCommand was called for fallback path
      expect(execCommandMock).toHaveBeenCalledWith("copy");
    });

    it("should handle URL copying", async () => {
      const url = "https://example.com/path?param=value";
      await copyToClipboard(url);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(url);
    });

    it("should handle JSON copying", async () => {
      const json = JSON.stringify({ key: "value", nested: { id: 123 } });
      await copyToClipboard(json);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(json);
    });

    it("should handle multiple sequential copies", async () => {
      await copyToClipboard("first");
      await copyToClipboard("second");
      await copyToClipboard("third");

      expect(mockClipboard.writeText).toHaveBeenCalledTimes(3);
      expect(mockClipboard.writeText).toHaveBeenNthCalledWith(1, "first");
      expect(mockClipboard.writeText).toHaveBeenNthCalledWith(2, "second");
      expect(mockClipboard.writeText).toHaveBeenNthCalledWith(3, "third");
    });
  });
});
