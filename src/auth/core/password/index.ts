/**
 * Shared Auth - Password Module
 *
 * 비밀번호 검증 및 강도 측정 모듈 (프레임워크 독립적)
 */

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { PasswordConfig } from '@withwiz/auth/types';
import { PasswordStrength, type PasswordValidationResult as BasePasswordValidationResult } from '@withwiz/auth/types';

// ============================================================================
// Types
// ============================================================================

export interface PasswordValidationResult extends BasePasswordValidationResult {
  score: number;
}

// ============================================================================
// Password Validator Class
// ============================================================================

export class PasswordValidator {
  private config: PasswordConfig;
  private static readonly SPECIAL_CHARS =
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

  constructor(config: PasswordConfig) {
    this.config = config;
  }

  /**
   * 비밀번호 유효성 검사
   */
  validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // 길이 검사
    if (password.length < this.config.minLength) {
      errors.push(
        `Password must be at least ${this.config.minLength} characters long`
      );
    }

    if (password.length > this.config.maxLength) {
      errors.push(
        `Password cannot exceed ${this.config.maxLength} characters`
      );
    }

    // 숫자 포함 검사
    if (this.config.requireNumber && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // 대문자 포함 검사
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // 소문자 포함 검사
    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // 특수문자 포함 검사
    if (
      this.config.requireSpecialChar &&
      !PasswordValidator.SPECIAL_CHARS.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    // 비밀번호 강도 및 점수 계산
    const strength = this.calculateStrength(password);
    const score = this.calculateScore(password);

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score,
    };
  }

  /**
   * 비밀번호 확인 검증
   */
  validateConfirmation(
    password: string,
    confirmPassword: string
  ): PasswordValidationResult {
    const errors: string[] = [];

    if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: PasswordStrength.WEAK,
      score: 0,
    };
  }

  /**
   * 비밀번호 강도 계산
   */
  calculateStrength(password: string): PasswordStrength {
    const score = this.calculateScore(password);

    if (score < 20) return PasswordStrength.VERY_WEAK;
    if (score < 40) return PasswordStrength.WEAK;
    if (score < 60) return PasswordStrength.MEDIUM;
    if (score < 80) return PasswordStrength.STRONG;
    return PasswordStrength.VERY_STRONG;
  }

  /**
   * 비밀번호 점수 계산 (0-100)
   */
  private calculateScore(password: string): number {
    let score = 0;

    // 길이 점수 (최대 25점)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 5;

    // 문자 종류 점수 (최대 40점)
    if (/[a-z]/.test(password)) score += 10; // 소문자
    if (/[A-Z]/.test(password)) score += 10; // 대문자
    if (/\d/.test(password)) score += 10; // 숫자
    if (PasswordValidator.SPECIAL_CHARS.test(password)) score += 10; // 특수문자

    // 복잡성 점수 (최대 35점)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 20; // 고유 문자 비율
    if (password.length >= 12 && uniqueChars >= 8) score += 15; // 길이와 다양성

    return Math.min(score, 100);
  }

  /**
   * Zod 스키마 생성
   */
  createZodSchema(): z.ZodString {
    let schema = z
      .string()
      .min(
        this.config.minLength,
        `Password must be at least ${this.config.minLength} characters long`
      )
      .max(
        this.config.maxLength,
        `Password cannot exceed ${this.config.maxLength} characters`
      );

    // 숫자 포함 검사
    if (this.config.requireNumber) {
      schema = schema.regex(
        /\d/,
        'Password must contain at least one number'
      );
    }

    // 대문자 포함 검사
    if (this.config.requireUppercase) {
      schema = schema.regex(
        /[A-Z]/,
        'Password must contain at least one uppercase letter'
      );
    }

    // 소문자 포함 검사
    if (this.config.requireLowercase) {
      schema = schema.regex(
        /[a-z]/,
        'Password must contain at least one lowercase letter'
      );
    }

    // 특수문자 포함 검사
    if (this.config.requireSpecialChar) {
      schema = schema.regex(
        PasswordValidator.SPECIAL_CHARS,
        'Password must contain at least one special character'
      );
    }

    return schema;
  }

  /**
   * 비밀번호 힌트 생성
   */
  generateHint(password: string): string[] {
    const hints: string[] = [];

    if (password.length < this.config.minLength) {
      hints.push(`Enter at least ${this.config.minLength} characters`);
    }

    if (this.config.requireNumber && !/\d/.test(password)) {
      hints.push('Include numbers');
    }

    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      hints.push('Include uppercase letters');
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      hints.push('Include lowercase letters');
    }

    if (
      this.config.requireSpecialChar &&
      !PasswordValidator.SPECIAL_CHARS.test(password)
    ) {
      hints.push('Include special characters');
    }

    return hints;
  }

  /**
   * 비밀번호 강도 메시지 반환
   */
  static getStrengthMessage(strength: PasswordStrength): string {
    switch (strength) {
      case PasswordStrength.VERY_WEAK:
        return 'Very Weak';
      case PasswordStrength.WEAK:
        return 'Weak';
      case PasswordStrength.MEDIUM:
        return 'Medium';
      case PasswordStrength.STRONG:
        return 'Strong';
      case PasswordStrength.VERY_STRONG:
        return 'Very Strong';
      default:
        return 'Unknown';
    }
  }

  /**
   * 비밀번호 강도 색상 반환 (Tailwind CSS)
   */
  static getStrengthColor(strength: PasswordStrength): string {
    switch (strength) {
      case PasswordStrength.VERY_WEAK:
        return 'text-red-600';
      case PasswordStrength.WEAK:
        return 'text-orange-600';
      case PasswordStrength.MEDIUM:
        return 'text-yellow-600';
      case PasswordStrength.STRONG:
        return 'text-blue-600';
      case PasswordStrength.VERY_STRONG:
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  }
}

// ============================================================================
// Password Hashing Utilities
// ============================================================================

export class PasswordHasher {
  private rounds: number;

  constructor(rounds: number = 12) {
    this.rounds = rounds;
  }

  /**
   * 비밀번호 해싱
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  /**
   * 비밀번호 검증
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

// ============================================================================
// Default Password Schemas (for backward compatibility)
// ============================================================================

/**
 * 기본 비밀번호 스키마 (기존 코드 호환성)
 * 최소 8자, 숫자 포함
 */
export const defaultPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/\d/, 'Password must contain at least one number');

/**
 * 강력한 비밀번호 스키마 (기존 코드 호환성)
 * 최소 12자, 대소문자, 숫자, 특수문자 포함
 */
export const strongPasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/,
    'Password must contain at least one special character'
  );

// Export types
export type { PasswordConfig, PasswordStrength } from '@withwiz/auth/types';
