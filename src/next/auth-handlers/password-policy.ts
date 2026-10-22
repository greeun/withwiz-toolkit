import { z } from 'zod';
import { createPasswordValidator } from '@withwiz/toolkit/core/auth/password/client-helper';
import { LocaleDetector } from '@withwiz/toolkit/next/error/locale-detector';
import type { NextRequest } from 'next/server';
import type { PasswordPolicy, PasswordPolicyResult } from '@withwiz/toolkit/next/auth-types/handler-types';
import type { createAuthResponder } from '@withwiz/toolkit/next/auth-handlers/respond';
import type { TLocale } from '@withwiz/toolkit/core/error/messages/types';
import { BYTE_LIMIT_MESSAGES, BYTE_LIMIT_REASON } from '@withwiz/toolkit/next/auth-handlers/field-messages';

// bcrypt 는 72바이트 초과분을 조용히 절단하므로 검증 단계에서 거부 (바이트 수 기준)
const withinBcryptByteLimit = (value: string): boolean => new TextEncoder().encode(value).length <= 72;

/**
 * 비밀번호 필드 스키마. 정책이 없으면 0.20 과 같은 `min(8)` + 72바이트 제한(zod 실패 = `Invalid input`).
 * 정책이 있으면 최소 길이는 정책이 정하고, 72바이트 제한은 `checkPasswordPolicy` 가 요청 로케일 문구로 판정한다
 * — 스키마에서 거부하면 사유가 영어 zod 문구로 필드 오류에 실려 화면에 그대로 나간다(0.21.0 결함).
 * 정책이 없을 때의 refine 사유는 `params.reason` 으로 표시해 standard 의 fieldErrors 에서 로케일 문구로 바뀐다.
 */
export function passwordField(policy: PasswordPolicy | undefined) {
  if (policy) return z.string().min(1);
  return z.string().min(8).refine(withinBcryptByteLimit, {
    message: 'Password cannot exceed 72 bytes',
    params: { reason: BYTE_LIMIT_REASON },
  });
}

const DEFAULT_POLICY_MESSAGE = 'Password does not meet the policy';

/**
 * 정책 검사. 정책이 없으면 통과(72바이트 제한은 그때 스키마가 맡는다).
 * 설정형 정책의 사유는 `PasswordValidator` 의 영어 문구다 — 요청 로케일 문구가 필요하면 함수형 정책을 쓴다.
 *
 * 정책이 있으면 정책을 먼저 보고, 통과한 경우에만 72바이트 제한을 본다. 소비자 정책이 길이 상한을 직접 판정하면
 * 그 문구가 우선한다.
 */
export async function checkPasswordPolicy(
  policy: PasswordPolicy | undefined,
  password: string,
  purpose: 'register' | 'reset',
  request: NextRequest,
  /** 정책 문구 로케일 (0.25+, 핸들러의 `locale` 옵션). 미지정이면 요청에서 감지 */
  locale: TLocale = LocaleDetector.detectServer(request),
): Promise<PasswordPolicyResult> {
  if (!policy) return { ok: true };
  const result = await runPolicy(policy, password, purpose, locale);
  if (!result.ok) return result;
  return withinBcryptByteLimit(password) ? { ok: true } : { ok: false, message: BYTE_LIMIT_MESSAGES[locale] ?? BYTE_LIMIT_MESSAGES.en };
}

async function runPolicy(
  policy: PasswordPolicy,
  password: string,
  purpose: 'register' | 'reset',
  locale: TLocale,
): Promise<PasswordPolicyResult> {
  if (typeof policy === 'function') {
    const result = await policy(password, { purpose, locale });
    // 사유 없이 실패만 돌려준 정책(타입 검사를 거치지 않은 JS 등)도 응답에 사유가 실리게 한다
    return result.ok ? result : { ok: false, message: result.message || DEFAULT_POLICY_MESSAGE };
  }
  const result = createPasswordValidator(policy).validate(password);
  return result.isValid ? { ok: true } : { ok: false, message: result.errors[0] ?? DEFAULT_POLICY_MESSAGE };
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
