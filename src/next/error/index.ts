/**
 * 에러 처리 — Next.js 의존 항목
 *
 * NextResponse/NextRequest 변환, ErrorBoundary(next/link), 로케일 감지.
 * 프레임워크 독립 항목은 @withwiz/toolkit/core/error 참조.
 */

export * from "@withwiz/toolkit/next/error/error-handler";
export { LocaleDetector } from "@withwiz/toolkit/next/error/locale-detector";
export * from "@withwiz/toolkit/next/error/ErrorBoundary";
