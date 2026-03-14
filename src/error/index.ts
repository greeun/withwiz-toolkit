/**
 * 통합 에러 처리 시스템
 *
 * 모든 에러, 예외 상황을 통합 처리하는 중앙 집중식 시스템
 * 에러코드는 HTTP status를 확장한 5자리 형식 (XXXYY)
 * 사용자 UI에 표시할 문구는 프렌들리하게 제공 (다중 언어 지원)
 *
 * @example
 * // API 라우트에서 에러 발생
 * throw AppError.notFound('링크를 찾을 수 없습니다');
 *
 * // 프론트엔드에서 에러 표시
 * showFriendlyError(error, { locale: 'ko' });
 */

// 코어 에러 코드 및 상수
export * from "@withwiz/constants/error-codes";

// 다중 언어 메시지 시스템 (🆕 v2)
export * from "./messages";
export { LocaleDetector } from "./core/locale-detector";

// 에러 클래스 및 처리기
export * from "./app-error";
export * from "./error-handler";

// 친화적 메시지 (v2 우선 - 다중 언어 지원)
export {
  getFriendlyMessage,
  getErrorDisplayInfo,
  formatFriendlyError,
  type IFriendlyMessage,
  type IErrorDisplay,
} from "./friendly-messages-v2";

// 프론트엔드 에러 표시 유틸
export * from "./error-display";

// React 에러 바운더리
export * from "./ErrorBoundary";

// API 미들웨어 시스템 (🆕 Phase 2)
// export * from "./api"; // TODO: Implement API middleware system

