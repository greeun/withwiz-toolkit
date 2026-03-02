/**
 * Password Validator
 *
 * 범용 비밀번호 유효성 검사 모듈
 * 프로젝트 독립적인 비밀번호 검증 기능을 제공합니다.
 */
import { z } from 'zod';

/**
 * 비밀번호 검증 결과 인터페이스
 */
export interface IPasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: PasswordStrength;
  score: number;
}

/**
 * 비밀번호 강도 레벨
 */
export enum PasswordStrength {
  VERY_WEAK = 'very_weak',
  WEAK = 'weak',
  MEDIUM = 'medium',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong'
}

/**
 * 비밀번호 검증 옵션
 */
export interface IPasswordValidationOptions {
  minLength?: number;
  maxLength?: number;
  requireNumber?: boolean;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireSpecialChar?: boolean;
  customPattern?: RegExp;
  customMessage?: string;
}

/**
 * 중앙화된 비밀번호 검증 클래스
 */
export class PasswordValidator {
  // 기본 설정
  private static readonly DEFAULT_OPTIONS: Required<IPasswordValidationOptions> = {
    minLength: 8,
    maxLength: 128,
    requireNumber: true,
    requireUppercase: false,
    requireLowercase: false,
    requireSpecialChar: false,
    customPattern: /^(?=.*\d)/,
    customMessage: 'Password must contain at least one number'
  };

  // 특수문자 패턴
  private static readonly SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

  /**
   * 비밀번호 유효성 검사
   */
  static validate(password: string, options: Partial<IPasswordValidationOptions> = {}): IPasswordValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];

    // 길이 검사
    if (password.length < opts.minLength) {
      errors.push(`Password must be at least ${opts.minLength} characters long`);
    }

    if (password.length > opts.maxLength) {
      errors.push(`Password cannot exceed ${opts.maxLength} characters`);
    }

    // 숫자 포함 검사
    if (opts.requireNumber && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // 대문자 포함 검사
    if (opts.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // 소문자 포함 검사
    if (opts.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // 특수문자 포함 검사
    if (opts.requireSpecialChar && !this.SPECIAL_CHARS.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // 커스텀 패턴 검사
    if (opts.customPattern && !opts.customPattern.test(password)) {
      errors.push(opts.customMessage);
    }

    // 비밀번호 강도 계산
    const strength = this.calculateStrength(password);
    const score = this.calculateScore(password);

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score
    };
  }

  /**
   * 비밀번호 강도 계산
   */
  private static calculateStrength(password: string): PasswordStrength {
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
  private static calculateScore(password: string): number {
    let score = 0;

    // 길이 점수 (최대 25점)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 5;

    // 문자 종류 점수 (최대 50점)
    if (/[a-z]/.test(password)) score += 10; // 소문자
    if (/[A-Z]/.test(password)) score += 10; // 대문자
    if (/\d/.test(password)) score += 10;   // 숫자
    if (this.SPECIAL_CHARS.test(password)) score += 10; // 특수문자

    // 복잡성 점수 (최대 25점)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 15; // 고유 문자 비율
    if (password.length >= 12 && uniqueChars >= 8) score += 10; // 길이와 다양성

    return Math.min(score, 100);
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
   * 비밀번호 강도 색상 반환
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

  /**
   * Zod 스키마 생성
   */
  static createZodSchema(options: Partial<IPasswordValidationOptions> = {}): z.ZodString {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    let schema = z.string()
      .min(opts.minLength, `Password must be at least ${opts.minLength} characters long`)
      .max(opts.maxLength, `Password cannot exceed ${opts.maxLength} characters`);

    // 숫자 포함 검사
    if (opts.requireNumber) {
      schema = schema.regex(/\d/, 'Password must contain at least one number');
    }

    // 대문자 포함 검사
    if (opts.requireUppercase) {
      schema = schema.regex(/[A-Z]/, 'Password must contain at least one uppercase letter');
    }

    // 소문자 포함 검사
    if (opts.requireLowercase) {
      schema = schema.regex(/[a-z]/, 'Password must contain at least one lowercase letter');
    }

    // 특수문자 포함 검사
    if (opts.requireSpecialChar) {
      schema = schema.regex(this.SPECIAL_CHARS, 'Password must contain at least one special character');
    }

    // 커스텀 패턴 검사
    if (opts.customPattern) {
      schema = schema.regex(opts.customPattern, opts.customMessage);
    }

    return schema;
  }

  /**
   * 비밀번호 확인 검증
   */
  static validateConfirmation(password: string, confirmPassword: string): IPasswordValidationResult {
    const errors: string[] = [];

    if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: PasswordStrength.WEAK,
      score: 0
    };
  }

  /**
   * 비밀번호 힌트 생성
   */
  static generateHint(password: string): string[] {
    const hints: string[] = [];

    if (password.length < 8) {
      hints.push('Enter at least 8 characters');
    }

    if (!/\d/.test(password)) {
      hints.push('Include numbers');
    }

    if (!/[A-Z]/.test(password)) {
      hints.push('Include uppercase letters');
    }

    if (!/[a-z]/.test(password)) {
      hints.push('Include lowercase letters');
    }

    if (!this.SPECIAL_CHARS.test(password)) {
      hints.push('Include special characters');
    }

    return hints;
  }
}

/**
 * 기본 비밀번호 스키마
 */
export const defaultPasswordSchema = PasswordValidator.createZodSchema({
  minLength: 8,
  maxLength: 128,
  requireNumber: true,
  requireUppercase: false,
  requireLowercase: false,
  requireSpecialChar: false
});

/**
 * 강화된 비밀번호 스키마
 */
export const strongPasswordSchema = PasswordValidator.createZodSchema({
  minLength: 12,
  maxLength: 128,
  requireNumber: true,
  requireUppercase: true,
  requireLowercase: true,
  requireSpecialChar: true
});
