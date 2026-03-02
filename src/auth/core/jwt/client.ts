/**
 * Shared Auth - JWT Client Module
 *
 * 클라이언트 측 JWT 유틸리티 (브라우저 전용, 완전히 독립적)
 * 프레임워크 독립적 - React, Vue, Angular 등 어디서나 사용 가능
 */

'use client';

// ============================================================================
// Types
// ============================================================================

interface TokenStorage {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

interface UserInfo {
  userId: string;
  email: string;
  role: string;
}

// ============================================================================
// JWT Client Manager Class
// ============================================================================

export class JWTClientManager {
  private storageKey: string;

  constructor(storageKey: string = 'jwt_tokens') {
    this.storageKey = storageKey;
  }

  /**
   * 로컬 스토리지에서 토큰 가져오기
   */
  getStoredTokens(): TokenStorage | null {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return null;
      }

      const tokens = JSON.parse(stored) as TokenStorage;

      // 토큰 만료 확인
      if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
        console.debug('Stored tokens expired, clearing storage');
        this.clearStoredTokens();
        return null;
      }

      return tokens;
    } catch (error) {
      console.error('Failed to get stored tokens', { error });
      return null;
    }
  }

  /**
   * 토큰을 로컬 스토리지에 저장
   */
  storeTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number = 7 * 24 * 60 * 60 // 기본 7일 (초)
  ): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const expiresAt = Date.now() + expiresIn * 1000;
      const tokens: TokenStorage = {
        accessToken,
        refreshToken,
        expiresAt,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(tokens));
      console.debug('Tokens stored successfully', {
        expiresAt: new Date(expiresAt).toISOString(),
      });
    } catch (error) {
      console.error('Failed to store tokens', { error });
    }
  }

  /**
   * 로컬 스토리지에서 토큰 제거
   */
  clearStoredTokens(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      localStorage.removeItem(this.storageKey);
      console.debug('Stored tokens cleared');
    } catch (error) {
      console.error('Failed to clear stored tokens', { error });
    }
  }

  /**
   * JWT 토큰에서 페이로드 디코딩 (검증 없음)
   */
  decodeJWTPayload(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      console.error('Failed to decode JWT payload', { error });
      return null;
    }
  }

  /**
   * 토큰 만료 여부 확인
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeJWTPayload(token);
      if (!payload || !payload.exp) {
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Failed to check token expiration', { error });
      return true;
    }
  }

  /**
   * 토큰 남은 시간 (초)
   */
  getTokenRemainingTime(token: string): number {
    try {
      const payload = this.decodeJWTPayload(token);
      if (!payload || !payload.exp) {
        return 0;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const remainingTime = payload.exp - currentTime;

      return Math.max(0, remainingTime);
    } catch (error) {
      console.error('Failed to get token remaining time', { error });
      return 0;
    }
  }

  /**
   * 토큰에서 사용자 정보 추출
   */
  extractUserFromToken(token: string): UserInfo | null {
    try {
      const payload = this.decodeJWTPayload(token);
      if (!payload || !payload.userId || !payload.email || !payload.role) {
        return null;
      }

      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    } catch (error) {
      console.error('Failed to extract user from token', { error });
      return null;
    }
  }

  /**
   * 토큰에서 사용자 role 추출
   */
  getUserRole(token: string | null): string {
    if (!token) {
      return 'USER';
    }

    const user = this.extractUserFromToken(token);
    return user?.role || 'USER';
  }

  /**
   * Authorization 헤더 생성
   */
  createAuthHeader(token: string): string {
    return `Bearer ${token}`;
  }

  /**
   * API 요청용 헤더 생성
   */
  createApiHeaders(token: string): Record<string, string> {
    return {
      Authorization: this.createAuthHeader(token),
      'Content-Type': 'application/json',
    };
  }

  /**
   * 토큰이 곧 만료되는지 확인 (5분 이내)
   */
  isTokenExpiringSoon(token: string, thresholdSeconds: number = 300): boolean {
    const remainingTime = this.getTokenRemainingTime(token);
    return remainingTime > 0 && remainingTime <= thresholdSeconds;
  }

  /**
   * 토큰 만료 시간 포맷팅
   */
  getTokenExpirationString(token: string): string | null {
    try {
      const payload = this.decodeJWTPayload(token);
      if (!payload || !payload.exp) {
        return null;
      }

      const expirationDate = new Date(payload.exp * 1000);
      return expirationDate.toLocaleString();
    } catch (error) {
      console.error('Failed to get token expiration string', { error });
      return null;
    }
  }

  /**
   * 토큰 발급 시간 포맷팅
   */
  getTokenIssuedAtString(token: string): string | null {
    try {
      const payload = this.decodeJWTPayload(token);
      if (!payload || !payload.iat) {
        return null;
      }

      const issuedDate = new Date(payload.iat * 1000);
      return issuedDate.toLocaleString();
    } catch (error) {
      console.error('Failed to get token issued at string', { error });
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance (기존 호환성 유지)
// ============================================================================

const defaultManager = new JWTClientManager();

export const getStoredTokens = () => defaultManager.getStoredTokens();
export const storeTokens = (
  accessToken: string,
  refreshToken: string,
  expiresIn?: number
) => defaultManager.storeTokens(accessToken, refreshToken, expiresIn);
export const clearStoredTokens = () => defaultManager.clearStoredTokens();
export const clearTokens = () => defaultManager.clearStoredTokens();
export const decodeJWTPayload = (token: string) =>
  defaultManager.decodeJWTPayload(token);
export const isTokenExpired = (token: string) =>
  defaultManager.isTokenExpired(token);
export const getTokenRemainingTime = (token: string) =>
  defaultManager.getTokenRemainingTime(token);
export const extractUserFromToken = (token: string) =>
  defaultManager.extractUserFromToken(token);
export const getUserRole = (token: string | null) =>
  defaultManager.getUserRole(token);
export const createAuthHeader = (token: string) =>
  defaultManager.createAuthHeader(token);
export const createApiHeaders = (token: string) =>
  defaultManager.createApiHeaders(token);
export const isTokenExpiringSoon = (token: string) =>
  defaultManager.isTokenExpiringSoon(token);
export const getTokenExpirationString = (token: string) =>
  defaultManager.getTokenExpirationString(token);
export const getTokenIssuedAtString = (token: string) =>
  defaultManager.getTokenIssuedAtString(token);
