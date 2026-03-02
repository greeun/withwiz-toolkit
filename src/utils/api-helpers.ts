/**
 * API Helper Functions
 *
 * 범용 API 헬퍼 유틸리티
 * 프로젝트 독립적인 재사용 가능한 함수들
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { ERROR_CODES, formatErrorMessage } from '@withwiz/constants/error-codes';

/**
 * Zod 스키마로 데이터 검증
 *
 * @example
 * ```typescript
 * const validation = validateAndParse(linkSchema, await req.json());
 * if (!validation.success) return validation.response;
 * const { data } = validation;
 * ```
 */
export function validateAndParse<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const firstIssue = result.error.issues[0]?.message || ERROR_CODES.VALIDATION_ERROR.message;
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR.code,
            message: formatErrorMessage(ERROR_CODES.VALIDATION_ERROR.code, firstIssue),
            details: { issues: result.error.issues },
          },
        },
        { status: ERROR_CODES.VALIDATION_ERROR.status }
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * 페이지네이션 파라미터 파싱
 *
 * @example
 * ```typescript
 * const pagination = parsePagination(req);
 * const { page, limit, skip } = pagination;
 * ```
 */
export function parsePagination(
  req: NextRequest,
  defaultLimit: number = 20,
  maxLimit: number = 100
): {
  page: number;
  limit: number;
  skip: number;
} {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit), 10))
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * 정렬 파라미터 파싱
 *
 * @example
 * ```typescript
 * const sort = parseSort(req, 'createdAt', 'desc');
 * const { sortBy, sortOrder } = sort;
 * ```
 */
export function parseSort(
  req: NextRequest,
  defaultSortBy: string = 'createdAt',
  defaultOrder: 'asc' | 'desc' = 'desc'
): {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
} {
  const { searchParams } = new URL(req.url);

  const sortBy = searchParams.get('sortBy') || searchParams.get('sort') || defaultSortBy;
  const order = searchParams.get('order') || defaultOrder;
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  return { sortBy, sortOrder };
}

/**
 * 필터 파라미터 파싱
 *
 * @example
 * ```typescript
 * const filters = parseFilters(req, ['isActive', 'userId', 'search']);
 * ```
 */
export function parseFilters(
  req: NextRequest,
  allowedKeys: string[]
): Record<string, string> {
  const { searchParams } = new URL(req.url);
  const filters: Record<string, string> = {};

  allowedKeys.forEach((key) => {
    const value = searchParams.get(key);
    if (value !== null) {
      filters[key] = value;
    }
  });

  return filters;
}

/**
 * 페이지네이션 응답 생성
 *
 * @example
 * ```typescript
 * return createPaginatedResponse(users, total, page, limit);
 * ```
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): NextResponse {
  return NextResponse.json({
    success: true,
    data: {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    },
  });
}

/**
 * Admin 권한 확인
 *
 * @example
 * ```typescript
 * const adminCheck = requireAdmin(user.role);
 * if (!adminCheck.isAdmin) return adminCheck.response;
 * ```
 */
export function requireAdmin(
  userRole: string
): { isAdmin: true } | { isAdmin: false; response: NextResponse } {
  if (userRole !== 'ADMIN') {
    return {
      isAdmin: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 40301,
            message: 'Admin access required',
          },
        },
        { status: 403 }
      ),
    };
  }

  return { isAdmin: true };
}

/**
 * Request body 파싱 (에러 핸들링 포함)
 *
 * @example
 * ```typescript
 * const bodyResult = await parseRequestBody(req);
 * if (!bodyResult.success) return bodyResult.response;
 * const body = bodyResult.data;
 * ```
 */
export async function parseRequestBody<T = any>(
  req: NextRequest
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const data = await req.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 40001,
            message: 'Invalid JSON body',
          },
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * User Agent 추출
 *
 * @example
 * ```typescript
 * const userAgent = getUserAgent(req);
 * ```
 */
export function getUserAgent(req: NextRequest): string {
  return req.headers.get('user-agent') || 'unknown';
}

/**
 * Referer 추출
 *
 * @example
 * ```typescript
 * const referer = getReferer(req);
 * ```
 */
export function getReferer(req: NextRequest): string | null {
  return req.headers.get('referer');
}

/**
 * 검색 파라미터 가져오기 (타입 안전)
 *
 * @example
 * ```typescript
 * const userId = getSearchParam(req, 'userId');
 * ```
 */
export function getSearchParam(
  req: NextRequest,
  key: string,
  defaultValue?: string
): string | undefined {
  const { searchParams } = new URL(req.url);
  return searchParams.get(key) || defaultValue;
}

/**
 * Boolean 검색 파라미터 파싱
 *
 * @example
 * ```typescript
 * const isActive = parseBooleanParam(req, 'isActive');
 * ```
 */
export function parseBooleanParam(
  req: NextRequest,
  key: string,
  defaultValue?: boolean
): boolean | undefined {
  const { searchParams } = new URL(req.url);
  const value = searchParams.get(key);

  if (value === null) {
    return defaultValue;
  }

  return value === 'true' || value === '1';
}

/**
 * Number 검색 파라미터 파싱
 *
 * @example
 * ```typescript
 * const maxCount = parseNumberParam(req, 'maxCount', 100);
 * ```
 */
export function parseNumberParam(
  req: NextRequest,
  key: string,
  defaultValue?: number
): number | undefined {
  const { searchParams } = new URL(req.url);
  const value = searchParams.get(key);

  if (value === null) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
