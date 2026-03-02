/**
 * OAuth Module tests
 *
 * Test Scope:
 * - Google/GitHub login URL generation
 * - Authorization Code → Access Token exchange
 * - Fetching user information
 * - State parameter validation (CSRF protection)
 * - Error handling
 */

import { OAuthManager, OAuthProvider } from "@withwiz/auth/core/oauth";

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("OAuth Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("OAuthManager", () => {
    const config = {
      google: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
        redirectUri: "http://localhost:3000/api/auth/callback/google",
      },
      github: {
        clientId: "github-client-id",
        clientSecret: "github-client-secret",
        redirectUri: "http://localhost:3000/api/auth/callback/github",
      },
    };

    const oauthManager = new OAuthManager(config, mockLogger);

    describe("getLoginUrl", () => {
      describe("Google OAuth", () => {
        it("should generate valid Google login URL", () => {
          const state = "random-state-123";
          const url = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, state);

          expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
          expect(url).toContain("client_id=google-client-id");
          expect(url).toContain(
            "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fgoogle",
          );
          expect(url).toContain("response_type=code");
          expect(url).toContain("scope=openid+email+profile");
          expect(url).toContain("state=random-state-123");
          expect(url).toContain("access_type=offline");
          expect(url).toContain("prompt=select_account+consent");
        });

        it("should include state parameter for CSRF protection", () => {
          const state = "csrf-protection-token";
          const url = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, state);

          expect(url).toContain(`state=${state}`);
        });

        it("should throw error if Google not configured", () => {
          const unconfiguredManager = new OAuthManager({}, mockLogger);

          expect(() => {
            unconfiguredManager.getLoginUrl(OAuthProvider.GOOGLE, "state");
          }).toThrow("Google OAuth not configured");
        });
      });

      describe("GitHub OAuth", () => {
        it("should generate valid GitHub login URL", () => {
          const state = "random-state-456";
          const url = oauthManager.getLoginUrl(OAuthProvider.GITHUB, state);

          expect(url).toContain("https://github.com/login/oauth/authorize");
          expect(url).toContain("client_id=github-client-id");
          expect(url).toContain(
            "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fgithub",
          );
          expect(url).toContain("scope=read%3Auser+user%3Aemail");
          expect(url).toContain("state=random-state-456");
        });

        it("should include state parameter for CSRF protection", () => {
          const state = "csrf-token-github";
          const url = oauthManager.getLoginUrl(OAuthProvider.GITHUB, state);

          expect(url).toContain(`state=${state}`);
        });

        it("should throw error if GitHub not configured", () => {
          const unconfiguredManager = new OAuthManager({}, mockLogger);

          expect(() => {
            unconfiguredManager.getLoginUrl(OAuthProvider.GITHUB, "state");
          }).toThrow("GitHub OAuth not configured");
        });
      });

      describe("Unsupported Provider", () => {
        it("should throw error for unsupported provider", () => {
          expect(() => {
            oauthManager.getLoginUrl("UNSUPPORTED" as any, "state");
          }).toThrow("Unsupported OAuth provider");
        });
      });
    });

    describe("exchangeCodeForToken", () => {
      describe("Google Token Exchange", () => {
        it("should exchange code for access token", async () => {
          const mockResponse = {
            access_token: "google-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockResponse),
            } as Response),
          );

          const token = await oauthManager.exchangeCodeForToken(
            OAuthProvider.GOOGLE,
            "auth-code-123",
          );

          expect(token).toBe("google-access-token");
          expect(fetch).toHaveBeenCalledWith(
            "https://oauth2.googleapis.com/token",
            expect.objectContaining({
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }),
          );
          expect(mockLogger.debug).toHaveBeenCalledWith(
            "Google token exchange successful",
          );
        });

        it("should throw error on failed token exchange", async () => {
          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: false,
              status: 400,
              text: () => Promise.resolve("Invalid grant"),
            } as Response),
          );

          await expect(
            oauthManager.exchangeCodeForToken(
              OAuthProvider.GOOGLE,
              "invalid-code",
            ),
          ).rejects.toThrow("Google token exchange failed");

          expect(mockLogger.error).toHaveBeenCalled();
        });

        it("should throw error if Google not configured", async () => {
          const unconfiguredManager = new OAuthManager({}, mockLogger);

          await expect(
            unconfiguredManager.exchangeCodeForToken(
              OAuthProvider.GOOGLE,
              "code",
            ),
          ).rejects.toThrow("Google OAuth not configured");
        });

        it("should handle network errors", async () => {
          global.fetch = vi.fn(() =>
            Promise.reject(new Error("Network error")),
          );

          await expect(
            oauthManager.exchangeCodeForToken(OAuthProvider.GOOGLE, "code"),
          ).rejects.toThrow("Google token exchange failed");

          expect(mockLogger.error).toHaveBeenCalled();
        });
      });

      describe("GitHub Token Exchange", () => {
        it("should exchange code for access token", async () => {
          const mockResponse = {
            access_token: "github-access-token",
            token_type: "bearer",
            scope: "read:user,user:email",
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockResponse),
            } as Response),
          );

          const token = await oauthManager.exchangeCodeForToken(
            OAuthProvider.GITHUB,
            "auth-code-456",
          );

          expect(token).toBe("github-access-token");
          expect(fetch).toHaveBeenCalledWith(
            "https://github.com/login/oauth/access_token",
            expect.objectContaining({
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }),
          );
          expect(mockLogger.debug).toHaveBeenCalledWith(
            "GitHub token exchange successful",
          );
        });

        it("should throw error on failed token exchange", async () => {
          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: false,
              status: 400,
              text: () => Promise.resolve("Bad verification code"),
            } as Response),
          );

          await expect(
            oauthManager.exchangeCodeForToken(
              OAuthProvider.GITHUB,
              "invalid-code",
            ),
          ).rejects.toThrow("GitHub token exchange failed");

          expect(mockLogger.error).toHaveBeenCalled();
        });

        it("should throw error if GitHub not configured", async () => {
          const unconfiguredManager = new OAuthManager({}, mockLogger);

          await expect(
            unconfiguredManager.exchangeCodeForToken(
              OAuthProvider.GITHUB,
              "code",
            ),
          ).rejects.toThrow("GitHub OAuth not configured");
        });
      });
    });

    describe("getUserInfo", () => {
      describe("Google User Info", () => {
        it("should fetch user info successfully", async () => {
          const mockUserData = {
            id: "google-user-123",
            email: "user@example.com",
            name: "John Doe",
            picture: "https://example.com/avatar.jpg",
            verified_email: true,
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockUserData),
            } as Response),
          );

          const userInfo = await oauthManager.getUserInfo(
            OAuthProvider.GOOGLE,
            "google-access-token",
          );

          expect(userInfo).toEqual({
            id: "google-user-123",
            email: "user@example.com",
            name: "John Doe",
            image: "https://example.com/avatar.jpg",
            emailVerified: true,
          });

          expect(fetch).toHaveBeenCalledWith(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            expect.objectContaining({
              headers: { Authorization: "Bearer google-access-token" },
            }),
          );

          expect(mockLogger.debug).toHaveBeenCalledWith(
            "Google user info retrieved",
            expect.objectContaining({ userId: "google-user-123" }),
          );
        });

        it("should handle missing optional fields", async () => {
          const mockUserData = {
            id: "google-user-456",
            email: "minimal@example.com",
            verified_email: false,
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockUserData),
            } as Response),
          );

          const userInfo = await oauthManager.getUserInfo(
            OAuthProvider.GOOGLE,
            "token",
          );

          expect(userInfo.name).toBeNull();
          expect(userInfo.image).toBeNull();
          expect(userInfo.emailVerified).toBe(false);
        });

        it("should throw error on failed request", async () => {
          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: false,
              status: 401,
            } as Response),
          );

          await expect(
            oauthManager.getUserInfo(OAuthProvider.GOOGLE, "invalid-token"),
          ).rejects.toThrow("Failed to retrieve Google user info");

          expect(mockLogger.error).toHaveBeenCalled();
        });

        it("should handle network errors", async () => {
          global.fetch = vi.fn(() =>
            Promise.reject(new Error("Network error")),
          );

          await expect(
            oauthManager.getUserInfo(OAuthProvider.GOOGLE, "token"),
          ).rejects.toThrow("Failed to retrieve Google user info");
        });
      });

      describe("GitHub User Info", () => {
        it("should fetch user info successfully", async () => {
          const mockUserData = {
            id: 12345,
            login: "johndoe",
            email: "john@example.com",
            name: "John Doe",
            avatar_url: "https://github.com/avatar.jpg",
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockUserData),
            } as Response),
          );

          const userInfo = await oauthManager.getUserInfo(
            OAuthProvider.GITHUB,
            "github-access-token",
          );

          expect(userInfo).toEqual({
            id: "12345",
            email: "john@example.com",
            name: "John Doe",
            image: "https://github.com/avatar.jpg",
            emailVerified: true,
          });

          expect(fetch).toHaveBeenCalledWith(
            "https://api.github.com/user",
            expect.objectContaining({
              headers: {
                Authorization: "Bearer github-access-token",
                "User-Agent": "Auth-Module",
              },
            }),
          );

          expect(mockLogger.debug).toHaveBeenCalledWith(
            "GitHub user info retrieved",
            expect.objectContaining({ userId: 12345 }),
          );
        });

        it("should handle missing email", async () => {
          const mockUserData = {
            id: 67890,
            login: "janedoe",
            name: "Jane Doe",
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockUserData),
            } as Response),
          );

          const userInfo = await oauthManager.getUserInfo(
            OAuthProvider.GITHUB,
            "token",
          );

          expect(userInfo.email).toBeUndefined();
          expect(userInfo.emailVerified).toBe(false);
        });

        it("should throw error on failed request", async () => {
          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: false,
              status: 401,
            } as Response),
          );

          await expect(
            oauthManager.getUserInfo(OAuthProvider.GITHUB, "invalid-token"),
          ).rejects.toThrow("Failed to retrieve GitHub user info");

          expect(mockLogger.error).toHaveBeenCalled();
        });
      });

      describe("Unsupported Provider", () => {
        it("should throw error for unsupported provider", async () => {
          await expect(
            oauthManager.getUserInfo("UNSUPPORTED" as any, "token"),
          ).rejects.toThrow("Unsupported OAuth provider");
        });
      });
    });
  });

  describe("Integration Tests", () => {
    const config = {
      google: {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      },
    };

    const oauthManager = new OAuthManager(config, mockLogger);

    it("should complete full Google OAuth flow", async () => {
      // Step 1: Generate login URL
      const state = "csrf-token";
      const loginUrl = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, state);
      expect(loginUrl).toContain("state=csrf-token");

      // Step 2: Exchange code for token
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: "test-token" }),
        } as Response),
      );

      const token = await oauthManager.exchangeCodeForToken(
        OAuthProvider.GOOGLE,
        "auth-code",
      );
      expect(token).toBe("test-token");

      // Step 3: Get user info
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "user-123",
              email: "test@example.com",
              verified_email: true,
            }),
        } as Response),
      );

      const userInfo = await oauthManager.getUserInfo(
        OAuthProvider.GOOGLE,
        token,
      );
      expect(userInfo.id).toBe("user-123");
      expect(userInfo.email).toBe("test@example.com");
    });
  });
});
