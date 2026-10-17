import { TokenGenerator } from '@withwiz/toolkit/core/auth/email/token-generator';
import type { EmailTokenRepository, TokenType } from '@withwiz/toolkit/core/auth/types';
import { AuthError } from '@withwiz/toolkit/core/auth/errors';
import { ERROR_CODES } from '@withwiz/toolkit/core/constants/error-codes';
import type { createAuthResponder } from '@withwiz/toolkit/next/auth-handlers/respond';

export type TokenEmailResolution =
  | { email: string }
  /** 요청에 email 이 없고 저장소가 토큰 조회를 지원하지 않는다 — 0.20 처럼 email 필수로 다룬다 */
  | { unsupported: true }
  /** 토큰에 해당하는 발급 행이 없다 */
  | { notFound: true };

/**
 * 요청의 email 을 쓰거나, 없으면 토큰 해시로 발급 대상 email 을 찾는다 (0.21+).
 * 해시 함수는 저장하는 쪽(`TokenGenerator.hash`)과 같은 것을 쓴다. 만료 검사는 서비스가 한다.
 */
export async function resolveTokenEmail(
  repository: EmailTokenRepository,
  email: string | undefined,
  token: string,
  type: TokenType,
): Promise<TokenEmailResolution> {
  if (email) return { email };
  if (!repository.findEmailByToken) return { unsupported: true };
  const found = await repository.findEmailByToken(TokenGenerator.hash(token), type);
  return found ? { email: found } : { notFound: true };
}

/**
 * 메일 링크 토큰 오류 응답. 토큰을 찾지 못한 경우와 서비스가 `TOKEN_INVALID` 를 던진 경우를 같은 key 로 묶는다.
 * key 는 서비스와 같은 `TOKEN_INVALID`, 사용자 문구는 `LINK_INVALID`(40008) 사전 항목이다 —
 * `TOKEN_INVALID` 의 일반 매핑(40102)은 로그인 세션 문구라 메일 링크에 맞지 않는다.
 * legacy 본문은 0.20 과 같다(`{ success: false, error: message }`, 400).
 */
export function linkTokenError(respond: ReturnType<typeof createAuthResponder>, request: Request, message: string) {
  return respond.error(request, { status: 400, key: 'TOKEN_INVALID', code: ERROR_CODES.LINK_INVALID.code, message });
}

/** 서비스가 던진 메일 링크 토큰 오류인지 */
export function isLinkTokenError(error: unknown): error is AuthError {
  return error instanceof AuthError && error.code === 'TOKEN_INVALID' && error.statusCode === 400;
}
