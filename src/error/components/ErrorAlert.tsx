/**
 * ErrorAlert 컴포넌트
 *
 * 배너형 에러 알림 (섹션별 에러 표시)
 */

'use client';

import React, { useState } from 'react';
import { getErrorDisplayInfo } from '@withwiz/error/friendly-messages-v2';
import type { TLocale } from '@withwiz/error/messages';
import type { IErrorDisplay } from '@withwiz/error/friendly-messages-v2';

export interface IErrorAlertProps {
  /** 에러 코드 (예: 40907, 50001) */
  code: number;

  /** 로케일 (기본값: 'ko') */
  locale?: TLocale;

  /** 닫기 버튼 표시 여부 */
  dismissible?: boolean;

  /** 닫기 핸들러 */
  onDismiss?: () => void;

  /** 액션 버튼 텍스트 */
  actionText?: string;

  /** 액션 핸들러 */
  onAction?: () => void;

  /** 추가 메시지 */
  additionalMessage?: string;

  /** 커스텀 아이콘 */
  icon?: string;

  /** 스타일 변형 */
  variant?: 'filled' | 'outlined';
}

/**
 * Severity별 색상 매핑
 */
const severityColors: Record<
  IErrorDisplay['severity'],
  { bg: string; border: string; text: string; icon: string }
> = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-400',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: 'text-yellow-400',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-400',
  },
  critical: {
    bg: 'bg-red-100',
    border: 'border-red-300',
    text: 'text-red-900',
    icon: 'text-red-500',
  },
};

/**
 * ErrorAlert 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <ErrorAlert code={40907} />
 *
 * // 닫기 가능
 * <ErrorAlert
 *   code={50001}
 *   dismissible
 *   onDismiss={() => console.log('dismissed')}
 * />
 *
 * // 액션 버튼 포함
 * <ErrorAlert
 *   code={42203}
 *   actionText="플랜 업그레이드"
 *   onAction={() => router.push('/pricing')}
 * />
 * ```
 */
export function ErrorAlert({
  code,
  locale = 'ko',
  dismissible = false,
  onDismiss,
  actionText,
  onAction,
  additionalMessage,
  icon: customIcon,
  variant = 'filled',
}: IErrorAlertProps) {
  const [isVisible, setIsVisible] = useState(true);
  const errorInfo = getErrorDisplayInfo(code, locale);
  const colors = severityColors[errorInfo.severity];

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`rounded-lg ${variant === 'filled' ? colors.bg : 'bg-white'} border ${colors.border} p-4`}
      role="alert"
    >
      <div className="flex">
        {/* 아이콘 */}
        <div className="flex-shrink-0">
          <span
            className={`text-xl ${colors.icon}`}
            role="img"
            aria-label="error-icon"
          >
            {customIcon || errorInfo.icon}
          </span>
        </div>

        {/* 콘텐츠 */}
        <div className="ml-3 flex-1">
          {/* 제목 */}
          <h3 className={`text-sm font-medium ${colors.text}`}>
            {errorInfo.title}
          </h3>

          {/* 설명 */}
          <div className={`mt-2 text-sm ${colors.text}`}>
            <p>{errorInfo.description}</p>
            {errorInfo.action && (
              <p className="mt-1 text-xs opacity-80">{errorInfo.action}</p>
            )}
            {additionalMessage && (
              <p className="mt-1 text-xs opacity-80">{additionalMessage}</p>
            )}
          </div>

          {/* 액션 버튼 */}
          {actionText && onAction && (
            <div className="mt-3">
              <button
                onClick={onAction}
                className={`rounded-md px-3 py-2 text-sm font-medium ${colors.text} hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                {actionText}
              </button>
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        {dismissible && (
          <div className="ml-auto flex-shrink-0 pl-3">
            <button
              onClick={handleDismiss}
              className={`inline-flex rounded-md ${colors.text} hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2`}
              aria-label="Close"
            >
              <span className="sr-only">Close</span>
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 에러 코드 (작게 표시) */}
      <div className={`ml-9 mt-2 text-xs ${colors.text} opacity-60`}>
        Code: {code}
      </div>
    </div>
  );
}
