/**
 * 통합 에러 처리 시스템 — Core tier
 *
 * 프레임워크 독립적인 에러 클래스/코드/메시지.
 * Next.js 의존 항목은 @withwiz/toolkit/next/error,
 * React 의존 항목은 @withwiz/toolkit/react/error 참조.
 */

// 에러 코드 및 상수
export * from "@withwiz/toolkit/core/constants/error-codes";

// 다중 언어 메시지 시스템
export * from "@withwiz/toolkit/core/error/messages";

// 에러 클래스
export * from "@withwiz/toolkit/core/error/app-error";

// 에러 정보 추출 (프레임워크 독립)
export * from "@withwiz/toolkit/core/error/extract-error-info";

// 친화적 메시지 (v2 - 다중 언어 지원)
export {
  getFriendlyMessage,
  getErrorDisplayInfo,
  formatFriendlyError,
  type IFriendlyMessage,
  type IErrorDisplay,
} from "@withwiz/toolkit/core/error/friendly-messages-v2";
