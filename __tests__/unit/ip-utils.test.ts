/**
 * IP Utils tests
 *
 * Test Scope:
 * - IPv4/IPv6 validation
 * - Private IP identification
 * - IP normalization
 * - Client IP extraction
 */

import {
  isPrivateIP,
  isIPv6,
  normalizeIP,
  extractClientIp,
  isValidIP,
} from "@withwiz/utils/ip-utils";

describe("IP Utils", () => {
  describe("isValidIP", () => {
    describe("IPv4 Validity Check", () => {
      it("should accept valid IPv4 addresses", () => {
        expect(isValidIP("192.168.1.1")).toBe(true);
        expect(isValidIP("10.0.0.1")).toBe(true);
        expect(isValidIP("8.8.8.8")).toBe(true);
        expect(isValidIP("127.0.0.1")).toBe(true);
        expect(isValidIP("255.255.255.255")).toBe(true);
        expect(isValidIP("0.0.0.0")).toBe(true);
      });

      it("should reject invalid IPv4 addresses", () => {
        expect(isValidIP("256.1.1.1")).toBe(false); // Out of range
        expect(isValidIP("192.168.1")).toBe(false); // Insufficient octets
        expect(isValidIP("192.168.1.1.1")).toBe(false); // Excessive octets
        expect(isValidIP("192.168.-1.1")).toBe(false); // Negative
        expect(isValidIP("192.168.a.1")).toBe(false); // Contains character
        expect(isValidIP("...")).toBe(false);
      });
    });

    describe("IPv6 Validity Check", () => {
      it("should accept valid IPv6 addresses", () => {
        expect(isValidIP("::1")).toBe(true); // localhost
        expect(isValidIP("2001:4860:4860::8888")).toBe(true); // Google DNS
        expect(isValidIP("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(true);
      });

      it("should reject invalid IPv6 addresses", () => {
        expect(isValidIP("gggg::1")).toBe(false); // Invalid hex
        expect(isValidIP("2001:db8::g")).toBe(false);
      });
    });

    describe("Edge Cases", () => {
      it("should handle edge cases", () => {
        expect(isValidIP("")).toBe(false);
        expect(isValidIP(null as any)).toBe(false);
        expect(isValidIP(undefined as any)).toBe(false);
        expect(isValidIP(123 as any)).toBe(false);
        expect(isValidIP("not an ip")).toBe(false);
      });
    });
  });

  describe("isIPv6", () => {
    it("should correctly identify IPv6 addresses", () => {
      expect(isIPv6("::1")).toBe(true);
      expect(isIPv6("2001:4860:4860::8888")).toBe(true);
      expect(isIPv6("fe80::1")).toBe(true);
    });

    it("should return false for IPv4 addresses", () => {
      expect(isIPv6("192.168.1.1")).toBe(false);
      expect(isIPv6("8.8.8.8")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isIPv6("")).toBe(false);
      expect(isIPv6("not-an-ip")).toBe(false);
    });
  });

  describe("isPrivateIP", () => {
    describe("IPv4 Private Ranges", () => {
      it("should identify 10.x.x.x as private", () => {
        expect(isPrivateIP("10.0.0.1")).toBe(true);
        expect(isPrivateIP("10.255.255.255")).toBe(true);
      });

      it("should identify 172.16-31.x.x as private", () => {
        expect(isPrivateIP("172.16.0.1")).toBe(true);
        expect(isPrivateIP("172.31.255.255")).toBe(true);
        expect(isPrivateIP("172.20.10.5")).toBe(true);
      });

      it("should reject 172.x outside 16-31 range", () => {
        expect(isPrivateIP("172.15.0.1")).toBe(false);
        expect(isPrivateIP("172.32.0.1")).toBe(false);
      });

      it("should identify 192.168.x.x as private", () => {
        expect(isPrivateIP("192.168.0.1")).toBe(true);
        expect(isPrivateIP("192.168.255.255")).toBe(true);
      });

      it("should identify localhost as private", () => {
        expect(isPrivateIP("127.0.0.1")).toBe(true);
        expect(isPrivateIP("127.0.0.255")).toBe(true);
      });

      it("should identify link-local as private", () => {
        expect(isPrivateIP("169.254.1.1")).toBe(true);
      });

      it("should identify multicast and reserved as private", () => {
        expect(isPrivateIP("224.0.0.1")).toBe(true); // multicast
        expect(isPrivateIP("240.0.0.1")).toBe(true); // reserved
        expect(isPrivateIP("0.0.0.0")).toBe(true);
      });
    });

    describe("IPv4 Public Addresses", () => {
      it("should identify public IPs as non-private", () => {
        expect(isPrivateIP("8.8.8.8")).toBe(false); // Google DNS
        expect(isPrivateIP("1.1.1.1")).toBe(false); // Cloudflare DNS
        expect(isPrivateIP("216.58.214.174")).toBe(false); // Google
      });
    });

    describe("IPv6 Private Ranges", () => {
      it("should identify ::1 (localhost) as private", () => {
        expect(isPrivateIP("::1")).toBe(true);
      });

      it("should identify link-local (fe80:) as private", () => {
        expect(isPrivateIP("fe80::1")).toBe(true);
      });

      it("should identify unique local (fc00:, fd00:) as private", () => {
        expect(isPrivateIP("fc00::1")).toBe(true);
        expect(isPrivateIP("fd00::1")).toBe(true);
      });
    });

    describe("IPv6 Public Addresses", () => {
      it("should identify public IPv6 as non-private", () => {
        expect(isPrivateIP("2001:4860:4860::8888")).toBe(false); // Google DNS
      });
    });

    describe("Edge Cases", () => {
      it("should handle edge cases", () => {
        expect(isPrivateIP("")).toBe(false);
        expect(isPrivateIP(null as any)).toBe(false);
        expect(isPrivateIP(undefined as any)).toBe(false);
      });
    });
  });

  describe("normalizeIP", () => {
    it("should normalize IPv6 to lowercase", () => {
      expect(normalizeIP("::1")).toBe("::1");
      expect(normalizeIP("2001:4860:4860::8888")).toBe("2001:4860:4860::8888");
      expect(normalizeIP("FE80::1")).toBe("fe80::1");
    });

    it("should return IPv4 as-is", () => {
      expect(normalizeIP("192.168.1.1")).toBe("192.168.1.1");
      expect(normalizeIP("8.8.8.8")).toBe("8.8.8.8");
    });

    it("should handle edge cases", () => {
      expect(normalizeIP("")).toBe("");
      expect(normalizeIP(null as any)).toBe("");
      expect(normalizeIP(undefined as any)).toBe("");
    });
  });

  describe("extractClientIp", () => {
    describe("Cloudflare Headers", () => {
      it("should prioritize CF-Connecting-IP", () => {
        const headers = new Headers({
          "cf-connecting-ip": "1.2.3.4",
          "x-forwarded-for": "5.6.7.8",
          "x-real-ip": "9.10.11.12",
        });
        expect(extractClientIp(headers)).toBe("1.2.3.4");
      });

      it("should use True-Client-IP if CF-Connecting-IP is missing", () => {
        const headers = new Headers({
          "true-client-ip": "1.2.3.4",
          "x-forwarded-for": "5.6.7.8",
        });
        expect(extractClientIp(headers)).toBe("1.2.3.4");
      });
    });

    describe("Standard Proxy Headers", () => {
      it("should use X-Real-IP if Cloudflare headers are missing", () => {
        const headers = new Headers({
          "x-real-ip": "1.2.3.4",
          "x-forwarded-for": "5.6.7.8",
        });
        expect(extractClientIp(headers)).toBe("1.2.3.4");
      });

      it("should parse X-Forwarded-For and use first IP", () => {
        const headers = new Headers({
          "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12",
        });
        expect(extractClientIp(headers)).toBe("1.2.3.4");
      });

      it("should handle X-Forwarded-For with whitespace", () => {
        const headers = new Headers({
          "x-forwarded-for": "  1.2.3.4  ,  5.6.7.8  ",
        });
        expect(extractClientIp(headers)).toBe("1.2.3.4");
      });

      it("should use X-Client-IP as fallback", () => {
        const headers = new Headers({
          "x-client-ip": "1.2.3.4",
        });
        expect(extractClientIp(headers)).toBe("1.2.3.4");
      });
    });

    describe("Invalid IPs", () => {
      it("should skip invalid IPs in X-Forwarded-For", () => {
        const headers = new Headers({
          "x-forwarded-for": "invalid, 1.2.3.4",
        });
        expect(extractClientIp(headers)).toBe(null);
      });

      it("should return null for invalid CF-Connecting-IP", () => {
        const headers = new Headers({
          "cf-connecting-ip": "not-an-ip",
        });
        expect(extractClientIp(headers)).toBe(null);
      });
    });

    describe("No Headers", () => {
      it("should return null when no IP headers present", () => {
        const headers = new Headers();
        expect(extractClientIp(headers)).toBe(null);
      });

      it("should return null when headers are empty", () => {
        const headers = new Headers({
          "content-type": "application/json",
        });
        expect(extractClientIp(headers)).toBe(null);
      });
    });

    describe("IPv6 Support", () => {
      it("should extract IPv6 from CF-Connecting-IP", () => {
        const headers = new Headers({
          "cf-connecting-ip": "2001:4860:4860::8888",
        });
        expect(extractClientIp(headers)).toBe("2001:4860:4860::8888");
      });

      it("should extract IPv6 localhost", () => {
        const headers = new Headers({
          "x-real-ip": "::1",
        });
        expect(extractClientIp(headers)).toBe("::1");
      });
    });
  });
});
