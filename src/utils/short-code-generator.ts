/**
 * 단축 코드 생성 전용 유틸리티
 * 순수 함수로 구현하여 외부 의존성 없음
 */

/**
 * 기본 단축 코드 생성 함수
 * @param length - 생성할 코드 길이 (기본값: 8)
 * @returns 생성된 단축 코드
 */
export function generateShortCode(length: number = 8): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('length must be a positive integer');
  }
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * 단축 코드 생성 옵션 인터페이스
 */
export interface IShortCodeOptions {
  length?: number;
  maxAttempts?: number;
  checkDuplicate?: (code: string) => Promise<boolean> | boolean;
}

/**
 * 중복 검사와 함께 고유한 단축 코드 생성
 * @param options - 생성 옵션
 * @returns 고유한 단축 코드
 */
export async function generateUniqueShortCode(
  options: IShortCodeOptions = {}
): Promise<string> {
  const {
    length = 8,
    maxAttempts = 100,
    checkDuplicate
  } = options;

  let shortCode: string;
  let attempts = 0;

  do {
    shortCode = generateShortCode(length);
    attempts++;
    
    // 중복 검사가 제공된 경우에만 실행
    if (checkDuplicate) {
      const isDuplicate = await checkDuplicate(shortCode);
      if (!isDuplicate) break;
    } else {
      // 중복 검사가 없으면 첫 번째 생성된 코드 반환
      break;
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique shortCode after multiple attempts');
    }
  } while (true);

  return shortCode;
}
