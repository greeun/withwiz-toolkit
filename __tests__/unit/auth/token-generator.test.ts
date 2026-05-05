/**
 * TokenGenerator Unit Tests
 *
 * crypto 기반 토큰 생성 유틸리티 테스트
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenGenerator } from '../../../src/auth/core/email/token-generator';

describe('TokenGenerator', () => {
  describe('generate', () => {
    it('기본 32바이트 hex 문자열을 반환해야 한다 (64글자)', () => {
      const token = TokenGenerator.generate();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('커스텀 바이트 수로 hex 문자열을 생성해야 한다', () => {
      const token16 = TokenGenerator.generate(16);
      const token64 = TokenGenerator.generate(64);

      expect(token16).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token64).toHaveLength(128); // 64 bytes = 128 hex chars
    });

    it('매번 다른 토큰을 생성해야 한다', () => {
      const token1 = TokenGenerator.generate();
      const token2 = TokenGenerator.generate();

      expect(token1).not.toBe(token2);
    });
  });

  describe('generateUrlSafe', () => {
    it('URL-safe 문자만 포함해야 한다 (+, /, = 없음)', () => {
      // 여러 번 생성하여 특수 문자가 없는지 검증
      for (let i = 0; i < 20; i++) {
        const token = TokenGenerator.generateUrlSafe();
        expect(token).not.toContain('+');
        expect(token).not.toContain('/');
        expect(token).not.toContain('=');
      }
    });

    it('기본 32바이트로 약 43글자의 문자열을 생성해야 한다', () => {
      const token = TokenGenerator.generateUrlSafe();
      // base64 of 32 bytes = ceil(32*4/3) = 43 chars (without padding)
      expect(token.length).toBeGreaterThanOrEqual(40);
      expect(token.length).toBeLessThanOrEqual(44);
    });

    it('커스텀 바이트 수로 URL-safe 토큰을 생성해야 한다', () => {
      const token = TokenGenerator.generateUrlSafe(16);
      // base64 of 16 bytes = ceil(16*4/3) = ~22 chars
      expect(token.length).toBeGreaterThanOrEqual(20);
      expect(token.length).toBeLessThanOrEqual(24);
    });

    it('매번 다른 토큰을 생성해야 한다', () => {
      const token1 = TokenGenerator.generateUrlSafe();
      const token2 = TokenGenerator.generateUrlSafe();

      expect(token1).not.toBe(token2);
    });
  });

  describe('generatePIN', () => {
    it('기본 6자리 숫자 문자열을 반환해야 한다', () => {
      const pin = TokenGenerator.generatePIN();

      expect(pin).toHaveLength(6);
      expect(pin).toMatch(/^\d{6}$/);
    });

    it('커스텀 길이의 PIN을 생성해야 한다', () => {
      const pin4 = TokenGenerator.generatePIN(4);
      const pin8 = TokenGenerator.generatePIN(8);

      expect(pin4).toHaveLength(4);
      expect(pin4).toMatch(/^\d{4}$/);
      expect(pin8).toHaveLength(8);
      expect(pin8).toMatch(/^\d{8}$/);
    });

    it('앞에 0으로 패딩되어야 한다', () => {
      // 실제 0으로 시작하는 경우를 위해 많이 생성
      // 직접 검증: padStart가 적용되는지 확인
      const pin = TokenGenerator.generatePIN(6);
      expect(pin).toHaveLength(6);
      // PIN은 숫자 형태여야 함
      expect(Number(pin)).toBeGreaterThanOrEqual(0);
      expect(Number(pin)).toBeLessThan(1000000);
    });

    it('항상 문자열을 반환해야 한다', () => {
      const pin = TokenGenerator.generatePIN();
      expect(typeof pin).toBe('string');
    });
  });

  describe('calculateExpiry', () => {
    it('현재 시간에서 지정된 밀리초 후의 Date를 반환해야 한다', () => {
      const now = Date.now();
      const oneHourMs = 3600000;

      const expiry = TokenGenerator.calculateExpiry(oneHourMs);

      // 약간의 실행 시간 오차 허용 (10ms)
      expect(expiry.getTime()).toBeGreaterThanOrEqual(now + oneHourMs);
      expect(expiry.getTime()).toBeLessThanOrEqual(now + oneHourMs + 10);
    });

    it('Date 객체를 반환해야 한다', () => {
      const expiry = TokenGenerator.calculateExpiry(60000);
      expect(expiry).toBeInstanceOf(Date);
    });

    it('미래 시간을 반환해야 한다', () => {
      const expiry = TokenGenerator.calculateExpiry(1000);
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('isExpired', () => {
    it('미래 날짜면 false를 반환해야 한다', () => {
      const futureDate = new Date(Date.now() + 3600000);

      expect(TokenGenerator.isExpired(futureDate)).toBe(false);
    });

    it('과거 날짜면 true를 반환해야 한다', () => {
      const pastDate = new Date(Date.now() - 3600000);

      expect(TokenGenerator.isExpired(pastDate)).toBe(true);
    });

    it('아주 먼 과거 날짜도 true를 반환해야 한다', () => {
      const veryOld = new Date('2000-01-01');

      expect(TokenGenerator.isExpired(veryOld)).toBe(true);
    });

    it('아주 먼 미래 날짜는 false를 반환해야 한다', () => {
      const veryFuture = new Date('2099-12-31');

      expect(TokenGenerator.isExpired(veryFuture)).toBe(false);
    });
  });
});
