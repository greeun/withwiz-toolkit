'use client';

/**
 * 통합 에러 바운더리 컴포넌트
 * React 에러 바운더리로 전역 에러를 캐치하고 친화적 UI 표시
 */

import React, { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { getErrorDisplayInfo, extractErrorInfo } from './error-display';

interface IProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
  locale?: 'ko' | 'en';
}

interface IState {
  hasError: boolean;
  error: Error | null;
  errorCode: number;
}

/**
 * 전역 에러 바운더리
 */
export class ErrorBoundary extends Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = { hasError: false, error: null, errorCode: 50001 };
  }

  static getDerivedStateFromError(error: Error): IState {
    const { code } = extractErrorInfo(error);
    return { hasError: true, error, errorCode: code };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorCode: 50001 });
  };

  handleRefresh = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const locale = this.props.locale || 'ko';
      const displayInfo = getErrorDisplayInfo(this.state.errorCode, locale);
      const isKo = locale === 'ko';

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 text-center">
            {/* 아이콘 */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>

            {/* 제목 */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {displayInfo.title}
            </h2>

            {/* 설명 */}
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {displayInfo.description}
            </p>

            {/* 에러 코드 */}
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              {isKo ? '에러 코드' : 'Error Code'}: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{this.state.errorCode}</code>
            </p>

            {/* 개발 환경에서 상세 정보 표시 */}
            {this.props.showDetails && this.state.error && (
              <details className="text-left mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isKo ? '상세 정보' : 'Details'}
                </summary>
                <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            {/* 액션 버튼 */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRefresh}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {isKo ? '새로고침' : 'Refresh'}
              </button>

              <Link
                href="/"
                className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                {isKo ? '홈으로' : 'Go Home'}
              </Link>
            </div>

            {/* 도움말 */}
            {displayInfo.action && (
              <p className="mt-6 text-sm text-gray-500 dark:text-gray-500 flex items-center justify-center gap-1">
                <HelpCircle className="w-4 h-4" />
                {displayInfo.action}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 에러 카드 컴포넌트 (개별 섹션용)
 */
export function ErrorCard({
  code,
  message,
  locale = 'ko',
  onRetry,
  className,
}: {
  code?: number;
  message?: string;
  locale?: 'ko' | 'en';
  onRetry?: () => void;
  className?: string;
}): React.ReactElement {
  const errorCode = code || 50002;
  const displayInfo = getErrorDisplayInfo(errorCode, locale);
  const isKo = locale === 'ko';

  return (
    <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className || ''}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-red-800 dark:text-red-200">
            {message || displayInfo.title}
          </h4>
          <p className="text-sm text-red-600 dark:text-red-300 mt-1">
            {displayInfo.description} [{errorCode}]
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              {isKo ? '다시 시도' : 'Try again'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 인라인 에러 메시지 컴포넌트 (폼 필드용)
 */
export function InlineError({
  code,
  message,
  locale = 'ko',
}: {
  code?: number;
  message?: string;
  locale?: 'ko' | 'en';
}): React.ReactElement | null {
  if (!code && !message) return null;

  const displayInfo = code ? getErrorDisplayInfo(code, locale) : null;
  const displayMessage = message || displayInfo?.description || '';

  return (
    <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
      <AlertCircle className="w-3 h-3" />
      {displayMessage} {code && <span className="text-red-400">[{code}]</span>}
    </p>
  );
}

export default ErrorBoundary;
