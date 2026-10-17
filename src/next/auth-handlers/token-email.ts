import { TokenGenerator } from '@withwiz/toolkit/core/auth/email/token-generator';
import type { EmailTokenRepository, TokenType } from '@withwiz/toolkit/core/auth/types';

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
