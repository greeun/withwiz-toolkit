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
   * 토큰의 SHA-256 해시 (저장용)
   *
   * 이메일/URL 로 전달되는 평문 토큰을 DB 에 그대로 저장하지 않기 위해 사용한다.
   * 저장·조회 시 이 해시값으로 비교하면 DB 유출 시에도 토큰을 복원할 수 없다.
   * (토큰 자체가 고엔트로피 랜덤이므로 salt 없이 단방향 해시로 충분하다.)
   *
   * @param token - 평문 토큰
   * @returns 64글자 hex SHA-256 다이제스트
   */
  static hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
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
