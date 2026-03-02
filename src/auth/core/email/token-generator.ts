/**
 * Shared Auth - Email Token Generator
 *
 * 이메일 인증용 토큰 생성 유틸리티 (프레임워크 독립적)
 * crypto 모듈 기반
 */

import crypto from 'crypto';

// ============================================================================
// Token Generator
// ============================================================================

export class TokenGenerator {
  /**
   * 안전한 랜덤 토큰 생성
   *
   * @param bytes - 바이트 수 (기본: 32)
   * @returns 16진수 문자열 토큰
   */
  static generate(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * URL-safe 토큰 생성 (Base64URL)
   *
   * @param bytes - 바이트 수 (기본: 32)
   * @returns URL-safe 토큰
   */
  static generateUrlSafe(bytes: number = 32): string {
    return crypto
      .randomBytes(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * 숫자 PIN 코드 생성
   *
   * @param length - PIN 길이 (기본: 6)
   * @returns 숫자 PIN 코드
   */
  static generatePIN(length: number = 6): string {
    const max = Math.pow(10, length);
    const pin = crypto.randomInt(0, max);
    return pin.toString().padStart(length, '0');
  }

  /**
   * 만료 시간 계산
   *
   * @param milliseconds - 만료까지의 밀리초
   * @returns 만료 Date 객체
   */
  static calculateExpiry(milliseconds: number): Date {
    return new Date(Date.now() + milliseconds);
  }

  /**
   * 토큰이 만료되었는지 확인
   *
   * @param expiryDate - 만료 Date
   * @returns 만료 여부
   */
  static isExpired(expiryDate: Date): boolean {
    return new Date() > expiryDate;
  }
}
