/**
 * OAuth Module tests
 *
 * Test Scope:
 * - Google/GitHub/Kakao login URL generation
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
      kakao: {
        clientId: "kakao-client-id",
        clientSecret: "kakao-client-secret",
        redirectUri: "http://localhost:3000/api/auth/callback/kakao",
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

      describe("Kakao OAuth", () => {
        it("should generate valid Kakao login URL", () => {
          const state = "random-state-789";
          const url = oauthManager.getLoginUrl(OAuthProvider.KAKAO, state);

          expect(url).toContain("https://kauth.kakao.com/oauth/authorize");
          expect(url).toContain("client_id=kakao-client-id");
          expect(url).toContain(
            "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fkakao",
          );
          expect(url).toContain("response_type=code");
          expect(url).toContain("scope=profile_nickname+profile_image+account_email");
          expect(url).toContain("state=random-state-789");
        });

        it("should include state parameter for CSRF protection", () => {
          const state = "csrf-token-kakao";
          const url = oauthManager.getLoginUrl(OAuthProvider.KAKAO, state);

          expect(url).toContain(`state=${state}`);
        });

        it("should throw error if Kakao not configured", () => {
          const unconfiguredManager = new OAuthManager({}, mockLogger);

          expect(() => {
            unconfiguredManager.getLoginUrl(OAuthProvider.KAKAO, "state");
          }).toThrow("Kakao OAuth not configured");
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

        it("should handle network errors", async () => {
          global.fetch = vi.fn(() =>
            Promise.reject(new Error("Network error")),
          );

          await expect(
            oauthManager.exchangeCodeForToken(OAuthProvider.GITHUB, "code"),
          ).rejects.toThrow("GitHub token exchange failed");

          expect(mockLogger.error).toHaveBeenCalled();
        });
      });

      describe("Kakao Token Exchange", () => {
        it("should exchange code for access token", async () => {
          const mockResponse = {
            access_token: "kakao-access-token",
            token_type: "bearer",
            expires_in: 21599,
            refresh_token: "kakao-refresh-token",
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockResponse),
            } as Response),
          );

          const token = await oauthManager.exchangeCodeForToken(
            OAuthProvider.KAKAO,
            "auth-code-789",
          );

          expect(token).toBe("kakao-access-token");
          expect(fetch).toHaveBeenCalledWith(
            "https://kauth.kakao.com/oauth/token",
            expect.objectContaining({
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }),
          );
          expect(mockLogger.debug).toHaveBeenCalledWith(
            "Kakao token exchange successful",
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
              OAuthProvider.KAKAO,
              "invalid-code",
            ),
          ).rejects.toThrow("Kakao token exchange failed");

          expect(mockLogger.error).toHaveBeenCalled();
        });

        it("should throw error if Kakao not configured", async () => {
          const unconfiguredManager = new OAuthManager({}, mockLogger);

          await expect(
            unconfiguredManager.exchangeCodeForToken(
              OAuthProvider.KAKAO,
              "code",
            ),
          ).rejects.toThrow("Kakao OAuth not configured");
        });

        it("should handle network errors", async () => {
          global.fetch = vi.fn(() =>
            Promise.reject(new Error("Network error")),
          );

          await expect(
            oauthManager.exchangeCodeForToken(OAuthProvider.KAKAO, "code"),
          ).rejects.toThrow("Kakao token exchange failed");

          expect(mockLogger.error).toHaveBeenCalled();
        });
      });

      describe("Unsupported Provider", () => {
        it("should throw error for unsupported provider", async () => {
          await expect(
            oauthManager.exchangeCodeForToken("UNSUPPORTED" as any, "code"),
          ).rejects.toThrow("Unsupported OAuth provider");
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

        it("should handle missing optional fields", async () => {
          const mockUserData = {
            id: 11111,
            login: "minimal-user",
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

          expect(userInfo.id).toBe("11111");
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
            oauthManager.getUserInfo(OAuthProvider.GITHUB, "invalid-token"),
          ).rejects.toThrow("Failed to retrieve GitHub user info");

          expect(mockLogger.error).toHaveBeenCalled();
        });

        it("should handle network errors", async () => {
          global.fetch = vi.fn(() =>
            Promise.reject(new Error("Network error")),
          );

          await expect(
            oauthManager.getUserInfo(OAuthProvider.GITHUB, "token"),
          ).rejects.toThrow("Failed to retrieve GitHub user info");
        });
      });

      describe("Kakao User Info", () => {
        it("should fetch user info successfully", async () => {
          const mockUserData = {
            id: 1234567890,
            kakao_account: {
              email: "user@kakao.com",
              is_email_verified: true,
              profile: {
                nickname: "카카오유저",
                profile_image_url: "https://k.kakaocdn.net/avatar.jpg",
              },
            },
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockUserData),
            } as Response),
          );

          const userInfo = await oauthManager.getUserInfo(
            OAuthProvider.KAKAO,
            "kakao-access-token",
          );

          expect(userInfo).toEqual({
            id: "1234567890",
            email: "user@kakao.com",
            name: "카카오유저",
            image: "https://k.kakaocdn.net/avatar.jpg",
            emailVerified: true,
          });

          expect(fetch).toHaveBeenCalledWith(
            "https://kapi.kakao.com/v2/user/me",
            expect.objectContaining({
              headers: { Authorization: "Bearer kakao-access-token" },
            }),
          );

          expect(mockLogger.debug).toHaveBeenCalledWith(
            "Kakao user info retrieved",
            expect.objectContaining({ userId: 1234567890 }),
          );
        });

        it("should handle missing optional fields", async () => {
          const mockUserData = {
            id: 9876543210,
            kakao_account: {},
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockUserData),
            } as Response),
          );

          const userInfo = await oauthManager.getUserInfo(
            OAuthProvider.KAKAO,
            "token",
          );

          expect(userInfo.id).toBe("9876543210");
          expect(userInfo.name).toBeNull();
          expect(userInfo.image).toBeNull();
          expect(userInfo.emailVerified).toBe(false);
        });

        it("should handle missing kakao_account", async () => {
          const mockUserData = {
            id: 1111111111,
          };

          global.fetch = vi.fn(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockUserData),
            } as Response),
          );

          const userInfo = await oauthManager.getUserInfo(
            OAuthProvider.KAKAO,
            "token",
          );

          expect(userInfo.id).toBe("1111111111");
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
            oauthManager.getUserInfo(OAuthProvider.KAKAO, "invalid-token"),
          ).rejects.toThrow("Failed to retrieve Kakao user info");

          expect(mockLogger.error).toHaveBeenCalled();
        });

        it("should handle network errors", async () => {
          global.fetch = vi.fn(() =>
            Promise.reject(new Error("Network error")),
          );

          await expect(
            oauthManager.getUserInfo(OAuthProvider.KAKAO, "token"),
          ).rejects.toThrow("Failed to retrieve Kakao user info");
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
      github: {
        clientId: "test-github-id",
        clientSecret: "test-github-secret",
        redirectUri: "http://localhost:3000/callback/github",
      },
      kakao: {
        clientId: "test-kakao-id",
        clientSecret: "test-kakao-secret",
        redirectUri: "http://localhost:3000/callback/kakao",
      },
    };

    const oauthManager = new OAuthManager(config, mockLogger);

    it("should complete full Google OAuth flow", async () => {
      const state = "csrf-token";
      const loginUrl = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, state);
      expect(loginUrl).toContain("state=csrf-token");

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

    it("should complete full GitHub OAuth flow", async () => {
      const state = "csrf-token-github";
      const loginUrl = oauthManager.getLoginUrl(OAuthProvider.GITHUB, state);
      expect(loginUrl).toContain("state=csrf-token-github");

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "github-test-token",
              token_type: "bearer",
            }),
        } as Response),
      );

      const token = await oauthManager.exchangeCodeForToken(
        OAuthProvider.GITHUB,
        "auth-code",
      );
      expect(token).toBe("github-test-token");

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 99999,
              login: "testuser",
              email: "test@github.com",
              name: "Test User",
              avatar_url: "https://github.com/avatar.jpg",
            }),
        } as Response),
      );

      const userInfo = await oauthManager.getUserInfo(
        OAuthProvider.GITHUB,
        token,
      );
      expect(userInfo.id).toBe("99999");
      expect(userInfo.email).toBe("test@github.com");
      expect(userInfo.name).toBe("Test User");
    });

    it("should complete full Kakao OAuth flow", async () => {
      const state = "csrf-token-kakao";
      const loginUrl = oauthManager.getLoginUrl(OAuthProvider.KAKAO, state);
      expect(loginUrl).toContain("state=csrf-token-kakao");

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "kakao-test-token",
              token_type: "bearer",
              expires_in: 21599,
            }),
        } as Response),
      );

      const token = await oauthManager.exchangeCodeForToken(
        OAuthProvider.KAKAO,
        "auth-code",
      );
      expect(token).toBe("kakao-test-token");

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 5555555,
              kakao_account: {
                email: "test@kakao.com",
                is_email_verified: true,
                profile: {
                  nickname: "테스트유저",
                  profile_image_url: "https://k.kakaocdn.net/test.jpg",
                },
              },
            }),
        } as Response),
      );

      const userInfo = await oauthManager.getUserInfo(
        OAuthProvider.KAKAO,
        token,
      );
      expect(userInfo.id).toBe("5555555");
      expect(userInfo.email).toBe("test@kakao.com");
      expect(userInfo.name).toBe("테스트유저");
    });
  });
});
