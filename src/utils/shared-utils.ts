/**
 * shared-utils (범용 유틸리티)
 *
 * 이 파일은 프로젝트 독립적인 범용 유틸리티만 포함합니다.
 * URL shortener 비즈니스 로직은 <your-project>/utils/ 에 위치합니다.
 *
 * @see <your-project>/utils/alias-validation.ts - Alias 검증 관련 함수
 */

// GeoIP 관련 타입들은 database.d.ts로 이동
import type { IGeoLocationData, IGeoIPResponse } from '@withwiz/types/database';

// 타입 재내보내기 (기존 호환성 유지)
export type { IGeoLocationData, IGeoIPResponse };

// URL 정규화 유틸리티 재내보내기
export * from './url-normalizer';

// 숫자 포맷팅 유틸리티 재내보내기
export * from './format-number';

// 단축코드 생성 유틸리티 재내보내기
export * from './short-code-generator';

// ============================================================================
// 범용 에러 메시지 생성 헬퍼
// ============================================================================

/**
 * 에러 메시지 생성 (템플릿 변수 치환)
 *
 * @param code - 에러 코드
 * @param message - 에러 메시지 템플릿
 * @param replacements - 치환할 변수들
 * @returns 에러 객체
 */
export function createValidationError(
  code: string,
  message: string,
  replacements: Record<string, string> = {}
): { code: string; message: string } {
  let finalMessage = message;

  Object.entries(replacements).forEach(([key, value]) => {
    finalMessage = finalMessage.replace(`{${key}}`, value);
  });

  return { code, message: finalMessage };
}

