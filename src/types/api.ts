/**
 * API 응답 타입 정의
 *
 * 통합 에러 시스템에서 사용하는 API 응답 형식
 */

/**
 * 표준 API 응답 인터페이스
 *
 * @template T - 응답 데이터 타입
 *
 * @example
 * ```typescript
 * // 성공 응답
 * const response: IApiResponse<User> = {
 *   success: true,
 *   data: { id: '1', email: 'user@example.com' }
 * };
 *
 * // 에러 응답
 * const errorResponse: IApiResponse = {
 *   success: false,
 *   error: {
 *     code: 40401,
 *     message: '리소스를 찾을 수 없습니다.'
 *   }
 * };
 * ```
 */
export interface IApiResponse<T = any> {
  /**
   * 요청 성공 여부
   * - true: 성공 (data 필드 포함)
   * - false: 실패 (error 필드 포함)
   */
  success: boolean;

  /**
   * 응답 데이터 (성공 시)
   */
  data?: T;

  /**
   * 에러 정보 (실패 시)
   */
  error?: {
    /**
     * 5자리 HTTP 확장 에러 코드
     * - XXX: HTTP 상태 코드
     * - YY: 세부 순번
     */
    code: number;

    /**
     * 내부 개발용 상세 메시지
     */
    message: string;

    /**
     * 사용자용 다국어 메시지 (서버에서 번역되어 전달됨)
     */
    userMessage?: {
      title?: string;
      description: string;
      action?: string;
    };

    /**
     * 요청 식별을 위한 ID
     */
    requestId?: string;

    /**
     * 상세 에러 정보 (옵셔널)
     * - 검증 에러의 경우 issues 배열 포함
     * - 개발 환경에서만 표시되는 추가 정보
     */
    details?: any;
  };

  /**
   * 메타데이터 (옵셔널)
   * - 페이지네이션 정보
   * - 캐시 정보
   * - 기타 메타데이터
   */
  meta?: any;
}
