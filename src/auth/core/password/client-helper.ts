/**
 * Shared Auth - Password Client Helper
 *
 * 클라이언트 사이드용 비밀번호 검증 헬퍼 (프레임워크 독립적)
 */

import { PasswordValidator, PasswordHasher } from './index';
import type { PasswordConfig } from '@withwiz/auth/types';
import type { z } from 'zod';

/**
 * 기본 비밀번호 설정
 */
export const DEFAULT_PASSWORD_CONFIG: PasswordConfig = {
  minLength: 8,
  maxLength: 128,
  requireNumber: true,
  requireUppercase: true,
  requireLowercase: true,
  requireSpecialChar: true,
  bcryptRounds: 12,
};

/**
 * 클라이언트용 비밀번호 검증기 인스턴스 생성
 */
export function createPasswordValidator(config?: Partial<PasswordConfig>): PasswordValidator {
  const fullConfig = { ...DEFAULT_PASSWORD_CONFIG, ...config };
  return new PasswordValidator(fullConfig);
}

/**
 * 비밀번호 검증 헬퍼 함수 (간편 사용)
 */
export function validatePassword(password: string, config?: Partial<PasswordConfig>) {
  const validator = createPasswordValidator(config);
  return validator.validate(password);
}

/**
 * 비밀번호 강도 계산 헬퍼 함수
 */
export function getPasswordStrength(password: string, config?: Partial<PasswordConfig>) {
  const validator = createPasswordValidator(config);
  return validator.calculateStrength(password);
}

/**
 * Zod 스키마 생성 헬퍼 함수
 */
export function createPasswordSchema(config?: Partial<PasswordConfig>): z.ZodString {
  const validator = createPasswordValidator(config);
  return validator.createZodSchema();
}

/**
 * 기본 Zod 스키마 (기존 defaultPasswordSchema와 호환)
 */
export const defaultPasswordSchema = createPasswordSchema(DEFAULT_PASSWORD_CONFIG);

/**
 * 싱글톤 인스턴스 (기존 PasswordValidator 정적 메서드 대체)
 */
export const passwordValidator = createPasswordValidator(DEFAULT_PASSWORD_CONFIG);

/**
 * 비밀번호 해싱 인스턴스 (브라우저에서는 사용하지 말 것!)
 * ⚠️ WARNING: 해싱은 서버 사이드에서만 수행해야 합니다.
 */
export function createPasswordHasher(rounds: number = 12): PasswordHasher {
  if (typeof window !== 'undefined') {
    console.warn('⚠️ WARNING: Password hashing should only be done on the server!');
  }
  return new PasswordHasher(rounds);
}

// ============================================================================
// Re-exports
// ============================================================================

export { PasswordValidator, PasswordHasher } from './index';
export type { PasswordValidationResult } from './index';
export type { PasswordConfig, PasswordStrength } from '@withwiz/auth/types';
