import { z } from 'zod';
import { createPasswordValidator } from '@withwiz/toolkit/core/auth/password/client-helper';
import { LocaleDetector } from '@withwiz/toolkit/next/error/locale-detector';
import type { NextRequest } from 'next/server';
import type { PasswordPolicy, PasswordPolicyResult } from '@withwiz/toolkit/next/auth-types/handler-types';
import type { createAuthResponder } from '@withwiz/toolkit/next/auth-handlers/respond';

// bcrypt 는 72바이트 초과분을 조용히 절단하므로 검증 단계에서 거부 (바이트 수 기준)
const withinBcryptByteLimit = (value: string): boolean => new TextEncoder().encode(value).length <= 72;

/**
 * 비밀번호 필드 스키마. 정책이 없으면 0.20 과 같은 `min(8)`, 정책이 있으면 최소 길이는 정책이 정한다.
 * 72바이트 제한은 어느 경우든 적용한다.
 */
export function passwordField(policy: PasswordPolicy | undefined) {
  return (policy ? z.string().min(1) : z.string().min(8)).refine(withinBcryptByteLimit, {
    message: 'Password cannot exceed 72 bytes',
  });
}

/** 정책 검사. 정책이 없으면 통과 */
export async function checkPasswordPolicy(
  policy: PasswordPolicy | undefined,
  password: string,
  purpose: 'register' | 'reset',
  request: NextRequest,
): Promise<PasswordPolicyResult> {
  if (!policy) return { ok: true };
  if (typeof policy === 'function') {
    return policy(password, { purpose, locale: LocaleDetector.detectServer(request) });
  }
  const result = createPasswordValidator(policy).validate(password);
  return result.isValid ? { ok: true } : { ok: false, message: result.errors[0] ?? 'Password does not meet the policy' };
}

/**
 * 정책 위반 응답. legacy 에서도 사유가 화면에 나오도록 문자열 `error` 에 사유를 싣고,
 * 필드 오류를 읽는 소비자를 위해 `details.fieldErrors` 도 함께 싣는다.
 */
export function passwordPolicyViolation(
  respond: ReturnType<typeof createAuthResponder>,
  request: NextRequest,
  message: string,
) {
  const fieldErrors = { password: [message] };
  return respond.error(request, {
    status: 400,
    key: 'PASSWORD_TOO_WEAK',
    message,
    userMessage: message,
    fieldErrors,
    legacyCode: 'PASSWORD_TOO_WEAK',
    legacyDetails: { formErrors: [], fieldErrors },
  });
}
