/**
 * ErrorPage 컴포넌트
 *
 * 전체 페이지 에러 표시 (404, 500 등)
 */

'use client';

import React from 'react';
import { getErrorDisplayInfo } from '@withwiz/error/friendly-messages-v2';
import type { TLocale } from '@withwiz/error/messages';

export interface IErrorPageProps {
  /** 에러 코드 (예: 40401, 50001) */
  code: number;

  /** 로케일 (기본값: 'ko') */
  locale?: TLocale;

  /** 홈으로 돌아가기 버튼 표시 여부 */
  showHomeButton?: boolean;

  /** 홈 URL (기본값: '/') */
  homeUrl?: string;

  /** 재시도 버튼 표시 여부 */
  showRetryButton?: boolean;

  /** 재시도 핸들러 */
  onRetry?: () => void;

  /** 추가 메시지 */
  additionalMessage?: string;
}

/**
 * ErrorPage 컴포넌트
 *
 * @example
 * ```tsx
 * // 404 페이지
 * <ErrorPage code={40401} showHomeButton />
 *
 * // 500 페이지 (재시도 가능)
 * <ErrorPage
 *   code={50001}
 *   showRetryButton
 *   onRetry={() => window.location.reload()}
 * />
 * ```
 */
export function ErrorPage({
  code,
  locale = 'ko',
  showHomeButton = true,
  homeUrl = '/',
  showRetryButton = false,
  onRetry,
  additionalMessage,
}: IErrorPageProps) {
  const errorInfo = getErrorDisplayInfo(code, locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* 아이콘 */}
        <div className="flex justify-center">
          <span className="text-6xl" role="img" aria-label="error-icon">
            {errorInfo.icon}
          </span>
        </div>

        {/* 에러 코드 */}
        <div className="text-sm font-medium text-gray-500">
          {locale === 'ko' ? '오류 코드' : 'Error Code'}: {code}
        </div>

        {/* 제목 */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {errorInfo.title}
          </h1>
        </div>

        {/* 설명 */}
        <div className="space-y-2">
          <p className="text-base text-gray-600">{errorInfo.description}</p>
          {errorInfo.action && (
            <p className="text-sm text-gray-500">{errorInfo.action}</p>
          )}
          {additionalMessage && (
            <p className="text-sm text-gray-500">{additionalMessage}</p>
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {showHomeButton && (
            <a
              href={homeUrl}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {locale === 'ko' ? '홈으로 돌아가기' : 'Go to Home'}
            </a>
          )}
          {showRetryButton && onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {locale === 'ko' ? '다시 시도' : 'Retry'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
