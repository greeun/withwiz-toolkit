/**
 * 유틸리티 — Next.js 의존 항목
 *
 * NextResponse/NextRequest 의존 헬퍼들.
 */

export {
  ErrorProcessor,
  withErrorHandling,
  handlePrismaError,
  throwBusinessRuleError,
  throwNotFoundError,
  throwConflictError,
  throwForbiddenError,
  throwUnauthorizedError,
  throwValidationError,
  throwBadRequestError,
  processError,
  errorToResponse,
} from '@withwiz/toolkit/next/utils/error-processor';
export type { IErrorHandlerOptions, ProcessedError } from '@withwiz/toolkit/next/utils/error-processor';

export * from '@withwiz/toolkit/next/utils/csv-export';
// './csv-export-format'은 date-fns peer 가 깔린 호스트만 명시 경로로 import:
//   import { customDateFormatter } from '@withwiz/toolkit/next/utils/csv-export-format'
export * from '@withwiz/toolkit/next/utils/cors';
export * from '@withwiz/toolkit/next/utils/api-helpers';
