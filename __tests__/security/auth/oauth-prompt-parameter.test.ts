/**
 * Unit Tests: OAuth prompt=select_account 파라미터 검증
 * Target: packages/@withwiz/toolkit/auth/core/oauth/index.ts
 *
 * 테스트 범위:
 * - Google OAuth URL에 prompt=select_account consent 포함 확인
 * - GitHub OAuth URL에 prompt 미포함 확인
 * - 미설정 시 에러 처리
 *
 * 관련 커밋: 05461ca5 - fix: Google OAuth 계정 선택 및 로그인 에러 코드 수정
 */

import { OAuthManager, OAuthProvider } from "@withwiz/auth/core/oauth";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("SC-E2E-OAUTH-SEL-003: shared 레이어 OAuth prompt 설정 검증", () => {
  const config = {
    google: {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      redirectUri: "http://localhost:3000/api/auth/oauth/google/callback",
    },
    github: {
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
      redirectUri: "http://localhost:3000/api/auth/oauth/github/callback",
    },
  };

  let oauthManager: OAuthManager;

  beforeEach(() => {
    vi.clearAllMocks();
    oauthManager = new OAuthManager(config, mockLogger);
  });

  describe("Google OAuth prompt 파라미터", () => {
    test("TC-E2E-OAUTH-SEL-020: Google URL에 prompt=select_account consent 포함", () => {
      const url = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, "state-123");
      const params = new URLSearchParams(new URL(url).search);

      expect(params.get("prompt")).toBe("select_account consent");
    });

    test("TC-E2E-OAUTH-SEL-020b: Google URL에 select_account 포함 확인 (계정 선택 화면)", () => {
      const url = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, "state-abc");

      expect(url).toContain("select_account");
    });

    test("TC-E2E-OAUTH-SEL-020c: Google URL에 consent 포함 확인 (권한 동의 화면)", () => {
      const url = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, "state-abc");

      expect(url).toContain("consent");
    });

    test("TC-E2E-OAUTH-SEL-020d: Google URL에 access_type=offline 포함", () => {
      const url = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, "state-123");
      const params = new URLSearchParams(new URL(url).search);

      expect(params.get("access_type")).toBe("offline");
    });

    test("TC-E2E-OAUTH-SEL-020e: Google URL 필수 파라미터 모두 포함", () => {
      const url = oauthManager.getLoginUrl(OAuthProvider.GOOGLE, "state-xyz");
      const params = new URLSearchParams(new URL(url).search);

      expect(params.get("client_id")).toBe("google-client-id");
      expect(params.get("redirect_uri")).toBe("http://localhost:3000/api/auth/oauth/google/callback");
      expect(params.get("response_type")).toBe("code");
      expect(params.get("scope")).toBe("openid email profile");
      expect(params.get("state")).toBe("state-xyz");
    });
  });

  describe("GitHub OAuth prompt 미포함", () => {
    test("TC-E2E-OAUTH-SEL-022: GitHub URL에 prompt 파라미터 미포함", () => {
      const url = oauthManager.getLoginUrl(OAuthProvider.GITHUB, "state-123");
      const params = new URLSearchParams(new URL(url).search);

      expect(params.get("prompt")).toBeNull();
    });

    test("TC-E2E-OAUTH-SEL-022b: GitHub URL scope 확인", () => {
      const url = oauthManager.getLoginUrl(OAuthProvider.GITHUB, "state-123");
      const params = new URLSearchParams(new URL(url).search);

      expect(params.get("scope")).toBe("read:user user:email");
    });
  });

  describe("에러 처리", () => {
    test("TC-E2E-OAUTH-SEL-023: Google 미설정 시 OAuthError", () => {
      const noGoogleConfig = { github: config.github };
      const manager = new OAuthManager(noGoogleConfig as any, mockLogger);

      expect(() => {
        manager.getLoginUrl(OAuthProvider.GOOGLE, "state-123");
      }).toThrow("Google OAuth not configured");
    });

    test("TC-E2E-OAUTH-SEL-024: GitHub 미설정 시 OAuthError", () => {
      const noGithubConfig = { google: config.google };
      const manager = new OAuthManager(noGithubConfig as any, mockLogger);

      expect(() => {
        manager.getLoginUrl(OAuthProvider.GITHUB, "state-123");
      }).toThrow("GitHub OAuth not configured");
    });

    test("TC-E2E-OAUTH-SEL-025: 지원하지 않는 provider 시 OAuthError", () => {
      expect(() => {
        oauthManager.getLoginUrl("twitter" as OAuthProvider, "state-123");
      }).toThrow("Unsupported OAuth provider");
    });
  });
});
