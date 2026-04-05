/**
 * cors
 *
 * CORS 유틸리티 함수
 * - 멀티 도메인 지원: 환경 변수 기반 동적 CORS 설정
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCommonConfig } from '../config/common';
import { getCorsConfig as getMiddlewareCorsConfig } from '../middleware/cors-config';

/**
 * CORS 설정 옵션
 */
export interface CorsConfig {
  /** 기본 URL (선택적) */
  baseUrl?: string;
  /** 추가 허용 Origin 목록 */
  additionalOrigins?: string[];
  /** 개발 모드 여부 */
  isDevelopment?: boolean;
}

/**
 * 전역 CORS 설정
 */
let _isDevelopment = false;
try {
  _isDevelopment = getCommonConfig().nodeEnv === 'development';
} catch {
  _isDevelopment = false;
}

let globalCorsConfig: CorsConfig = {
  isDevelopment: _isDevelopment,
};

/**
 * CORS 설정 초기화
 */
export function initCorsConfig(config: CorsConfig): void {
  globalCorsConfig = { ...globalCorsConfig, ...config };
}

/**
 * 현재 CORS 설정 가져오기
 */
export function getCorsConfig(): CorsConfig {
  return globalCorsConfig;
}

/**
 * URL에서 도메인과 www 서브도메인을 추출
 */
function extractDomainsFromUrl(url: string): string[] {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const protocol = urlObj.protocol;
    const port = urlObj.port ? `:${urlObj.port}` : '';

    const domains: string[] = [`${protocol}//${hostname}${port}`];

    // www 서브도메인이 아닌 경우 www 버전도 추가
    if (!hostname.startsWith('www.')) {
      domains.push(`${protocol}//www.${hostname}${port}`);
    }

    return domains;
  } catch {
    return [];
  }
}

/**
 * 기본 URL 가져오기 (환경 변수 또는 설정에서)
 */
function getBaseUrl(): string {
  if (globalCorsConfig.baseUrl) {
    return globalCorsConfig.baseUrl;
  }
  try {
    const middlewareCorsConfig = getMiddlewareCorsConfig();
    if (middlewareCorsConfig.baseUrl) {
      return middlewareCorsConfig.baseUrl;
    }
  } catch {
    // 초기화되지 않은 경우 기본값 사용
  }
  return 'http://localhost:3000';
}

/**
 * 허용된 도메인 목록 (런타임 환경 변수 기반)
 *
 * 우선순위:
 * 1. ALLOWED_ORIGINS 환경 변수 (쉼표로 구분)
 * 2. BASE_URL 또는 NEXT_PUBLIC_BASE_URL에서 자동 추출
 * 3. 개발 환경에서는 localhost 자동 추가
 */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  // 1. cors-config에서 허용 Origins 가져오기
  try {
    const middlewareCorsConfig = getMiddlewareCorsConfig();
    middlewareCorsConfig.allowedOrigins.forEach(origin => origins.add(origin));
  } catch {
    // 초기화되지 않은 경우 건너뜀
  }

  // 2. BASE_URL에서 도메인 자동 추출
  const baseUrl = getBaseUrl();
  if (baseUrl && baseUrl !== 'http://localhost:3000') {
    const extractedDomains = extractDomainsFromUrl(baseUrl);
    extractedDomains.forEach(domain => origins.add(domain));
  }

  // 3. 추가 설정된 Origin
  if (globalCorsConfig.additionalOrigins) {
    globalCorsConfig.additionalOrigins.forEach(origin => origins.add(origin));
  }

  // 4. 개발 환경에서는 localhost 자동 추가
  let isDev = globalCorsConfig.isDevelopment ?? false;
  if (!isDev) {
    try {
      isDev = getCommonConfig().nodeEnv === 'development';
    } catch {
      isDev = false;
    }
  }
  if (isDev) {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  return Array.from(origins).filter(Boolean);
}

// CORS 검증 함수
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return true; // Same-origin 요청은 허용

  // 개발 환경에서는 localhost 허용
  let isDevEnv = globalCorsConfig.isDevelopment ?? false;
  if (!isDevEnv) {
    try {
      isDevEnv = getCommonConfig().nodeEnv === 'development';
    } catch {
      isDevEnv = false;
    }
  }
  if (isDevEnv && origin.includes('localhost')) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
}

// 안전한 CORS 헤더 설정 함수
export function setCorsHeaders(response: NextResponse, request?: NextRequest): NextResponse {
  const origin = request?.headers.get('origin');

  if (isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );
  response.headers.set('Access-Control-Max-Age', '86400'); // 24시간
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

// API 라우트용 CORS 미들웨어
export function withCORS(handler: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest) => {
    // Preflight 요청 처리
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      return setCorsHeaders(response, request);
    }

    // 실제 요청 처리
    const response = await handler(request);
    const nextResponse = response instanceof NextResponse ? response : new NextResponse(response.body, response);

    return setCorsHeaders(nextResponse, request);
  };
}

// 특정 API용 제한적 CORS (관리자 API 등)
export function withRestrictedCORS(
  handler: (request: NextRequest) => Promise<Response>,
  allowedOrigins: string[] = []
) {
  return async (request: NextRequest) => {
    const origin = request.headers.get('origin');

    // 허용된 도메인 체크
    const restrictedAllowedOrigins = [
      ...getAllowedOrigins(),
      ...allowedOrigins
    ];

    if (origin && !restrictedAllowedOrigins.includes(origin)) {
      return new NextResponse('CORS policy violation', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      return setCorsHeaders(response, request);
    }

    const response = await handler(request);
    const nextResponse = response instanceof NextResponse ? response : new NextResponse(response.body, response);

    return setCorsHeaders(nextResponse, request);
  };
}

// 공개 API용 CORS (리다이렉트 등)
export function withPublicCORS(handler: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest) => {
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      response.headers.set('Access-Control-Max-Age', '86400');
      return response;
    }

    const response = await handler(request);
    const nextResponse = response instanceof NextResponse ? response : new NextResponse(response.body, response);

    nextResponse.headers.set('Access-Control-Allow-Origin', '*');

    return nextResponse;
  };
}
